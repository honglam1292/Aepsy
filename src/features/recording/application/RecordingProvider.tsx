import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { useIntakeWorkflow } from "../../intake/application/useIntakeWorkflow";
import { useIntakePersistence } from "../../intake/application/useIntakePersistence";
import { getCommittedRecording } from "../../intake/domain/intakeReducer";
import { isActiveRecordingState } from "../../intake/domain/recordingState";
import type {
  RecordingFailureReason,
  RecordingInterruptionReason,
} from "../../intake/domain/intakeTypes";
import {
  RecordingContext,
  type RecordingController,
} from "./RecordingContext";
import type {
  RecordingAdapter,
  RecordingSession,
  RecordingSessionResult,
  RecordingStartFailureReason,
} from "./recordingAdapter";

interface RecordingProviderProps {
  readonly children: ReactNode;
  readonly adapter: RecordingAdapter;
  readonly now?: () => number;
}

interface ActiveAttempt {
  readonly attemptId: string;
  readonly isReplacement: boolean;
  session: RecordingSession | null;
  startedAtEpochMs: number | null;
  stoppedAtEpochMs: number | null;
  isStopRequested: boolean;
}

function getCurrentEpochMilliseconds(): number {
  return Date.now();
}

function isRecordingSupported(adapter: RecordingAdapter): boolean {
  try {
    return adapter.isSupported();
  } catch {
    return false;
  }
}

function cancelSession(session: RecordingSession | null): void {
  if (session === null) {
    return;
  }

  try {
    void session.cancel().catch(() => undefined);
  } catch {
    // The reducer still needs to leave the active lifecycle during cleanup.
  }
}

function mapStartFailure(
  reason: RecordingStartFailureReason,
): RecordingFailureReason | null {
  switch (reason) {
    case "unsupported":
      return null;
    case "permissionDenied":
    case "microphoneNotFound":
    case "microphoneUnavailable":
    case "recorderError":
      return reason;
    default:
      return assertNever(reason);
  }
}

function mapInterruption(
  reason: Extract<RecordingSessionResult, { status: "interrupted" }>["reason"],
): RecordingInterruptionReason {
  switch (reason) {
    case "microphoneEnded":
    case "browserInterrupted":
      return reason;
    default:
      return assertNever(reason);
  }
}

function assertNever(unhandledValue: never): never {
  void unhandledValue;
  throw new Error("Unhandled recording lifecycle value.");
}

export function RecordingProvider({
  children,
  adapter,
  now = getCurrentEpochMilliseconds,
}: RecordingProviderProps): ReactElement {
  const { state, dispatch } = useIntakeWorkflow();
  const persistence = useIntakePersistence();
  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const attemptSequenceRef = useRef(0);
  const elapsedTimerRef = useRef<
    ReturnType<typeof globalThis.setInterval> | null
  >(null);
  const isMountedRef = useRef(true);

  const stopElapsedTimer = useCallback((): void => {
    if (elapsedTimerRef.current !== null) {
      globalThis.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const failAttemptUnexpectedly = (
    attempt: ActiveAttempt,
  ): void => {
    if (
      !isMountedRef.current ||
      activeAttemptRef.current !== attempt
    ) {
      return;
    }

    activeAttemptRef.current = null;
    stopElapsedTimer();
    cancelSession(attempt.session);
    dispatch({
      type: "recordingFailed",
      attemptId: attempt.attemptId,
      reason: "recorderError",
    });
  };

  const finishAttempt = async (
    attempt: ActiveAttempt,
    result: RecordingSessionResult,
  ): Promise<void> => {
    if (
      !isMountedRef.current ||
      activeAttemptRef.current !== attempt
    ) {
      return;
    }

    stopElapsedTimer();

    switch (result.status) {
      case "recorded": {
        const startedAtEpochMs = attempt.startedAtEpochMs ?? now();
        const stoppedAtEpochMs = attempt.stoppedAtEpochMs ?? now();
        const recording = {
          recordingId: attempt.attemptId,
          mimeType: result.audio.mimeType,
          byteSize: result.audio.blob.size,
          durationMs: Math.max(0, stoppedAtEpochMs - startedAtEpochMs),
        };

        let commitResult;
        try {
          commitResult = await persistence.completeRecording({
            attemptId: attempt.attemptId,
            isReplacement: attempt.isReplacement,
            recording,
            audioBlob: result.audio.blob,
          });
        } catch {
          failAttemptUnexpectedly(attempt);
          return;
        }

        if (
          !isMountedRef.current ||
          activeAttemptRef.current !== attempt
        ) {
          return;
        }

        activeAttemptRef.current = null;
        if (commitResult !== "completed") {
          dispatch({
            type: "recordingFailed",
            attemptId: attempt.attemptId,
            reason: "recorderError",
          });
        }
        return;
      }

      case "empty":
        activeAttemptRef.current = null;
        dispatch({
          type: "recordingFailed",
          attemptId: attempt.attemptId,
          reason: "emptyRecording",
        });
        return;

      case "interrupted":
        activeAttemptRef.current = null;
        dispatch({
          type: "recordingInterrupted",
          attemptId: attempt.attemptId,
          reason: mapInterruption(result.reason),
        });
        return;

      case "error":
        activeAttemptRef.current = null;
        dispatch({
          type: "recordingFailed",
          attemptId: attempt.attemptId,
          reason: "recorderError",
        });
        return;

      case "cancelled":
        activeAttemptRef.current = null;
        dispatch({
          type: "recordingCancelled",
          attemptId: attempt.attemptId,
        });
        return;

      default:
        return assertNever(result);
    }
  };

  const beginRecording = async (): Promise<void> => {
    if (
      activeAttemptRef.current !== null ||
      persistence.hydration.status !== "ready" ||
      persistence.isClearingProgress
    ) {
      return;
    }

    const committedRecording = getCommittedRecording(state.recording);
    let attemptId: string;
    do {
      attemptSequenceRef.current += 1;
      attemptId = `recording-${attemptSequenceRef.current}`;
    } while (attemptId === committedRecording?.recordingId);

    const attempt: ActiveAttempt = {
      attemptId,
      isReplacement: committedRecording !== null,
      session: null,
      startedAtEpochMs: null,
      stoppedAtEpochMs: null,
      isStopRequested: false,
    };
    activeAttemptRef.current = attempt;
    setElapsedMilliseconds(0);
    dispatch({
      type: "recordingStartRequested",
      attemptId: attempt.attemptId,
    });

    if (!isRecordingSupported(adapter)) {
      if (activeAttemptRef.current === attempt && isMountedRef.current) {
        activeAttemptRef.current = null;
        dispatch({
          type: "recordingUnsupported",
          attemptId: attempt.attemptId,
        });
      }
      return;
    }

    let startResult;
    try {
      startResult = await adapter.start();
    } catch {
      failAttemptUnexpectedly(attempt);
      return;
    }

    if (
      !isMountedRef.current ||
      activeAttemptRef.current !== attempt
    ) {
      if (startResult.status === "started") {
        cancelSession(startResult.session);
      }
      return;
    }

    if (startResult.status === "failed") {
      activeAttemptRef.current = null;
      const failureReason = mapStartFailure(startResult.reason);

      dispatch(
        failureReason === null
          ? {
              type: "recordingUnsupported",
              attemptId: attempt.attemptId,
            }
          : {
              type: "recordingFailed",
              attemptId: attempt.attemptId,
              reason: failureReason,
            },
      );
      return;
    }

    const startedAtEpochMs = now();
    attempt.session = startResult.session;
    attempt.startedAtEpochMs = startedAtEpochMs;
    dispatch({
      type: "recordingStarted",
      attemptId: attempt.attemptId,
      startedAtEpochMs,
    });

    elapsedTimerRef.current = globalThis.setInterval(() => {
      if (
        isMountedRef.current &&
        activeAttemptRef.current === attempt &&
        attempt.startedAtEpochMs !== null
      ) {
        setElapsedMilliseconds(
          Math.max(0, now() - attempt.startedAtEpochMs),
        );
      }
    }, 250);

    void startResult.session.completion.then(
      (result) => {
        void finishAttempt(attempt, result);
      },
      () => failAttemptUnexpectedly(attempt),
    );
  };

  const startRecording = (): void => {
    void beginRecording();
  };

  const stopRecording = (): void => {
    const attempt = activeAttemptRef.current;

    if (
      attempt === null ||
      attempt.session === null ||
      attempt.startedAtEpochMs === null ||
      attempt.isStopRequested
    ) {
      return;
    }

    attempt.isStopRequested = true;
    const stoppedAtEpochMs = now();
    attempt.stoppedAtEpochMs = stoppedAtEpochMs;
    setElapsedMilliseconds(
      Math.max(0, stoppedAtEpochMs - attempt.startedAtEpochMs),
    );
    stopElapsedTimer();
    dispatch({
      type: "recordingStopRequested",
      attemptId: attempt.attemptId,
    });

    try {
      void attempt.session.stop().catch(() => {
        failAttemptUnexpectedly(attempt);
      });
    } catch {
      failAttemptUnexpectedly(attempt);
    }
  };

  const cancelActiveRecording = useCallback((): void => {
    const attempt = activeAttemptRef.current;
    if (attempt === null || attempt.isStopRequested) {
      return;
    }

    activeAttemptRef.current = null;
    stopElapsedTimer();
    cancelSession(attempt.session);
    dispatch({
      type: "recordingCancelled",
      attemptId: attempt.attemptId,
    });
  }, [dispatch, stopElapsedTimer]);

  const clearProgress = async (): Promise<void> => {
    const attempt = activeAttemptRef.current;
    if (attempt !== null) {
      activeAttemptRef.current = null;
      stopElapsedTimer();
      cancelSession(attempt.session);
    }

    await persistence.clearProgress();
    setElapsedMilliseconds(0);
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      const attempt = activeAttemptRef.current;
      if (attempt !== null) {
        activeAttemptRef.current = null;
        stopElapsedTimer();
        cancelSession(attempt.session);
      }
    };
  }, [stopElapsedTimer]);

  useEffect(() => {
    if (state.recording.status !== "idle") {
      return;
    }

    const staleAttempt = activeAttemptRef.current;
    if (staleAttempt !== null) {
      activeAttemptRef.current = null;
      stopElapsedTimer();
      cancelSession(staleAttempt.session);
    }
  }, [state.recording.status, stopElapsedTimer]);

  const hasActiveAttempt = isActiveRecordingState(state.recording);
  const canContinue =
    getCommittedRecording(state.recording) !== null &&
    persistence.audioObjectUrl !== null &&
    !hasActiveAttempt;
  const hasProgress =
    state.recording.status !== "idle" ||
    state.topics.status !== "unavailable" ||
    state.providerSearch.status !== "unavailable" ||
    persistence.audioObjectUrl !== null;
  const controller: RecordingController = {
    lifecycle: state.recording,
    audioObjectUrl: persistence.audioObjectUrl,
    elapsedMilliseconds,
    canContinue,
    hasProgress,
    isClearingProgress: persistence.isClearingProgress,
    startRecording,
    stopRecording,
    cancelActiveRecording,
    clearProgress,
  };

  return (
    <RecordingContext.Provider value={controller}>
      {children}
    </RecordingContext.Provider>
  );
}
