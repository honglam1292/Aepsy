import type {
  IntakeMetadataClearResult,
  IntakeMetadataLoadResult,
  IntakeMetadataRepository,
  IntakeMetadataSaveResult,
} from "../features/intake/application/intakePersistence";
import type { PersistedIntakeStateV1 } from "../features/intake/persistence/persistedIntakeState";
import type {
  RecordingAudioClearResult,
  RecordingAudioDeleteResult,
  RecordingAudioLoadResult,
  RecordingAudioPruneResult,
  RecordingAudioRepository,
  RecordingAudioSaveResult,
} from "../features/recording/application/recordingAudioRepository";
import type { AudioObjectUrlAdapter } from "../features/recording/application/recordingAdapter";

export class MemoryMetadataRepository implements IntakeMetadataRepository {
  storedState: PersistedIntakeStateV1 | null;
  loadResult: IntakeMetadataLoadResult | null = null;

  constructor(storedState: PersistedIntakeStateV1 | null = null) {
    this.storedState = storedState;
  }

  load(): IntakeMetadataLoadResult {
    if (this.loadResult !== null) {
      return this.loadResult;
    }

    return this.storedState === null
      ? { status: "empty" }
      : { status: "loaded", state: this.storedState };
  }

  save(state: PersistedIntakeStateV1): IntakeMetadataSaveResult {
    this.storedState = state;
    return { status: "saved" };
  }

  clear(): IntakeMetadataClearResult {
    this.storedState = null;
    return { status: "cleared" };
  }
}

export class MemoryAudioRepository implements RecordingAudioRepository {
  readonly storedAudio = new Map<string, Blob>();

  async load(recordingId: string): Promise<RecordingAudioLoadResult> {
    const audio = this.storedAudio.get(recordingId);
    return audio === undefined
      ? { status: "notFound" }
      : { status: "loaded", audio };
  }

  async save(
    recordingId: string,
    audio: Blob,
  ): Promise<RecordingAudioSaveResult> {
    this.storedAudio.set(recordingId, audio);
    return { status: "saved" };
  }

  async delete(recordingId: string): Promise<RecordingAudioDeleteResult> {
    this.storedAudio.delete(recordingId);
    return { status: "deleted" };
  }

  async prune(
    retainedRecordingId: string | null,
  ): Promise<RecordingAudioPruneResult> {
    for (const recordingId of this.storedAudio.keys()) {
      if (recordingId !== retainedRecordingId) {
        this.storedAudio.delete(recordingId);
      }
    }
    return { status: "pruned" };
  }

  async clear(): Promise<RecordingAudioClearResult> {
    this.storedAudio.clear();
    return { status: "cleared" };
  }
}

export class DeterministicObjectUrlAdapter implements AudioObjectUrlAdapter {
  readonly createdBlobs: Blob[] = [];
  readonly revokedUrls: string[] = [];

  create(blob: Blob): string {
    this.createdBlobs.push(blob);
    return `blob:test-audio-${this.createdBlobs.length}`;
  }

  revoke(objectUrl: string): void {
    this.revokedUrls.push(objectUrl);
  }
}

export interface Deferred<Value> {
  readonly promise: Promise<Value>;
  resolve(value: Value): void;
  reject(reason?: unknown): void;
}

export function createDeferred<Value>(): Deferred<Value> {
  let resolvePromise: ((value: Value) => void) | null = null;
  let rejectPromise: ((reason?: unknown) => void) | null = null;
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve(value): void {
      resolvePromise?.(value);
    },
    reject(reason): void {
      rejectPromise?.(reason);
    },
  };
}
