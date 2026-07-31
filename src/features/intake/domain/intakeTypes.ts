import type {
  ProviderSearchEvent,
  ProviderSearchState,
} from "../../providers/domain/providerSearchState";

export type { ProviderSearchState } from "../../providers/domain/providerSearchState";

export interface TopicSuggestion {
  readonly topicValue: string;
  readonly label: string;
}

export interface CompletedRecording {
  readonly recordingId: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly durationMs: number;
}

export type TopicProcessingFailureReason =
  | "audioUnavailable"
  | "processingFailed";

export type RecordingFailureReason =
  | "permissionDenied"
  | "microphoneNotFound"
  | "microphoneUnavailable"
  | "emptyRecording"
  | "recorderError";

export type RecordingInterruptionReason =
  | "microphoneEnded"
  | "browserInterrupted"
  | "navigation"
  | "browserReload"
  | "storedAudioMissing"
  | "storedAudioUnavailable";

export type RecordingState =
  | { readonly status: "idle" }
  | {
      readonly status: "requestingPermission";
      readonly attemptId: string;
      readonly previousRecording: CompletedRecording | null;
    }
  | {
      readonly status: "recording";
      readonly attemptId: string;
      readonly startedAtEpochMs: number;
      readonly previousRecording: CompletedRecording | null;
    }
  | {
      readonly status: "stopping";
      readonly attemptId: string;
      readonly startedAtEpochMs: number;
      readonly previousRecording: CompletedRecording | null;
    }
  | {
      readonly status: "recorded";
      readonly recording: CompletedRecording;
    }
  | {
      readonly status: "interrupted";
      readonly attemptId: string;
      readonly reason: RecordingInterruptionReason;
      readonly previousRecording: CompletedRecording | null;
    }
  | {
      readonly status: "unsupported";
      readonly attemptId: string;
      readonly previousRecording: CompletedRecording | null;
    }
  | {
      readonly status: "error";
      readonly attemptId: string;
      readonly reason: RecordingFailureReason;
      readonly previousRecording: CompletedRecording | null;
    };

export type TopicsState =
  | { readonly status: "unavailable" }
  | {
      readonly status: "processing";
      readonly sourceRecordingId: string;
      readonly requestId: string;
    }
  | {
      readonly status: "empty";
      readonly sourceRecordingId: string;
      readonly requestId: string;
    }
  | {
      readonly status: "error";
      readonly sourceRecordingId: string;
      readonly requestId: string;
      readonly reason: TopicProcessingFailureReason;
    }
  | {
      readonly status: "processed";
      readonly sourceRecordingId: string;
      readonly suggestions: readonly TopicSuggestion[];
      readonly selectedTopicValues: readonly string[];
    };

export interface IntakeWorkflowState {
  readonly recording: RecordingState;
  readonly topics: TopicsState;
  readonly providerSearch: ProviderSearchState;
}

export type IntakeWorkflowEvent =
  | {
      readonly type: "recordingStartRequested";
      readonly attemptId: string;
    }
  | {
      readonly type: "recordingStarted";
      readonly attemptId: string;
      readonly startedAtEpochMs: number;
    }
  | {
      readonly type: "recordingStopRequested";
      readonly attemptId: string;
    }
  | {
      readonly type: "recordingCompleted";
      readonly attemptId: string;
      readonly recording: CompletedRecording;
    }
  | {
      readonly type: "recordingReplaced";
      readonly attemptId: string;
      readonly recording: CompletedRecording;
    }
  | {
      readonly type: "recordingInterrupted";
      readonly attemptId: string;
      readonly reason: RecordingInterruptionReason;
    }
  | {
      readonly type: "recordingUnsupported";
      readonly attemptId: string;
    }
  | {
      readonly type: "recordingFailed";
      readonly attemptId: string;
      readonly reason: RecordingFailureReason;
    }
  | {
      readonly type: "recordingCancelled";
      readonly attemptId: string;
    }
  | {
      readonly type: "topicProcessingStarted";
      readonly sourceRecordingId: string;
      readonly requestId: string;
    }
  | {
      readonly type: "topicsProcessed";
      readonly sourceRecordingId: string;
      readonly requestId: string;
      readonly suggestions: readonly TopicSuggestion[];
    }
  | {
      readonly type: "topicProcessingEmpty";
      readonly sourceRecordingId: string;
      readonly requestId: string;
    }
  | {
      readonly type: "topicProcessingFailed";
      readonly sourceRecordingId: string;
      readonly requestId: string;
      readonly reason: TopicProcessingFailureReason;
    }
  | {
      readonly type: "topicProcessingCancelled";
      readonly sourceRecordingId: string;
      readonly requestId: string;
    }
  | {
      readonly type: "topicSelectionChanged";
      readonly selectedTopicValues: readonly string[];
    }
  | {
      readonly type: "workflowHydrated";
      readonly recording: RecordingState;
      readonly topics: TopicsState;
    }
  | ProviderSearchEvent
  | { readonly type: "progressCleared" };
