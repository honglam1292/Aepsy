import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";

import type { AudioObjectUrlAdapter } from "../../recording/application/recordingAdapter";
import type {
  RecordingAudioClearResult,
  RecordingAudioDeleteResult,
  RecordingAudioLoadResult,
  RecordingAudioPruneResult,
  RecordingAudioRepository,
  RecordingAudioSaveResult,
} from "../../recording/application/recordingAudioRepository";
import {
  getCommittedRecording,
  initialIntakeWorkflowState,
  intakeWorkflowReducer,
} from "../domain/intakeReducer";
import {
  canAccessIntakeStep,
  type IntakeStep,
} from "../domain/intakeProgress";
import type {
  CompletedRecording,
  IntakeWorkflowEvent,
  IntakeWorkflowState,
  RecordingState,
  TopicsState,
} from "../domain/intakeTypes";
import type {
  PersistedIntakeStateV1,
  PersistedRecordingState,
  PersistedTopicsState,
} from "../persistence/persistedIntakeState";
import { PERSISTED_INTAKE_STATE_VERSION } from "../persistence/persistedIntakeState";
import {
  IntakePersistenceContext,
  type CompletedRecordingAudioResult,
  type CompletedRecordingCommit,
  type CompletedRecordingCommitResult,
  type IntakeHydrationState,
  type PersistenceNotice,
} from "./IntakePersistenceContext";
import type {
  IntakeMetadataClearResult,
  IntakeMetadataLoadResult,
  IntakeMetadataRepository,
  IntakeMetadataSaveResult,
} from "./intakePersistence";
import { useIntakeWorkflow } from "./useIntakeWorkflow";

interface IntakePersistenceProviderProps {
  readonly audioRepository: RecordingAudioRepository;
  readonly children: ReactNode;
  readonly metadataRepository: IntakeMetadataRepository;
  readonly objectUrlAdapter: AudioObjectUrlAdapter;
}

type PersistenceMode = "durable" | "memoryOnly";

interface ActiveCommitOperation {
  readonly attemptId: string;
  readonly generation: number;
  readonly finished: Promise<void>;
  finish(): void;
}

interface LoadedRecordingAudio {
  readonly recordingId: string;
  readonly audio: Blob;
}

type PendingHydrationRecovery =
  | { readonly kind: "metadata" }
  | {
      readonly kind: "audio";
      readonly metadata: PersistedIntakeStateV1;
    };

function getStepFromPathname(pathname: string): IntakeStep | null {
  switch (pathname) {
    case "/record":
      return "record";
    case "/topics":
      return "topics";
    case "/matches":
      return "matches";
    default:
      return null;
  }
}

function getPersistedRecording(
  state: IntakeWorkflowState,
  durableRecordingId: string | null,
): PersistedRecordingState {
  const recording = getCommittedRecording(state.recording);

  if (
    recording === null ||
    recording.recordingId !== durableRecordingId
  ) {
    return { status: "none" };
  }

  return {
    status: "completed",
    recordingId: recording.recordingId,
    durationMs: recording.durationMs,
    mimeType: recording.mimeType,
    byteSize: recording.byteSize,
  };
}

function getPersistedTopics(
  state: IntakeWorkflowState,
  recording: PersistedRecordingState,
): PersistedTopicsState {
  if (
    recording.status !== "completed" ||
    state.topics.status !== "processed" ||
    state.topics.sourceRecordingId !== recording.recordingId
  ) {
    return { status: "unavailable" };
  }

  return {
    status: "processed",
    sourceRecordingId: state.topics.sourceRecordingId,
    suggestions: state.topics.suggestions,
    selectedTopicValues: state.topics.selectedTopicValues,
  };
}

function getPersistedStep(
  requestedStep: IntakeStep,
  recording: PersistedRecordingState,
  topics: PersistedTopicsState,
): IntakeStep {
  if (recording.status !== "completed") {
    return "record";
  }

  if (
    requestedStep === "matches" &&
    (topics.status !== "processed" ||
      topics.selectedTopicValues.length === 0)
  ) {
    return "topics";
  }

  return requestedStep;
}

function getUnfinishedAttemptId(
  recording: RecordingState,
): string | null {
  switch (recording.status) {
    case "recording":
    case "stopping":
      return recording.attemptId;
    case "idle":
    case "requestingPermission":
    case "recorded":
    case "interrupted":
    case "unsupported":
    case "error":
      return null;
    default:
      return assertNever(recording);
  }
}

function createPersistedState(
  state: IntakeWorkflowState,
  requestedStep: IntakeStep,
  durableRecordingId: string | null,
): PersistedIntakeStateV1 {
  const recording = getPersistedRecording(state, durableRecordingId);
  const topics = getPersistedTopics(state, recording);

  return {
    version: PERSISTED_INTAKE_STATE_VERSION,
    currentStep: getPersistedStep(requestedStep, recording, topics),
    recording,
    topics,
    unfinishedRecordingAttemptId: getUnfinishedAttemptId(state.recording),
  };
}

function hasPersistedProgress(state: PersistedIntakeStateV1): boolean {
  return (
    state.recording.status === "completed" ||
    state.topics.status === "processed" ||
    state.unfinishedRecordingAttemptId !== null
  );
}

function createCompletedRecording(
  persistedRecording: Extract<
    PersistedRecordingState,
    { readonly status: "completed" }
  >,
) {
  return {
    recordingId: persistedRecording.recordingId,
    durationMs: persistedRecording.durationMs,
    mimeType: persistedRecording.mimeType,
    byteSize: persistedRecording.byteSize,
  };
}

function recordingMatchesAudio(
  recording: CompletedRecording,
  audio: Blob,
): boolean {
  return (
    audio.size > 0 &&
    audio.size === recording.byteSize &&
    audio.type.trim().toLowerCase() === recording.mimeType.trim().toLowerCase()
  );
}

function createRestoredTopics(
  persistedTopics: PersistedTopicsState,
): TopicsState {
  switch (persistedTopics.status) {
    case "unavailable":
      return { status: "unavailable" };
    case "processed":
      return {
        status: "processed",
        sourceRecordingId: persistedTopics.sourceRecordingId,
        suggestions: persistedTopics.suggestions,
        selectedTopicValues: persistedTopics.selectedTopicValues,
      };
    default:
      return assertNever(persistedTopics);
  }
}

function loadMetadata(
  repository: IntakeMetadataRepository,
): IntakeMetadataLoadResult {
  try {
    return repository.load();
  } catch {
    return { status: "failed" };
  }
}

function saveMetadata(
  repository: IntakeMetadataRepository,
  state: PersistedIntakeStateV1,
): IntakeMetadataSaveResult {
  try {
    return repository.save(state);
  } catch {
    return { status: "failed" };
  }
}

function clearMetadata(
  repository: IntakeMetadataRepository,
): IntakeMetadataClearResult {
  try {
    return repository.clear();
  } catch {
    return { status: "failed" };
  }
}

async function loadAudio(
  repository: RecordingAudioRepository,
  recordingId: string,
): Promise<RecordingAudioLoadResult> {
  try {
    return await repository.load(recordingId);
  } catch {
    return { status: "failed" };
  }
}

async function saveAudio(
  repository: RecordingAudioRepository,
  recordingId: string,
  audio: Blob,
): Promise<RecordingAudioSaveResult> {
  try {
    return await repository.save(recordingId, audio);
  } catch {
    return { status: "failed" };
  }
}

async function deleteAudio(
  repository: RecordingAudioRepository,
  recordingId: string,
): Promise<RecordingAudioDeleteResult> {
  try {
    return await repository.delete(recordingId);
  } catch {
    return { status: "failed" };
  }
}

async function clearAudio(
  repository: RecordingAudioRepository,
): Promise<RecordingAudioClearResult> {
  try {
    return await repository.clear();
  } catch {
    return { status: "failed" };
  }
}

async function pruneAudio(
  repository: RecordingAudioRepository,
  retainedRecordingId: string | null,
): Promise<RecordingAudioPruneResult> {
  try {
    return await repository.prune(retainedRecordingId);
  } catch {
    return { status: "failed" };
  }
}

function createActiveCommitOperation(
  attemptId: string,
  generation: number,
): ActiveCommitOperation {
  let resolveFinished: (() => void) | null = null;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  return {
    attemptId,
    generation,
    finished,
    finish(): void {
      resolveFinished?.();
      resolveFinished = null;
    },
  };
}

function assertNever(unhandledValue: never): never {
  void unhandledValue;
  throw new Error("Unhandled intake persistence value.");
}

export function IntakePersistenceProvider({
  audioRepository,
  children,
  metadataRepository,
  objectUrlAdapter,
}: IntakePersistenceProviderProps): ReactElement {
  const { pathname } = useLocation();
  const { state, dispatch, getState } = useIntakeWorkflow();
  const [hydration, setHydration] =
    useState<IntakeHydrationState>({ status: "hydrating" });
  const [hydrationRevision, setHydrationRevision] = useState(0);
  const [metadataRevision, setMetadataRevision] = useState(0);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [lastValidStep, setLastValidStep] =
    useState<IntakeStep>("record");
  const [notice, setNotice] = useState<PersistenceNotice | null>(null);
  const [isClearingProgress, setIsClearingProgress] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const loadedAudioRef = useRef<LoadedRecordingAudio | null>(null);
  const durableRecordingIdRef = useRef<string | null>(null);
  const unrestoredRecordingIdRef = useRef<string | null>(null);
  const lastValidStepRef = useRef<IntakeStep>("record");
  const lastMetadataSignatureRef = useRef<string | null>(null);
  const pendingRecoveryRef = useRef<PendingHydrationRecovery | null>(null);
  const persistenceModeRef = useRef<PersistenceMode>("durable");
  const hasStorageCleanupDebtRef = useRef(false);
  const operationGenerationRef = useRef(0);
  const isMountedRef = useRef(true);
  const isCommitInProgressRef = useRef(false);
  const isClearingProgressRef = useRef(false);
  const activeCommitRef = useRef<ActiveCommitOperation | null>(null);

  const revokeObjectUrl = useCallback(
    (objectUrl: string): void => {
      try {
        objectUrlAdapter.revoke(objectUrl);
      } catch {
        // The URL is already unreachable even if browser cleanup fails.
      }
    },
    [objectUrlAdapter],
  );

  const dispatchHydratedWorkflow = useCallback(
    (recording: RecordingState, topics: TopicsState): void => {
      const event: IntakeWorkflowEvent = {
        type: "workflowHydrated",
        recording,
        topics,
      };
      dispatch(event);
    },
    [dispatch],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      operationGenerationRef.current += 1;
      loadedAudioRef.current = null;

      const objectUrl = objectUrlRef.current;
      if (objectUrl !== null) {
        objectUrlRef.current = null;
        revokeObjectUrl(objectUrl);
      }
    };
  }, [revokeObjectUrl]);

  useEffect(() => {
    const generation = operationGenerationRef.current + 1;
    operationGenerationRef.current = generation;
    pendingRecoveryRef.current = null;
    loadedAudioRef.current = null;

    const isCurrentHydration = (): boolean =>
      isMountedRef.current && operationGenerationRef.current === generation;

    const finishReady = (
      nextNotice: PersistenceNotice | null = null,
    ): void => {
      if (!isCurrentHydration()) {
        return;
      }
      setNotice(nextNotice);
      setHydration({ status: "ready" });
    };

    const requireRecovery = (
      recovery: PendingHydrationRecovery,
      reason: Extract<
        IntakeHydrationState,
        { readonly status: "recoveryRequired" }
      >["reason"],
      canRetry: boolean,
    ): void => {
      if (!isCurrentHydration()) {
        return;
      }
      pendingRecoveryRef.current = recovery;
      setHydration({ status: "recoveryRequired", reason, canRetry });
    };

    async function hydrate(): Promise<void> {
      const metadataResult = loadMetadata(metadataRepository);

      switch (metadataResult.status) {
        case "unavailable":
          requireRecovery(
            { kind: "metadata" },
            "metadataUnavailable",
            false,
          );
          return;
        case "failed":
          requireRecovery(
            { kind: "metadata" },
            "metadataReadFailed",
            true,
          );
          return;
        case "invalid":
        case "versionMismatch": {
          const audioPruneResult = await pruneAudio(audioRepository, null);
          const metadataClearResult = clearMetadata(metadataRepository);

          if (!isCurrentHydration()) {
            return;
          }

          lastMetadataSignatureRef.current = null;
          durableRecordingIdRef.current = null;
          persistenceModeRef.current =
            audioPruneResult.status === "pruned" &&
            metadataClearResult.status === "cleared"
              ? "durable"
              : "memoryOnly";
          hasStorageCleanupDebtRef.current =
            audioPruneResult.status !== "pruned" ||
            metadataClearResult.status !== "cleared";
          dispatchHydratedWorkflow(
            initialIntakeWorkflowState.recording,
            initialIntakeWorkflowState.topics,
          );
          finishReady(
            audioPruneResult.status === "pruned" &&
              metadataClearResult.status === "cleared"
              ? "savedProgressReset"
              : "clearIncomplete",
          );
          return;
        }
        case "empty": {
          const audioPruneResult = await pruneAudio(audioRepository, null);

          if (!isCurrentHydration()) {
            return;
          }

          lastMetadataSignatureRef.current = null;
          durableRecordingIdRef.current = null;
          persistenceModeRef.current =
            audioPruneResult.status === "pruned"
              ? "durable"
              : "memoryOnly";
          hasStorageCleanupDebtRef.current =
            audioPruneResult.status !== "pruned";
          dispatchHydratedWorkflow(
            initialIntakeWorkflowState.recording,
            initialIntakeWorkflowState.topics,
          );
          finishReady(
            audioPruneResult.status === "pruned"
              ? null
              : audioPruneResult.status === "unsupported"
                ? "storageUnavailable"
                : "clearIncomplete",
          );
          return;
        }
        case "loaded":
          break;
        default:
          return assertNever(metadataResult);
      }

      const metadata = metadataResult.state;
      lastMetadataSignatureRef.current = JSON.stringify(metadata);

      if (metadata.recording.status === "none") {
        const audioPruneResult = await pruneAudio(audioRepository, null);
        const metadataClearResult = clearMetadata(metadataRepository);

        if (!isCurrentHydration()) {
          return;
        }

        const recording: RecordingState =
          metadata.unfinishedRecordingAttemptId === null
            ? { status: "idle" }
            : {
                status: "interrupted",
                attemptId: metadata.unfinishedRecordingAttemptId,
                reason: "browserReload",
                previousRecording: null,
              };

        durableRecordingIdRef.current = null;
        lastMetadataSignatureRef.current =
          metadataClearResult.status === "cleared"
            ? null
            : JSON.stringify(metadata);
        persistenceModeRef.current =
          audioPruneResult.status === "pruned" &&
          metadataClearResult.status === "cleared"
            ? "durable"
            : "memoryOnly";
        hasStorageCleanupDebtRef.current =
          audioPruneResult.status !== "pruned" ||
          metadataClearResult.status !== "cleared";
        lastValidStepRef.current = "record";
        setLastValidStep("record");
        dispatchHydratedWorkflow(recording, { status: "unavailable" });
        finishReady(
          audioPruneResult.status === "pruned" &&
            metadataClearResult.status === "cleared"
            ? null
            : "clearIncomplete",
        );
        return;
      }

      const audioResult = await loadAudio(
        audioRepository,
        metadata.recording.recordingId,
      );

      if (!isCurrentHydration()) {
        return;
      }

      switch (audioResult.status) {
        case "unsupported":
          requireRecovery(
            { kind: "audio", metadata },
            "audioUnavailable",
            false,
          );
          return;
        case "failed":
          requireRecovery(
            { kind: "audio", metadata },
            "audioUnavailable",
            true,
          );
          return;
        case "notFound": {
          const audioPruneResult = await pruneAudio(audioRepository, null);
          const metadataClearResult = clearMetadata(metadataRepository);

          if (!isCurrentHydration()) {
            return;
          }

          lastMetadataSignatureRef.current = null;
          durableRecordingIdRef.current = null;
          unrestoredRecordingIdRef.current = metadata.recording.recordingId;
          persistenceModeRef.current =
            audioPruneResult.status === "pruned" &&
            metadataClearResult.status === "cleared"
              ? "durable"
              : "memoryOnly";
          hasStorageCleanupDebtRef.current =
            audioPruneResult.status !== "pruned" ||
            metadataClearResult.status !== "cleared";
          dispatchHydratedWorkflow(
            {
              status: "interrupted",
              attemptId:
                metadata.unfinishedRecordingAttemptId ??
                `restore-${metadata.recording.recordingId}`,
              reason: "storedAudioMissing",
              previousRecording: null,
            },
            { status: "unavailable" },
          );
          finishReady(
            audioPruneResult.status === "pruned" &&
              metadataClearResult.status === "cleared"
              ? null
              : "clearIncomplete",
          );
          return;
        }
        case "loaded":
          break;
        default:
          return assertNever(audioResult);
      }

      const completedRecording = createCompletedRecording(metadata.recording);
      if (!recordingMatchesAudio(completedRecording, audioResult.audio)) {
        const audioPruneResult = await pruneAudio(audioRepository, null);
        const metadataClearResult = clearMetadata(metadataRepository);

        if (!isCurrentHydration()) {
          return;
        }

        lastMetadataSignatureRef.current = null;
        durableRecordingIdRef.current = null;
        unrestoredRecordingIdRef.current = metadata.recording.recordingId;
        persistenceModeRef.current =
          audioPruneResult.status === "pruned" &&
          metadataClearResult.status === "cleared"
            ? "durable"
            : "memoryOnly";
        hasStorageCleanupDebtRef.current =
          audioPruneResult.status !== "pruned" ||
          metadataClearResult.status !== "cleared";
        dispatchHydratedWorkflow(
          {
            status: "interrupted",
            attemptId:
              metadata.unfinishedRecordingAttemptId ??
              `restore-${metadata.recording.recordingId}`,
            reason: "storedAudioMissing",
            previousRecording: null,
          },
          { status: "unavailable" },
        );
        finishReady(
          audioPruneResult.status === "pruned" &&
            metadataClearResult.status === "cleared"
            ? null
            : "clearIncomplete",
        );
        return;
      }

      const audioPruneResult = await pruneAudio(
        audioRepository,
        metadata.recording.recordingId,
      );

      if (!isCurrentHydration()) {
        return;
      }

      hasStorageCleanupDebtRef.current =
        audioPruneResult.status !== "pruned";

      let restoredObjectUrl: string;
      try {
        // Blob URLs do not survive refresh, so recreate one from IndexedDB.
        restoredObjectUrl = objectUrlAdapter.create(audioResult.audio);
      } catch {
        requireRecovery(
          { kind: "audio", metadata },
          "audioUnavailable",
          true,
        );
        return;
      }

      if (!isCurrentHydration()) {
        revokeObjectUrl(restoredObjectUrl);
        return;
      }

      const restoredRecording: RecordingState =
        metadata.unfinishedRecordingAttemptId === null
          ? { status: "recorded", recording: completedRecording }
          : {
              status: "interrupted",
              attemptId: metadata.unfinishedRecordingAttemptId,
              reason: "browserReload",
              previousRecording: completedRecording,
            };

      objectUrlRef.current = restoredObjectUrl;
      loadedAudioRef.current = {
        recordingId: completedRecording.recordingId,
        audio: audioResult.audio,
      };
      durableRecordingIdRef.current = completedRecording.recordingId;
      lastValidStepRef.current = metadata.currentStep;
      setAudioObjectUrl(restoredObjectUrl);
      setLastValidStep(metadata.currentStep);
      dispatchHydratedWorkflow(
        restoredRecording,
        createRestoredTopics(metadata.topics),
      );
      finishReady(
        audioPruneResult.status === "pruned"
          ? null
          : "storageCleanupFailed",
      );
    }

    void hydrate();

    return () => {
      if (operationGenerationRef.current === generation) {
        operationGenerationRef.current += 1;
      }
    };
  }, [
    audioRepository,
    dispatchHydratedWorkflow,
    hydrationRevision,
    metadataRepository,
    objectUrlAdapter,
    revokeObjectUrl,
  ]);

  useEffect(() => {
    if (hydration.status !== "ready") {
      return;
    }

    const routeStep = getStepFromPathname(pathname);
    if (
      routeStep === null ||
      !canAccessIntakeStep(state, routeStep) ||
      lastValidStepRef.current === routeStep
    ) {
      return;
    }

    lastValidStepRef.current = routeStep;
    setLastValidStep(routeStep);
  }, [hydration.status, pathname, state]);

  useEffect(() => {
    if (
      hydration.status !== "ready" ||
      persistenceModeRef.current === "memoryOnly" ||
      isCommitInProgressRef.current ||
      isClearingProgressRef.current
    ) {
      return;
    }

    let isCancelled = false;

    async function persistCurrentMetadata(): Promise<void> {
      await Promise.resolve();
      if (
        isCancelled ||
        isCommitInProgressRef.current ||
        isClearingProgressRef.current ||
        persistenceModeRef.current === "memoryOnly"
      ) {
        return;
      }

      const persistedState = createPersistedState(
        state,
        lastValidStep,
        durableRecordingIdRef.current,
      );
      const signature = JSON.stringify(persistedState);

      if (!hasPersistedProgress(persistedState)) {
        if (lastMetadataSignatureRef.current === null) {
          return;
        }

        const result = clearMetadata(metadataRepository);
        if (result.status === "cleared") {
          lastMetadataSignatureRef.current = null;
        } else if (!isCancelled) {
          persistenceModeRef.current = "memoryOnly";
          setNotice("progressNotSaved");
        }
        return;
      }

      if (lastMetadataSignatureRef.current === signature) {
        return;
      }

      const result = saveMetadata(metadataRepository, persistedState);
      if (result.status === "saved") {
        lastMetadataSignatureRef.current = signature;
      } else if (!isCancelled) {
        persistenceModeRef.current = "memoryOnly";
        setNotice("progressNotSaved");
      }
    }

    void persistCurrentMetadata();

    return () => {
      isCancelled = true;
    };
  }, [
    hydration.status,
    lastValidStep,
    metadataRepository,
    metadataRevision,
    state,
  ]);

  const completeRecording = async (
    commit: CompletedRecordingCommit,
  ): Promise<CompletedRecordingCommitResult> => {
    if (
      hydration.status !== "ready" ||
      isCommitInProgressRef.current ||
      isClearingProgressRef.current
    ) {
      return "stale";
    }

    const event: IntakeWorkflowEvent = {
      type: commit.isReplacement
        ? "recordingReplaced"
        : "recordingCompleted",
      attemptId: commit.attemptId,
      recording: commit.recording,
    };
    const initialState = getState();
    if (intakeWorkflowReducer(initialState, event) === initialState) {
      return "stale";
    }

    let nextObjectUrl: string;
    try {
      nextObjectUrl = objectUrlAdapter.create(commit.audioBlob);
    } catch {
      return "resourceError";
    }

    const generation = operationGenerationRef.current;
    const operation = createActiveCommitOperation(
      commit.attemptId,
      generation,
    );
    activeCommitRef.current = operation;
    isCommitInProgressRef.current = true;
    const previousRecordingId = durableRecordingIdRef.current;
    const previousObjectUrl = objectUrlRef.current;
    let candidateAudioWasSaved = false;
    let candidateMetadataWasSaved = false;

    const isCurrentOperation = (): boolean =>
      isMountedRef.current &&
      !isClearingProgressRef.current &&
      operationGenerationRef.current === generation &&
      activeCommitRef.current === operation;

    const removeUnpublishedCandidate = async (): Promise<boolean> => {
      if (!candidateAudioWasSaved || candidateMetadataWasSaved) {
        return true;
      }

      const deleteResult = await deleteAudio(
        audioRepository,
        commit.recording.recordingId,
      );
      candidateAudioWasSaved = false;
      return deleteResult.status === "deleted";
    };

    try {
      let isDurable = false;
      let didCandidateCleanupFail = false;

      if (persistenceModeRef.current === "durable") {
        const audioSaveResult = await saveAudio(
          audioRepository,
          commit.recording.recordingId,
          commit.audioBlob,
        );
        candidateAudioWasSaved = audioSaveResult.status === "saved";

        if (!isCurrentOperation()) {
          await removeUnpublishedCandidate();
          revokeObjectUrl(nextObjectUrl);
          return "stale";
        }

        if (candidateAudioWasSaved) {
          const currentState = getState();
          const nextState = intakeWorkflowReducer(currentState, event);

          if (nextState === currentState) {
            await removeUnpublishedCandidate();
            revokeObjectUrl(nextObjectUrl);
            return "stale";
          }

          const persistedState = createPersistedState(
            nextState,
            lastValidStepRef.current,
            commit.recording.recordingId,
          );
          const metadataSaveResult = saveMetadata(
            metadataRepository,
            persistedState,
          );

          if (metadataSaveResult.status === "saved") {
            isDurable = true;
            candidateMetadataWasSaved = true;
            lastMetadataSignatureRef.current = JSON.stringify(persistedState);
          } else {
            didCandidateCleanupFail = !(await removeUnpublishedCandidate());
          }
        }
      }

      let didOldAudioCleanupFail = false;
      if (isDurable) {
        const pruneResult = await pruneAudio(
          audioRepository,
          commit.recording.recordingId,
        );
        didOldAudioCleanupFail = pruneResult.status !== "pruned";
        hasStorageCleanupDebtRef.current = didOldAudioCleanupFail;
        unrestoredRecordingIdRef.current = null;
      }

      if (!isCurrentOperation()) {
        await removeUnpublishedCandidate();
        revokeObjectUrl(nextObjectUrl);
        return "stale";
      }

      const currentState = getState();
      const nextState = intakeWorkflowReducer(currentState, event);
      if (nextState === currentState) {
        await removeUnpublishedCandidate();
        revokeObjectUrl(nextObjectUrl);
        return "stale";
      }

      if (!isDurable) {
        persistenceModeRef.current = "memoryOnly";
      }

      const hadStorageCleanupDebt = hasStorageCleanupDebtRef.current;
      objectUrlRef.current = nextObjectUrl;
      loadedAudioRef.current = {
        recordingId: commit.recording.recordingId,
        audio: commit.audioBlob,
      };
      durableRecordingIdRef.current = isDurable
        ? commit.recording.recordingId
        : previousRecordingId;
      setAudioObjectUrl(nextObjectUrl);
      dispatch(event);

      if (previousObjectUrl !== null && previousObjectUrl !== nextObjectUrl) {
        revokeObjectUrl(previousObjectUrl);
      }

      if (!isDurable) {
        hasStorageCleanupDebtRef.current =
          hadStorageCleanupDebt || didCandidateCleanupFail;
        setNotice(
          hasStorageCleanupDebtRef.current
            ? "progressNotSavedCleanupFailed"
            : "progressNotSaved",
        );
        return "completed";
      }

      setNotice(didOldAudioCleanupFail ? "storageCleanupFailed" : null);

      return "completed";
    } finally {
      if (activeCommitRef.current === operation) {
        activeCommitRef.current = null;
        isCommitInProgressRef.current = false;
      }
      operation.finish();
      if (isMountedRef.current && !isClearingProgressRef.current) {
        setMetadataRevision((revision) => revision + 1);
      }
    }
  };

  const clearProgress = async (): Promise<void> => {
    if (isClearingProgressRef.current) {
      return;
    }

    isClearingProgressRef.current = true;
    setIsClearingProgress(true);
    operationGenerationRef.current += 1;

    const activeCommit = activeCommitRef.current;
    if (activeCommit !== null) {
      await activeCommit.finished;
    }

    const audioClearResult = await clearAudio(audioRepository);
    const metadataClearResult = clearMetadata(metadataRepository);
    const objectUrl = objectUrlRef.current;

    objectUrlRef.current = null;
    loadedAudioRef.current = null;
    durableRecordingIdRef.current = null;
    unrestoredRecordingIdRef.current = null;
    lastMetadataSignatureRef.current = null;
    lastValidStepRef.current = "record";
    pendingRecoveryRef.current = null;
    persistenceModeRef.current =
      audioClearResult.status === "cleared" &&
      metadataClearResult.status === "cleared"
        ? "durable"
        : "memoryOnly";
    hasStorageCleanupDebtRef.current =
      audioClearResult.status !== "cleared" ||
      metadataClearResult.status !== "cleared";
    if (objectUrl !== null) {
      revokeObjectUrl(objectUrl);
    }

    if (isMountedRef.current) {
      setAudioObjectUrl(null);
      setLastValidStep("record");
      dispatch({ type: "progressCleared" });
      setNotice(
        audioClearResult.status === "cleared" &&
          metadataClearResult.status === "cleared"
          ? "progressCleared"
          : "clearIncomplete",
      );
      setHydration({ status: "ready" });
    }
    isClearingProgressRef.current = false;
    if (isMountedRef.current) {
      setIsClearingProgress(false);
    }
  };

  const retryHydration = (): void => {
    if (
      hydration.status !== "recoveryRequired" ||
      !hydration.canRetry
    ) {
      return;
    }

    setHydration({ status: "hydrating" });
    setHydrationRevision((revision) => revision + 1);
  };

  const continueWithoutRestoring = (): void => {
    if (hydration.status !== "recoveryRequired") {
      return;
    }

    operationGenerationRef.current += 1;
    const pendingRecovery = pendingRecoveryRef.current;
    pendingRecoveryRef.current = null;
    persistenceModeRef.current = "memoryOnly";
    hasStorageCleanupDebtRef.current = pendingRecovery !== null;
    durableRecordingIdRef.current = null;
    loadedAudioRef.current = null;
    lastValidStepRef.current = "record";
    setLastValidStep("record");

    if (pendingRecovery?.kind === "audio") {
      unrestoredRecordingIdRef.current =
        pendingRecovery.metadata.recording.status === "completed"
          ? pendingRecovery.metadata.recording.recordingId
          : null;
      dispatchHydratedWorkflow(
        {
          status: "interrupted",
          attemptId:
            pendingRecovery.metadata.unfinishedRecordingAttemptId ??
            `restore-${unrestoredRecordingIdRef.current ?? "audio"}`,
          reason: "storedAudioUnavailable",
          previousRecording: null,
        },
        { status: "unavailable" },
      );
    } else {
      dispatchHydratedWorkflow(
        initialIntakeWorkflowState.recording,
        initialIntakeWorkflowState.topics,
      );
    }

    setNotice("storageUnavailable");
    setHydration({ status: "ready" });
  };

  const loadCompletedRecordingAudio = useCallback(
    async (recordingId: string): Promise<CompletedRecordingAudioResult> => {
      const recording = getCommittedRecording(getState().recording);
      if (recording?.recordingId !== recordingId) {
        return { status: "stale" };
      }

      const loadedAudio = loadedAudioRef.current;
      if (
        loadedAudio?.recordingId === recordingId &&
        recordingMatchesAudio(recording, loadedAudio.audio)
      ) {
        return { status: "loaded", audio: loadedAudio.audio };
      }

      const result = await loadAudio(audioRepository, recordingId);
      if (!isMountedRef.current) {
        return { status: "stale" };
      }

      const currentRecording = getCommittedRecording(getState().recording);
      if (currentRecording?.recordingId !== recordingId) {
        return { status: "stale" };
      }

      if (
        result.status !== "loaded" ||
        !recordingMatchesAudio(currentRecording, result.audio)
      ) {
        return { status: "unavailable" };
      }

      loadedAudioRef.current = { recordingId, audio: result.audio };
      return { status: "loaded", audio: result.audio };
    },
    [audioRepository, getState],
  );

  return (
    <IntakePersistenceContext.Provider
      value={{
        hydration,
        audioObjectUrl,
        lastValidStep,
        notice,
        isClearingProgress,
        completeRecording,
        loadCompletedRecordingAudio,
        clearProgress,
        retryHydration,
        continueWithoutRestoring,
      }}
    >
      {children}
    </IntakePersistenceContext.Provider>
  );
}
