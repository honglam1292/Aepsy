export type RecordingAudioLoadResult =
  | { readonly status: "loaded"; readonly audio: Blob }
  | { readonly status: "notFound" }
  | { readonly status: "unsupported" }
  | { readonly status: "failed" };

export type RecordingAudioSaveResult =
  | { readonly status: "saved" }
  | { readonly status: "unsupported" }
  | { readonly status: "failed" };

export type RecordingAudioDeleteResult =
  | { readonly status: "deleted" }
  | { readonly status: "unsupported" }
  | { readonly status: "failed" };

export type RecordingAudioClearResult =
  | { readonly status: "cleared" }
  | { readonly status: "unsupported" }
  | { readonly status: "failed" };

export type RecordingAudioPruneResult =
  | { readonly status: "pruned" }
  | { readonly status: "unsupported" }
  | { readonly status: "failed" };

export interface RecordingAudioRepository {
  load(recordingId: string): Promise<RecordingAudioLoadResult>;
  save(
    recordingId: string,
    audio: Blob,
  ): Promise<RecordingAudioSaveResult>;
  delete(recordingId: string): Promise<RecordingAudioDeleteResult>;
  prune(
    retainedRecordingId: string | null,
  ): Promise<RecordingAudioPruneResult>;
  clear(): Promise<RecordingAudioClearResult>;
}
