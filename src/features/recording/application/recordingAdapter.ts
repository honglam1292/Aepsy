export interface CapturedAudio {
  readonly blob: Blob;
  readonly mimeType: string;
}

export type RecordingStartFailureReason =
  | "unsupported"
  | "permissionDenied"
  | "microphoneNotFound"
  | "microphoneUnavailable"
  | "recorderError";

export type RecordingSessionResult =
  | {
      readonly status: "recorded";
      readonly audio: CapturedAudio;
    }
  | { readonly status: "empty" }
  | {
      readonly status: "interrupted";
      readonly reason: "microphoneEnded" | "browserInterrupted";
    }
  | { readonly status: "error" }
  | { readonly status: "cancelled" };

export interface RecordingSession {
  readonly completion: Promise<RecordingSessionResult>;
  stop(): Promise<RecordingSessionResult>;
  cancel(): Promise<RecordingSessionResult>;
}

export type RecordingStartResult =
  | {
      readonly status: "started";
      readonly session: RecordingSession;
    }
  | {
      readonly status: "failed";
      readonly reason: RecordingStartFailureReason;
    };

export interface RecordingAdapter {
  isSupported(): boolean;
  start(): Promise<RecordingStartResult>;
}

export interface AudioObjectUrlAdapter {
  create(blob: Blob): string;
  revoke(objectUrl: string): void;
}
