import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { useIntakeWorkflow } from "../../intake/application/useIntakeWorkflow";
import { getCommittedRecording } from "../../intake/domain/intakeReducer";
import type {
  RecordingFailureReason,
  RecordingInterruptionReason,
  RecordingState,
} from "../../intake/domain/intakeTypes";
import {
  RecordingContext,
  type RecordingController,
} from "./RecordingContext";
import type {
  AudioObjectUrlAdapter,
  RecordingAdapter,
  RecordingSession,
  RecordingSessionResult,
  RecordingStartFailureReason,
} from "./recordingAdapter";

interface RecordingProviderProps {
  readonly children: ReactNode;
  readonly adapter: RecordingAdapter;
  readonly objectUrlAdapter: AudioObjectUrlAdapter;
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

function isActiveLifecycle(status: RecordingState["status"]): boolean {
  return (
    status === "requestingPermission" ||
    status === "recording" ||
    status === "stopping"
  );
}

function assertNever(unhandledValue: never): never {
  void unhandledValue;
  throw new Error("Unhandled recording lifecycle value.");
}

export function RecordingProvider({
  children,
  adapter,
  objectUrlAdapter,
  now = getCurrentEpochMilliseconds,
}: RecordingProviderProps): ReactElement {
  const { state, dispatch } = useIntakeWorkflow();
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const attemptSequenceRef = useRef(0);
  const committedAudioRef = useRef<Blob | null>(null);
  const objectUrlRef = useRef<string | null>(null);
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

  const revokeObjectUrl = useCallback(
    (objectUrl: string): void => {
      try {
        objectUrlAdapter.revoke(objectUrl);
      } catch {
        // Revocation is best-effort once the URL is no longer referenced.
      }
    },
    [objectUrlAdapter],
  );

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

  const finishAttempt = (
    attempt: ActiveAttempt,
    result: RecordingSessionResult,
  ): void => {
    if (
      !isMountedRef.current ||
      activeAttemptRef.current !== attempt
    ) {
      return;
    }

    activeAttemptRef.current = null;
    stopElapsedTimer();

    switch (result.status) {
      case "recorded": {
        let nextObjectUrl: string;

        try {
          nextObjectUrl = objectUrlAdapter.create(result.audio.blob);
        } catch {
          dispatch({
            type: "recordingFailed",
            attemptId: attempt.attemptId,
            reason: "recorderError",
          });
          return;
        }

        const previousObjectUrl = objectUrlRef.current;
        const startedAtEpochMs = attempt.startedAtEpochMs ?? now();
        const stoppedAtEpochMs = attempt.stoppedAtEpochMs ?? now();
        const recording = {
          recordingId: attempt.attemptId,
          mimeType: result.audio.mimeType,
          byteSize: result.audio.blob.size,
          durationMs: Math.max(0, stoppedAtEpochMs - startedAtEpochMs),
        };

        committedAudioRef.current = result.audio.blob;
        objectUrlRef.current = nextObjectUrl;
        setAudioObjectUrl(nextObjectUrl);
        dispatch({
          type: attempt.isReplacement
            ? "recordingReplaced"
            : "recordingCompleted",
          attemptId: attempt.attemptId,
          recording,
        });

        if (
          previousObjectUrl !== null &&
          previousObjectUrl !== nextObjectUrl
        ) {
          revokeObjectUrl(previousObjectUrl);
        }
        return;
      }

      case "empty":
        dispatch({
          type: "recordingFailed",
          attemptId: attempt.attemptId,
          reason: "emptyRecording",
        });
        return;

      case "interrupted":
        dispatch({
          type: "recordingInterrupted",
          attemptId: attempt.attemptId,
          reason: mapInterruption(result.reason),
        });
        return;

      case "error":
        dispatch({
          type: "recordingFailed",
          attemptId: attempt.attemptId,
          reason: "recorderError",
        });
        return;

      case "cancelled":
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
    if (activeAttemptRef.current !== null) {
      return;
    }

    attemptSequenceRef.current += 1;
    const attempt: ActiveAttempt = {
      attemptId: `recording-${attemptSequenceRef.current}`,
      isReplacement: getCommittedRecording(state.recording) !== null,
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
      (result) => finishAttempt(attempt, result),
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
    if (attempt === null) {
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

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelActiveRecording();

      if (objectUrlRef.current !== null) {
        revokeObjectUrl(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      committedAudioRef.current = null;
    };
  }, [cancelActiveRecording, revokeObjectUrl]);

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

    const staleObjectUrl = objectUrlRef.current;
    if (staleObjectUrl !== null) {
      objectUrlRef.current = null;
      committedAudioRef.current = null;
      setAudioObjectUrl(null);
      revokeObjectUrl(staleObjectUrl);
    }
  }, [revokeObjectUrl, state.recording.status, stopElapsedTimer]);

  const hasActiveAttempt = isActiveLifecycle(state.recording.status);
  const canContinue =
    getCommittedRecording(state.recording) !== null &&
    audioObjectUrl !== null &&
    !hasActiveAttempt;
  const controller: RecordingController = {
    lifecycle: state.recording,
    audioObjectUrl,
    elapsedMilliseconds,
    canContinue,
    startRecording,
    stopRecording,
    cancelActiveRecording,
  };

  return (
    <RecordingContext.Provider value={controller}>
      {children}
    </RecordingContext.Provider>
  );
}
