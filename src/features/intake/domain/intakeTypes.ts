export interface TopicSuggestion {
  readonly topicValue: string;
  readonly label: string;
}

export type RecordingState =
  | { readonly status: "notRecorded" }
  | {
      readonly status: "completed";
      readonly recordingId: string;
    };

export type TopicsState =
  | { readonly status: "unavailable" }
  | {
      readonly status: "processed";
      readonly sourceRecordingId: string;
      readonly suggestions: readonly TopicSuggestion[];
      readonly selectedTopicValues: readonly string[];
    };

export type ProviderSearchState =
  | { readonly status: "unavailable" }
  | {
      readonly status: "notStarted";
      readonly selectedTopicValues: readonly string[];
    };

export interface IntakeWorkflowState {
  readonly recording: RecordingState;
  readonly topics: TopicsState;
  readonly providerSearch: ProviderSearchState;
}

export type IntakeWorkflowEvent =
  | {
      readonly type: "recordingCompleted";
      readonly recordingId: string;
    }
  | {
      readonly type: "recordingReplaced";
      readonly recordingId: string;
    }
  | {
      readonly type: "topicsProcessed";
      readonly sourceRecordingId: string;
      readonly suggestions: readonly TopicSuggestion[];
    }
  | {
      readonly type: "topicSelectionChanged";
      readonly selectedTopicValues: readonly string[];
    }
  | { readonly type: "progressCleared" };

