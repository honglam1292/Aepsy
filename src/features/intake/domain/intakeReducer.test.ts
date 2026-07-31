import { describe, expect, it } from "vitest";

import {
  getCommittedRecording,
  initialIntakeWorkflowState,
  intakeWorkflowReducer,
} from "./intakeReducer";
import type {
  CompletedRecording,
  IntakeWorkflowEvent,
  IntakeWorkflowState,
} from "./intakeTypes";

const completedRecording: CompletedRecording = {
  recordingId: "recording-1",
  mimeType: "audio/webm",
  byteSize: 12,
  durationMs: 2_500,
};

const topicSuggestions = [
  { topicValue: "U_DIS_STRESS", label: "Stress" },
  { topicValue: "U_DIS_ANXIETY", label: "Anxiety" },
] as const;

function reduceEvents(
  initialState: IntakeWorkflowState,
  events: readonly IntakeWorkflowEvent[],
): IntakeWorkflowState {
  return events.reduce(intakeWorkflowReducer, initialState);
}

function createCompletedWorkflow(): IntakeWorkflowState {
  return reduceEvents(initialIntakeWorkflowState, [
    { type: "recordingStartRequested", attemptId: "recording-1" },
    {
      type: "recordingStarted",
      attemptId: "recording-1",
      startedAtEpochMs: 1_000,
    },
    { type: "recordingStopRequested", attemptId: "recording-1" },
    {
      type: "recordingCompleted",
      attemptId: "recording-1",
      recording: completedRecording,
    },
    {
      type: "topicProcessingStarted",
      sourceRecordingId: "recording-1",
      requestId: "topics-1",
    },
    {
      type: "topicsProcessed",
      sourceRecordingId: "recording-1",
      requestId: "topics-1",
      suggestions: topicSuggestions,
    },
    {
      type: "topicSelectionChanged",
      selectedTopicValues: ["U_DIS_STRESS"],
    },
    {
      type: "providerSearchStarted",
      selectedTopicValues: ["U_DIS_STRESS"],
      searchId: "providers-1",
      requestId: "providers-page-1",
      pageNumber: 1,
    },
    {
      type: "providerSearchSucceeded",
      searchId: "providers-1",
      requestId: "providers-page-1",
      pageNumber: 1,
      page: {
        items: [
          {
            providerId: "provider-1",
            displayName: "Alex Meyer",
            avatarUrl: null,
            professionalTitle: "Psychologist",
            yearsExperience: 8,
            highlights: [],
          },
        ],
        totalSize: 12,
        canLoadMore: true,
      },
    },
    {
      type: "providerPageLoadStarted",
      searchId: "providers-1",
      requestId: "providers-page-2",
      pageNumber: 2,
    },
  ]);
}

describe("intakeWorkflowReducer", () => {
  it("commits completed audio but never treats an interrupted attempt as completed", () => {
    const stoppedState = reduceEvents(initialIntakeWorkflowState, [
      { type: "recordingStartRequested", attemptId: "recording-1" },
      {
        type: "recordingStarted",
        attemptId: "recording-1",
        startedAtEpochMs: 1_000,
      },
      { type: "recordingStopRequested", attemptId: "recording-1" },
    ]);
    const completedState = intakeWorkflowReducer(stoppedState, {
      type: "recordingCompleted",
      attemptId: "recording-1",
      recording: completedRecording,
    });

    expect(completedState.recording).toEqual({
      status: "recorded",
      recording: completedRecording,
    });
    expect(getCommittedRecording(completedState.recording)).toEqual(
      completedRecording,
    );

    const interruptedState = reduceEvents(initialIntakeWorkflowState, [
      { type: "recordingStartRequested", attemptId: "recording-2" },
      {
        type: "recordingStarted",
        attemptId: "recording-2",
        startedAtEpochMs: 2_000,
      },
      {
        type: "recordingInterrupted",
        attemptId: "recording-2",
        reason: "microphoneEnded",
      },
    ]);

    expect(interruptedState.recording.status).toBe("interrupted");
    expect(getCommittedRecording(interruptedState.recording)).toBeNull();
  });

  it("invalidates topics and provider pagination when a recording is replaced", () => {
    const currentState = createCompletedWorkflow();
    const replacementInProgress = reduceEvents(currentState, [
      { type: "recordingStartRequested", attemptId: "recording-2" },
      {
        type: "recordingStarted",
        attemptId: "recording-2",
        startedAtEpochMs: 3_000,
      },
      { type: "recordingStopRequested", attemptId: "recording-2" },
    ]);
    const replacement = {
      ...completedRecording,
      recordingId: "recording-2",
    };
    const nextState = intakeWorkflowReducer(replacementInProgress, {
      type: "recordingReplaced",
      attemptId: "recording-2",
      recording: replacement,
    });

    expect(nextState.recording).toEqual({
      status: "recorded",
      recording: replacement,
    });
    expect(nextState.topics).toEqual({ status: "unavailable" });
    expect(nextState.providerSearch).toEqual({ status: "unavailable" });
  });

  it("resets provider results and pagination when selected topics change", () => {
    const currentState = createCompletedWorkflow();

    const nextState = intakeWorkflowReducer(currentState, {
      type: "topicSelectionChanged",
      selectedTopicValues: ["U_DIS_STRESS", "U_DIS_ANXIETY"],
    });

    expect(nextState.topics).toMatchObject({
      status: "processed",
      selectedTopicValues: ["U_DIS_STRESS", "U_DIS_ANXIETY"],
    });
    expect(nextState.providerSearch).toEqual({
      status: "notStarted",
      selectedTopicValues: ["U_DIS_STRESS", "U_DIS_ANXIETY"],
    });
  });

  it("returns the workflow to its initial state when progress is cleared", () => {
    const nextState = intakeWorkflowReducer(createCompletedWorkflow(), {
      type: "progressCleared",
    });

    expect(nextState).toEqual(initialIntakeWorkflowState);
  });
});
