import { getCommittedRecording } from "./intakeReducer";
import type { IntakeWorkflowState } from "./intakeTypes";

export type IntakeStep = "record" | "topics" | "matches";

export function canAccessIntakeStep(
  state: IntakeWorkflowState,
  step: IntakeStep,
): boolean {
  const committedRecording = getCommittedRecording(state.recording);

  switch (step) {
    case "record":
      return true;
    case "topics":
      return committedRecording !== null;
    case "matches":
      return (
        committedRecording !== null &&
        state.topics.status === "processed" &&
        state.topics.sourceRecordingId === committedRecording.recordingId &&
        state.topics.selectedTopicValues.length > 0
      );
    default:
      return assertNever(step);
  }
}

export function getNearestValidIntakeStep(
  state: IntakeWorkflowState,
  requested: IntakeStep,
): IntakeStep {
  if (canAccessIntakeStep(state, requested)) {
    return requested;
  }

  switch (requested) {
    case "matches":
      return canAccessIntakeStep(state, "topics") ? "topics" : "record";
    case "topics":
    case "record":
      return "record";
    default:
      return assertNever(requested);
  }
}

function assertNever(unhandledStep: never): never {
  void unhandledStep;
  throw new Error("Unhandled intake step.");
}
