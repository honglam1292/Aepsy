import type {
  RecordingAdapter,
  RecordingSession,
  RecordingSessionResult,
  RecordingStartFailureReason,
  RecordingStartResult,
} from "../application/recordingAdapter";

const preferredAudioMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
] as const;

const stopTimeoutMilliseconds = 5_000;

export type RecorderPortState = "inactive" | "recording" | "paused";

export interface RecorderPort {
  getState(): RecorderPortState;
  getMimeType(): string;
  start(): void;
  stop(): void;
  subscribeToData(listener: (chunk: Blob) => void): () => void;
  subscribeToStop(listener: () => void): () => void;
  subscribeToError(listener: () => void): () => void;
}

export interface TrackPort {
  stop(): void;
  subscribeToEnded(listener: () => void): () => void;
}

export interface OpenCaptureResult {
  readonly recorder: RecorderPort;
  readonly tracks: readonly TrackPort[];
  readonly audioTrackCount: number;
}

export interface RecordingRuntime {
  isAvailable(): boolean;
  supportsMimeType(mimeType: string): boolean;
  openCapture(mimeType: string | null): Promise<OpenCaptureResult>;
}

type SessionStartResult =
  | { readonly status: "started" }
  | { readonly status: "failed"; readonly error: unknown };

function stopTracks(tracks: readonly TrackPort[]): void {
  for (const track of tracks) {
    try {
      track.stop();
    } catch {
      // A failed track cannot be released any further by this capture.
    }
  }
}

function getMediaDevices(): MediaDevices | null {
  try {
    if (typeof navigator === "undefined") {
      return null;
    }

    const mediaDevices = navigator.mediaDevices;
    return typeof mediaDevices?.getUserMedia === "function"
      ? mediaDevices
      : null;
  } catch {
    return null;
  }
}

function getMediaRecorderConstructor(): typeof MediaRecorder | null {
  try {
    return typeof MediaRecorder === "function" ? MediaRecorder : null;
  } catch {
    return null;
  }
}

function wrapRecorder(recorder: MediaRecorder): RecorderPort {
  return {
    getState: () => recorder.state,
    getMimeType: () => recorder.mimeType,
    start: () => recorder.start(),
    stop: () => recorder.stop(),
    subscribeToData(listener): () => void {
      const handleData = (event: BlobEvent): void => {
        listener(event.data);
      };
      recorder.addEventListener("dataavailable", handleData);
      return () => recorder.removeEventListener("dataavailable", handleData);
    },
    subscribeToStop(listener): () => void {
      const handleStop = (): void => listener();
      recorder.addEventListener("stop", handleStop);
      return () => recorder.removeEventListener("stop", handleStop);
    },
    subscribeToError(listener): () => void {
      const handleError = (): void => listener();
      recorder.addEventListener("error", handleError);
      return () => recorder.removeEventListener("error", handleError);
    },
  };
}

function wrapTrack(track: MediaStreamTrack): TrackPort {
  return {
    stop: () => track.stop(),
    subscribeToEnded(listener): () => void {
      const handleEnded = (): void => listener();
      track.addEventListener("ended", handleEnded);
      return () => track.removeEventListener("ended", handleEnded);
    },
  };
}

const browserRecordingRuntime: RecordingRuntime = {
  isAvailable(): boolean {
    return (
      getMediaDevices() !== null && getMediaRecorderConstructor() !== null
    );
  },

  supportsMimeType(mimeType: string): boolean {
    const Recorder = getMediaRecorderConstructor();
    if (Recorder === null || typeof Recorder.isTypeSupported !== "function") {
      return false;
    }

    try {
      return Recorder.isTypeSupported(mimeType);
    } catch {
      return false;
    }
  },

  async openCapture(mimeType: string | null): Promise<OpenCaptureResult> {
    const mediaDevices = getMediaDevices();
    const Recorder = getMediaRecorderConstructor();

    if (mediaDevices === null || Recorder === null) {
      throw new Error("Browser recording APIs are unavailable.");
    }

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    try {
      let recorder: MediaRecorder;

      if (mimeType === null) {
        recorder = new Recorder(stream);
      } else {
        try {
          recorder = new Recorder(stream, { mimeType });
        } catch {
          // Support checks are advisory, so let the browser choose a fallback.
          recorder = new Recorder(stream);
        }
      }

      return {
        recorder: wrapRecorder(recorder),
        tracks: stream.getTracks().map(wrapTrack),
        audioTrackCount: stream.getAudioTracks().length,
      };
    } catch (error: unknown) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // The stream is already unusable after recorder setup fails.
        }
      }
      throw error;
    }
  },
};

export function selectSupportedAudioMimeType(
  runtime: RecordingRuntime,
): string | null {
  for (const mimeType of preferredAudioMimeTypes) {
    if (runtime.supportsMimeType(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

export function mapRecordingStartFailure(
  error: unknown,
): RecordingStartFailureReason {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return "recorderError";
  }

  const { name } = error;
  if (typeof name !== "string") {
    return "recorderError";
  }

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "permissionDenied";

    case "NotFoundError":
    case "DevicesNotFoundError":
      return "microphoneNotFound";

    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
    case "OverconstrainedError":
      return "microphoneUnavailable";

    default:
      return "recorderError";
  }
}

class BrowserRecordingSession implements RecordingSession {
  readonly completion: Promise<RecordingSessionResult>;

  private readonly chunks: Blob[] = [];
  private readonly recorder: RecorderPort;
  private readonly tracks: readonly TrackPort[];
  private readonly selectedMimeType: string | null;
  private readonly unsubscribeListeners: Array<() => void> = [];
  private resolveCompletion:
    | ((result: RecordingSessionResult) => void)
    | null = null;
  private stopTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
  private isSettled = false;
  private isStopRequested = false;
  private isNativeStopRequested = false;

  constructor(
    recorder: RecorderPort,
    tracks: readonly TrackPort[],
    selectedMimeType: string | null,
  ) {
    this.recorder = recorder;
    this.tracks = tracks;
    this.selectedMimeType = selectedMimeType;
    this.completion = new Promise((resolve) => {
      this.resolveCompletion = resolve;
    });
  }

  start(): SessionStartResult {
    try {
      this.unsubscribeListeners.push(
        this.recorder.subscribeToData((chunk) => {
          if (!this.isSettled && chunk.size > 0) {
            this.chunks.push(chunk);
          }
        }),
      );
      this.unsubscribeListeners.push(
        this.recorder.subscribeToStop(() => this.handleRecorderStop()),
      );
      this.unsubscribeListeners.push(
        this.recorder.subscribeToError(() => {
          this.settle({ status: "error" });
        }),
      );
      for (const track of this.tracks) {
        this.unsubscribeListeners.push(
          track.subscribeToEnded(() => {
            if (!this.isStopRequested) {
              this.settle({
                status: "interrupted",
                reason: "microphoneEnded",
              });
            }
          }),
        );
      }
      this.recorder.start();
      return { status: "started" };
    } catch (error: unknown) {
      this.settle({ status: "error" });
      return { status: "failed", error };
    }
  }

  stop(): Promise<RecordingSessionResult> {
    if (this.isSettled || this.isStopRequested) {
      return this.completion;
    }

    this.isStopRequested = true;
    this.stopTimeout = globalThis.setTimeout(() => {
      this.settle({ status: "error" });
    }, stopTimeoutMilliseconds);

    try {
      this.requestNativeStop();
    } catch {
      this.settle({ status: "error" });
    }

    return this.completion;
  }

  cancel(): Promise<RecordingSessionResult> {
    this.settle({ status: "cancelled" });
    return this.completion;
  }

  private handleRecorderStop(): void {
    if (this.isSettled) {
      return;
    }

    if (!this.isStopRequested) {
      this.settle({
        status: "interrupted",
        reason: "browserInterrupted",
      });
      return;
    }

    try {
      const mimeType =
        this.recorder.getMimeType().trim() ||
        this.selectedMimeType ||
        this.chunks.find((chunk) => chunk.type.length > 0)?.type ||
        "";
      const audio =
        mimeType.length === 0
          ? new Blob(this.chunks)
          : new Blob(this.chunks, { type: mimeType });

      this.settle(
        audio.size === 0
          ? { status: "empty" }
          : { status: "recorded", audio: { blob: audio, mimeType } },
      );
    } catch {
      this.settle({ status: "error" });
    }
  }

  private requestNativeStop(): void {
    if (this.isNativeStopRequested || this.recorder.getState() === "inactive") {
      return;
    }

    this.isNativeStopRequested = true;
    this.recorder.stop();
  }

  private settle(result: RecordingSessionResult): void {
    if (this.isSettled) {
      return;
    }

    this.isSettled = true;

    if (this.stopTimeout !== null) {
      globalThis.clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    for (const unsubscribe of this.unsubscribeListeners.splice(0)) {
      try {
        unsubscribe();
      } catch {
        // Remaining listeners and tracks still need their cleanup attempts.
      }
    }

    try {
      this.requestNativeStop();
    } catch {
      // Track shutdown below is the remaining cleanup path.
    }

    stopTracks(this.tracks);
    this.resolveCompletion?.(result);
    this.resolveCompletion = null;
  }
}

export function createBrowserRecordingAdapter(
  runtime: RecordingRuntime = browserRecordingRuntime,
): RecordingAdapter {
  return {
    isSupported: () => runtime.isAvailable(),

    async start(): Promise<RecordingStartResult> {
      try {
        if (!runtime.isAvailable()) {
          return { status: "failed", reason: "unsupported" };
        }

        const mimeType = selectSupportedAudioMimeType(runtime);
        const capture = await runtime.openCapture(mimeType);

        if (capture.audioTrackCount === 0) {
          stopTracks(capture.tracks);
          return { status: "failed", reason: "microphoneNotFound" };
        }

        const session = new BrowserRecordingSession(
          capture.recorder,
          capture.tracks,
          mimeType,
        );
        const sessionStart = session.start();

        if (sessionStart.status === "failed") {
          return {
            status: "failed",
            reason: mapRecordingStartFailure(sessionStart.error),
          };
        }

        return { status: "started", session };
      } catch (error: unknown) {
        return {
          status: "failed",
          reason: mapRecordingStartFailure(error),
        };
      }
    },
  };
}

export const browserRecordingAdapter = createBrowserRecordingAdapter();
