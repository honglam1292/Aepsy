import type {
  IntakeWorkflowEvent,
  IntakeWorkflowState,
  ProviderSearchState,
  TopicSuggestion,
} from "./intakeTypes";

const unavailableProviderSearch: ProviderSearchState = {
  status: "unavailable",
};

export const initialIntakeWorkflowState: IntakeWorkflowState = {
  recording: { status: "notRecorded" },
  topics: { status: "unavailable" },
  providerSearch: unavailableProviderSearch,
};

function replaceRecording(recordingId: string): IntakeWorkflowState {
  return {
    recording: { status: "completed", recordingId },
    topics: { status: "unavailable" },
    providerSearch: unavailableProviderSearch,
  };
}

function getCanonicalSelection(
  suggestions: readonly TopicSuggestion[],
  requestedTopicValues: readonly string[],
): readonly string[] {
  const requestedTopics = new Set(requestedTopicValues);
  const selectedTopics = new Set<string>();

  for (const suggestion of suggestions) {
    if (requestedTopics.has(suggestion.topicValue)) {
      selectedTopics.add(suggestion.topicValue);
    }
  }

  return [...selectedTopics];
}

function selectionsMatch(
  currentSelection: readonly string[],
  nextSelection: readonly string[],
): boolean {
  return (
    currentSelection.length === nextSelection.length &&
    currentSelection.every(
      (topicValue, index) => topicValue === nextSelection[index],
    )
  );
}

function assertNever(_event: never): never {
  void _event;
  throw new Error("Unhandled intake workflow event.");
}

export function intakeWorkflowReducer(
  state: IntakeWorkflowState,
  event: IntakeWorkflowEvent,
): IntakeWorkflowState {
  switch (event.type) {
    case "recordingCompleted":
    case "recordingReplaced":
      return replaceRecording(event.recordingId);

    case "topicsProcessed":
      if (
        state.recording.status !== "completed" ||
        state.recording.recordingId !== event.sourceRecordingId
      ) {
        return state;
      }

      return {
        ...state,
        topics: {
          status: "processed",
          sourceRecordingId: event.sourceRecordingId,
          suggestions: event.suggestions,
          selectedTopicValues: [],
        },
        providerSearch: unavailableProviderSearch,
      };

    case "topicSelectionChanged": {
      if (state.topics.status !== "processed") {
        return state;
      }

      const selectedTopicValues = getCanonicalSelection(
        state.topics.suggestions,
        event.selectedTopicValues,
      );

      if (
        selectionsMatch(
          state.topics.selectedTopicValues,
          selectedTopicValues,
        )
      ) {
        return state;
      }

      return {
        ...state,
        topics: {
          ...state.topics,
          selectedTopicValues,
        },
        providerSearch:
          selectedTopicValues.length === 0
            ? unavailableProviderSearch
            : { status: "notStarted", selectedTopicValues },
      };
    }

    case "progressCleared":
      return initialIntakeWorkflowState;

    default:
      return assertNever(event);
  }
}
