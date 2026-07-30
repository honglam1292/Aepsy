import type {
  IntakeMetadataClearResult,
  IntakeMetadataLoadResult,
  IntakeMetadataRepository,
  IntakeMetadataSaveResult,
} from "../features/intake/application/intakePersistence";
import type { PersistedIntakeStateV1 } from "../features/intake/persistence/persistedIntakeState";
import type {
  AudioObjectUrlAdapter,
  RecordingAdapter,
  RecordingSession,
  RecordingSessionResult,
  RecordingStartResult,
} from "../features/recording/application/recordingAdapter";
import type {
  RecordingAudioClearResult,
  RecordingAudioDeleteResult,
  RecordingAudioLoadResult,
  RecordingAudioPruneResult,
  RecordingAudioRepository,
  RecordingAudioSaveResult,
} from "../features/recording/application/recordingAudioRepository";

export class MemoryIntakeMetadataRepository
  implements IntakeMetadataRepository
{
  state: PersistedIntakeStateV1 | null;
  loadOverride: IntakeMetadataLoadResult | null = null;
  saveOutcome: IntakeMetadataSaveResult = { status: "saved" };
  clearOutcome: IntakeMetadataClearResult = { status: "cleared" };
  readonly savedStates: PersistedIntakeStateV1[] = [];
  clearCallCount = 0;

  constructor(state: PersistedIntakeStateV1 | null = null) {
    this.state = state;
  }

  load(): IntakeMetadataLoadResult {
    if (this.loadOverride !== null) {
      return this.loadOverride;
    }

    return this.state === null
      ? { status: "empty" }
      : { status: "loaded", state: this.state };
  }

  save(state: PersistedIntakeStateV1): IntakeMetadataSaveResult {
    this.savedStates.push(state);
    if (this.saveOutcome.status === "saved") {
      this.state = state;
    }
    return this.saveOutcome;
  }

  clear(): IntakeMetadataClearResult {
    this.clearCallCount += 1;
    if (this.clearOutcome.status === "cleared") {
      this.state = null;
    }
    return this.clearOutcome;
  }
}

export class MemoryRecordingAudioRepository
  implements RecordingAudioRepository
{
  readonly recordings = new Map<string, Blob>();
  loadOutcome: "normal" | "unsupported" | "failed" = "normal";
  saveOutcome: RecordingAudioSaveResult = { status: "saved" };
  deleteOutcome: RecordingAudioDeleteResult = { status: "deleted" };
  pruneOutcome: RecordingAudioPruneResult = { status: "pruned" };
  clearOutcome: RecordingAudioClearResult = { status: "cleared" };
  pendingLoad: Promise<RecordingAudioLoadResult> | null = null;
  readonly loadedRecordingIds: string[] = [];
  readonly savedRecordingIds: string[] = [];
  readonly deletedRecordingIds: string[] = [];
  readonly retainedRecordingIds: Array<string | null> = [];
  clearCallCount = 0;

  async load(recordingId: string): Promise<RecordingAudioLoadResult> {
    this.loadedRecordingIds.push(recordingId);
    if (this.pendingLoad !== null) {
      return this.pendingLoad;
    }
    if (this.loadOutcome !== "normal") {
      return { status: this.loadOutcome };
    }

    const audio = this.recordings.get(recordingId);
    return audio === undefined
      ? { status: "notFound" }
      : { status: "loaded", audio };
  }

  async save(
    recordingId: string,
    audio: Blob,
  ): Promise<RecordingAudioSaveResult> {
    this.savedRecordingIds.push(recordingId);
    if (this.saveOutcome.status === "saved") {
      this.recordings.set(recordingId, audio);
    }
    return this.saveOutcome;
  }

  async delete(recordingId: string): Promise<RecordingAudioDeleteResult> {
    this.deletedRecordingIds.push(recordingId);
    if (this.deleteOutcome.status === "deleted") {
      this.recordings.delete(recordingId);
    }
    return this.deleteOutcome;
  }

  async prune(
    retainedRecordingId: string | null,
  ): Promise<RecordingAudioPruneResult> {
    this.retainedRecordingIds.push(retainedRecordingId);
    if (this.pruneOutcome.status !== "pruned") {
      return this.pruneOutcome;
    }

    if (
      retainedRecordingId !== null &&
      retainedRecordingId.trim().length === 0
    ) {
      return { status: "failed" };
    }

    for (const recordingId of this.recordings.keys()) {
      if (recordingId !== retainedRecordingId) {
        this.recordings.delete(recordingId);
      }
    }
    return { status: "pruned" };
  }

  async clear(): Promise<RecordingAudioClearResult> {
    this.clearCallCount += 1;
    if (this.clearOutcome.status === "cleared") {
      this.recordings.clear();
    }
    return this.clearOutcome;
  }
}

export class MemoryObjectUrlAdapter implements AudioObjectUrlAdapter {
  private sequence = 0;
  readonly createdBlobs: Blob[] = [];
  readonly revokedUrls: string[] = [];

  create(blob: Blob): string {
    this.sequence += 1;
    this.createdBlobs.push(blob);
    return `blob:test-${this.sequence}`;
  }

  revoke(objectUrl: string): void {
    this.revokedUrls.push(objectUrl);
  }
}

class CompletingRecordingSession implements RecordingSession {
  readonly completion: Promise<RecordingSessionResult>;
  private readonly audio: Blob;
  private resolveCompletion:
    | ((result: RecordingSessionResult) => void)
    | null = null;
  private result: RecordingSessionResult | null = null;

  constructor(audio: Blob) {
    this.audio = audio;
    this.completion = new Promise((resolve) => {
      this.resolveCompletion = resolve;
    });
  }

  stop(): Promise<RecordingSessionResult> {
    this.settle({
      status: "recorded",
      audio: { blob: this.audio, mimeType: this.audio.type },
    });
    return this.completion;
  }

  cancel(): Promise<RecordingSessionResult> {
    this.settle({ status: "cancelled" });
    return this.completion;
  }

  private settle(result: RecordingSessionResult): void {
    if (this.result !== null) {
      return;
    }

    this.result = result;
    this.resolveCompletion?.(result);
    this.resolveCompletion = null;
  }
}

export class CompletingRecordingAdapter implements RecordingAdapter {
  readonly audio: Blob;
  startCallCount = 0;

  constructor(audio: Blob) {
    this.audio = audio;
  }

  isSupported(): boolean {
    return true;
  }

  async start(): Promise<RecordingStartResult> {
    this.startCallCount += 1;
    return {
      status: "started",
      session: new CompletingRecordingSession(this.audio),
    };
  }
}

export function createCompletedPersistedState({
  currentStep = "record",
  unfinishedRecordingAttemptId = null,
  withSelectedTopic = false,
}: {
  readonly currentStep?: PersistedIntakeStateV1["currentStep"];
  readonly unfinishedRecordingAttemptId?: string | null;
  readonly withSelectedTopic?: boolean;
} = {}): PersistedIntakeStateV1 {
  return {
    version: 1,
    currentStep,
    recording: {
      status: "completed",
      recordingId: "recording-restored",
      durationMs: 2_000,
      mimeType: "audio/webm",
      byteSize: 5,
    },
    topics: withSelectedTopic
      ? {
          status: "processed",
          sourceRecordingId: "recording-restored",
          suggestions: [{ topicValue: "stress", label: "Stress" }],
          selectedTopicValues: ["stress"],
        }
      : { status: "unavailable" },
    unfinishedRecordingAttemptId,
  };
}

export function createDeferred<T>(): {
  readonly promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolvePromise: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(value): void {
      resolvePromise?.(value);
      resolvePromise = null;
    },
  };
}
