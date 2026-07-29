import { describe, expect, it } from "vitest";

import {
  initialIntakeWorkflowState,
  intakeWorkflowReducer,
} from "./intakeReducer";
import type { IntakeWorkflowState } from "./intakeTypes";

const suggestions = [
  { topicValue: "stress", label: "Stress" },
  { topicValue: "sleep", label: "Sleep problems" },
] as const;

function createSelectedWorkflow(): IntakeWorkflowState {
  const recordedState = intakeWorkflowReducer(initialIntakeWorkflowState, {
    type: "recordingCompleted",
    recordingId: "recording-1",
  });
  const processedState = intakeWorkflowReducer(recordedState, {
    type: "topicsProcessed",
    sourceRecordingId: "recording-1",
    suggestions,
  });

  return intakeWorkflowReducer(processedState, {
    type: "topicSelectionChanged",
    selectedTopicValues: ["stress"],
  });
}

describe("intakeWorkflowReducer", () => {
  it("starts with unavailable downstream workflow state", () => {
    expect(initialIntakeWorkflowState).toEqual({
      recording: { status: "notRecorded" },
      topics: { status: "unavailable" },
      providerSearch: { status: "unavailable" },
    });
  });

  it("invalidates topics and provider search when a recording is replaced", () => {
    const replacedState = intakeWorkflowReducer(createSelectedWorkflow(), {
      type: "recordingReplaced",
      recordingId: "recording-2",
    });

    expect(replacedState).toEqual({
      recording: { status: "completed", recordingId: "recording-2" },
      topics: { status: "unavailable" },
      providerSearch: { status: "unavailable" },
    });
  });

  it("ignores topics produced for a stale recording", () => {
    const recordedState = intakeWorkflowReducer(initialIntakeWorkflowState, {
      type: "recordingCompleted",
      recordingId: "current-recording",
    });

    const result = intakeWorkflowReducer(recordedState, {
      type: "topicsProcessed",
      sourceRecordingId: "stale-recording",
      suggestions,
    });

    expect(result).toBe(recordedState);
  });

  it("keeps only known unique topics in suggestion order", () => {
    const recordedState = intakeWorkflowReducer(initialIntakeWorkflowState, {
      type: "recordingCompleted",
      recordingId: "recording-1",
    });
    const processedState = intakeWorkflowReducer(recordedState, {
      type: "topicsProcessed",
      sourceRecordingId: "recording-1",
      suggestions,
    });

    const selectedState = intakeWorkflowReducer(processedState, {
      type: "topicSelectionChanged",
      selectedTopicValues: ["sleep", "unknown", "stress", "sleep"],
    });

    expect(selectedState.topics).toMatchObject({
      status: "processed",
      selectedTopicValues: ["stress", "sleep"],
    });
    expect(selectedState.providerSearch).toEqual({
      status: "notStarted",
      selectedTopicValues: ["stress", "sleep"],
    });
  });

  it("preserves state for the same semantic topic selection", () => {
    const selectedState = createSelectedWorkflow();
    const result = intakeWorkflowReducer(selectedState, {
      type: "topicSelectionChanged",
      selectedTopicValues: ["stress", "stress"],
    });

    expect(result).toBe(selectedState);
  });

  it("clears the workflow explicitly", () => {
    const result = intakeWorkflowReducer(createSelectedWorkflow(), {
      type: "progressCleared",
    });

    expect(result).toBe(initialIntakeWorkflowState);
  });
});

