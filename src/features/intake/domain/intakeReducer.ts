import type {
  CompletedRecording,
  IntakeWorkflowEvent,
  IntakeWorkflowState,
  RecordingState,
  TopicsState,
  TopicSuggestion,
} from "./intakeTypes";
import {
  createProviderSearchState,
  providerSearchReducer,
  unavailableProviderSearch,
} from "../../providers/domain/providerSearchState";

export const initialIntakeWorkflowState: IntakeWorkflowState = {
  recording: { status: "idle" },
  topics: { status: "unavailable" },
  providerSearch: unavailableProviderSearch,
};

function commitRecording(
  state: IntakeWorkflowState,
  recording: CompletedRecording,
): IntakeWorkflowState {
  return {
    ...state,
    recording: { status: "recorded", recording },
    topics: { status: "unavailable" },
    providerSearch: unavailableProviderSearch,
  };
}

export function getCommittedRecording(
  recording: RecordingState,
): CompletedRecording | null {
  switch (recording.status) {
    case "idle":
      return null;

    case "recorded":
      return recording.recording;

    case "requestingPermission":
    case "recording":
    case "stopping":
    case "interrupted":
    case "unsupported":
    case "error":
      return recording.previousRecording;

    default:
      return assertNever(recording);
  }
}

function isMatchingActiveAttempt(
  recording: RecordingState,
  attemptId: string,
): recording is Extract<
  RecordingState,
  { readonly status: "requestingPermission" | "recording" | "stopping" }
> {
  return (
    (recording.status === "requestingPermission" ||
      recording.status === "recording" ||
      recording.status === "stopping") &&
    recording.attemptId === attemptId
  );
}

function canApplyFailure(
  recording: Extract<
    RecordingState,
    { readonly status: "requestingPermission" | "recording" | "stopping" }
  >,
  reason: Extract<
    IntakeWorkflowEvent,
    { readonly type: "recordingFailed" }
  >["reason"],
): boolean {
  switch (recording.status) {
    case "requestingPermission":
      return reason !== "emptyRecording";
    case "recording":
      return reason === "recorderError";
    case "stopping":
      return reason === "emptyRecording" || reason === "recorderError";
    default:
      return assertNever(recording);
  }
}

function canApplyInterruption(
  recording: Extract<
    RecordingState,
    { readonly status: "requestingPermission" | "recording" | "stopping" }
  >,
  reason: Extract<
    IntakeWorkflowEvent,
    { readonly type: "recordingInterrupted" }
  >["reason"],
): boolean {
  switch (recording.status) {
    case "requestingPermission":
      return reason === "navigation";
    case "recording":
    case "stopping":
      return (
        reason === "microphoneEnded" ||
        reason === "browserInterrupted" ||
        reason === "navigation"
      );
    default:
      return assertNever(recording);
  }
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

function areValidUniqueSuggestions(
  suggestions: readonly TopicSuggestion[],
): boolean {
  if (suggestions.length === 0) {
    return false;
  }

  const topicValues = new Set<string>();
  for (const suggestion of suggestions) {
    if (
      suggestion.topicValue.trim().length === 0 ||
      suggestion.label.trim().length === 0 ||
      topicValues.has(suggestion.topicValue)
    ) {
      return false;
    }
    topicValues.add(suggestion.topicValue);
  }

  return true;
}

function hydrateWorkflow(
  recording: RecordingState,
  topics: TopicsState,
): IntakeWorkflowState {
  const hydratedRecording =
    recording.status === "interrupted" &&
    (recording.reason === "storedAudioMissing" ||
      recording.reason === "storedAudioUnavailable") &&
    recording.previousRecording !== null
      ? { ...recording, previousRecording: null }
      : recording;
  const committedRecording = getCommittedRecording(hydratedRecording);

  if (
    committedRecording === null ||
    topics.status !== "processed" ||
    topics.sourceRecordingId !== committedRecording.recordingId
  ) {
    return {
      recording: hydratedRecording,
      topics: { status: "unavailable" },
      providerSearch: unavailableProviderSearch,
    };
  }

  const selectedTopicValues = getCanonicalSelection(
    topics.suggestions,
    topics.selectedTopicValues,
  );
  const hydratedTopics = selectionsMatch(
    topics.selectedTopicValues,
    selectedTopicValues,
  )
    ? topics
    : { ...topics, selectedTopicValues };

  return {
    recording: hydratedRecording,
    topics: hydratedTopics,
    providerSearch: createProviderSearchState(selectedTopicValues),
  };
}

function assertNever(unhandledValue: never): never {
  void unhandledValue;
  throw new Error("Unhandled intake workflow value.");
}

export function intakeWorkflowReducer(
  state: IntakeWorkflowState,
  event: IntakeWorkflowEvent,
): IntakeWorkflowState {
  switch (event.type) {
    case "recordingStartRequested": {
      if (
        state.recording.status === "requestingPermission" ||
        state.recording.status === "recording" ||
        state.recording.status === "stopping"
      ) {
        return state;
      }

      const previousRecording = getCommittedRecording(state.recording);

      return {
        ...state,
        recording: {
          status: "requestingPermission",
          attemptId: event.attemptId,
          previousRecording,
        },
        topics:
          previousRecording === null
            ? state.topics
            : { status: "unavailable" },
        providerSearch:
          previousRecording === null
            ? state.providerSearch
            : unavailableProviderSearch,
      };
    }

    case "recordingStarted":
      if (
        state.recording.status !== "requestingPermission" ||
        state.recording.attemptId !== event.attemptId
      ) {
        return state;
      }

      return {
        ...state,
        recording: {
          status: "recording",
          attemptId: event.attemptId,
          startedAtEpochMs: event.startedAtEpochMs,
          previousRecording: state.recording.previousRecording,
        },
      };

    case "recordingStopRequested":
      if (
        state.recording.status !== "recording" ||
        state.recording.attemptId !== event.attemptId
      ) {
        return state;
      }

      return {
        ...state,
        recording: {
          status: "stopping",
          attemptId: event.attemptId,
          startedAtEpochMs: state.recording.startedAtEpochMs,
          previousRecording: state.recording.previousRecording,
        },
      };

    case "recordingCompleted":
      if (
        state.recording.status !== "stopping" ||
        state.recording.attemptId !== event.attemptId ||
        state.recording.previousRecording !== null
      ) {
        return state;
      }

      return commitRecording(state, event.recording);

    case "recordingReplaced":
      if (
        state.recording.status !== "stopping" ||
        state.recording.attemptId !== event.attemptId ||
        state.recording.previousRecording === null
      ) {
        return state;
      }

      return commitRecording(state, event.recording);

    case "recordingInterrupted":
      if (
        !isMatchingActiveAttempt(state.recording, event.attemptId) ||
        !canApplyInterruption(state.recording, event.reason)
      ) {
        return state;
      }

      return {
        ...state,
        recording: {
          status: "interrupted",
          attemptId: event.attemptId,
          reason: event.reason,
          previousRecording: state.recording.previousRecording,
        },
      };

    case "recordingUnsupported":
      if (
        state.recording.status !== "requestingPermission" ||
        state.recording.attemptId !== event.attemptId
      ) {
        return state;
      }

      return {
        ...state,
        recording: {
          status: "unsupported",
          attemptId: event.attemptId,
          previousRecording: state.recording.previousRecording,
        },
      };

    case "recordingFailed":
      if (
        !isMatchingActiveAttempt(state.recording, event.attemptId) ||
        !canApplyFailure(state.recording, event.reason)
      ) {
        return state;
      }

      return {
        ...state,
        recording: {
          status: "error",
          attemptId: event.attemptId,
          reason: event.reason,
          previousRecording: state.recording.previousRecording,
        },
      };

    case "recordingCancelled":
      if (!isMatchingActiveAttempt(state.recording, event.attemptId)) {
        return state;
      }

      return {
        ...state,
        recording: {
          status: "interrupted",
          attemptId: event.attemptId,
          reason: "navigation",
          previousRecording: state.recording.previousRecording,
        },
      };

    case "topicProcessingStarted":
      if (
        getCommittedRecording(state.recording)?.recordingId !==
        event.sourceRecordingId
      ) {
        return state;
      }

      if (
        state.topics.status === "processing" ||
        (state.topics.status === "processed" &&
          state.topics.sourceRecordingId === event.sourceRecordingId)
      ) {
        return state;
      }

      return {
        ...state,
        topics: {
          status: "processing",
          sourceRecordingId: event.sourceRecordingId,
          requestId: event.requestId,
        },
        providerSearch: unavailableProviderSearch,
      };

    case "topicsProcessed":
      if (
        state.topics.status !== "processing" ||
        state.topics.sourceRecordingId !== event.sourceRecordingId ||
        state.topics.requestId !== event.requestId ||
        !areValidUniqueSuggestions(event.suggestions)
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

    case "topicProcessingEmpty":
      if (
        state.topics.status !== "processing" ||
        state.topics.sourceRecordingId !== event.sourceRecordingId ||
        state.topics.requestId !== event.requestId
      ) {
        return state;
      }

      return {
        ...state,
        topics: {
          status: "empty",
          sourceRecordingId: event.sourceRecordingId,
          requestId: event.requestId,
        },
        providerSearch: unavailableProviderSearch,
      };

    case "topicProcessingFailed":
      if (
        state.topics.status !== "processing" ||
        state.topics.sourceRecordingId !== event.sourceRecordingId ||
        state.topics.requestId !== event.requestId
      ) {
        return state;
      }

      return {
        ...state,
        topics: {
          status: "error",
          sourceRecordingId: event.sourceRecordingId,
          requestId: event.requestId,
          reason: event.reason,
        },
        providerSearch: unavailableProviderSearch,
      };

    case "topicProcessingCancelled":
      if (
        state.topics.status !== "processing" ||
        state.topics.sourceRecordingId !== event.sourceRecordingId ||
        state.topics.requestId !== event.requestId
      ) {
        return state;
      }

      return {
        ...state,
        topics: { status: "unavailable" },
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
        providerSearch: createProviderSearchState(selectedTopicValues),
      };
    }

    case "providerSearchStarted":
    case "providerSearchSucceeded":
    case "providerSearchFailed":
    case "providerSearchCancelled":
    case "providerPageLoadStarted":
    case "providerPageLoaded":
    case "providerPageLoadFailed":
    case "providerPageLoadCancelled": {
      const providerSearch = providerSearchReducer(
        state.providerSearch,
        event,
      );
      return providerSearch === state.providerSearch
        ? state
        : { ...state, providerSearch };
    }

    case "workflowHydrated":
      return hydrateWorkflow(event.recording, event.topics);

    case "progressCleared":
      return initialIntakeWorkflowState;

    default:
      return assertNever(event);
  }
}
