import type { IntakeStep } from "../domain/intakeProgress";
import type { TopicSuggestion } from "../domain/intakeTypes";

export const PERSISTED_INTAKE_STATE_VERSION = 1 as const;

export type PersistedRecordingState =
  | { readonly status: "none" }
  | {
      readonly status: "completed";
      readonly recordingId: string;
      readonly durationMs: number;
      readonly mimeType: string;
      readonly byteSize: number;
    };

export type PersistedTopicsState =
  | { readonly status: "unavailable" }
  | {
      readonly status: "processed";
      readonly sourceRecordingId: string;
      readonly suggestions: readonly TopicSuggestion[];
      readonly selectedTopicValues: readonly string[];
    };

export interface PersistedIntakeStateV1 {
  readonly version: typeof PERSISTED_INTAKE_STATE_VERSION;
  readonly currentStep: IntakeStep;
  readonly recording: PersistedRecordingState;
  readonly topics: PersistedTopicsState;
  readonly unfinishedRecordingAttemptId: string | null;
}

export type PersistedIntakeStateValidationResult =
  | { readonly status: "valid"; readonly state: PersistedIntakeStateV1 }
  | { readonly status: "invalid" }
  | { readonly status: "versionMismatch" };

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasExactKeys(
  record: Readonly<Record<string, unknown>>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(record);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => expectedKeys.includes(key))
  );
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}

function isNonNegativeSafeInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && typeof input === "number" && input >= 0;
}

function isPositiveSafeInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && typeof input === "number" && input > 0;
}

function parseRecordingState(input: unknown): PersistedRecordingState | null {
  if (!isRecord(input)) {
    return null;
  }

  if (input.status === "none") {
    return hasExactKeys(input, ["status"]) ? { status: "none" } : null;
  }

  if (
    input.status !== "completed" ||
    !hasExactKeys(input, [
      "status",
      "recordingId",
      "durationMs",
      "mimeType",
      "byteSize",
    ]) ||
    !isNonEmptyString(input.recordingId) ||
    !isNonNegativeSafeInteger(input.durationMs) ||
    typeof input.mimeType !== "string" ||
    input.mimeType.trim() !== input.mimeType ||
    !isPositiveSafeInteger(input.byteSize)
  ) {
    return null;
  }

  return {
    status: "completed",
    recordingId: input.recordingId,
    durationMs: input.durationMs,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
  };
}

function parseTopicSuggestions(
  input: unknown,
): readonly TopicSuggestion[] | null {
  if (!Array.isArray(input) || input.length === 0) {
    return null;
  }

  const topicValues = new Set<string>();
  const suggestions: TopicSuggestion[] = [];

  for (const suggestion of input) {
    if (
      !isRecord(suggestion) ||
      !hasExactKeys(suggestion, ["topicValue", "label"]) ||
      !isNonEmptyString(suggestion.topicValue) ||
      !isNonEmptyString(suggestion.label) ||
      topicValues.has(suggestion.topicValue)
    ) {
      return null;
    }

    topicValues.add(suggestion.topicValue);
    suggestions.push({
      topicValue: suggestion.topicValue,
      label: suggestion.label,
    });
  }

  return suggestions;
}

function parseSelectedTopicValues(input: unknown): readonly string[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const selectedTopicValues = new Set<string>();

  for (const topicValue of input) {
    if (!isNonEmptyString(topicValue) || selectedTopicValues.has(topicValue)) {
      return null;
    }

    selectedTopicValues.add(topicValue);
  }

  return [...selectedTopicValues];
}

function parseTopicsState(input: unknown): PersistedTopicsState | null {
  if (!isRecord(input)) {
    return null;
  }

  if (input.status === "unavailable") {
    return hasExactKeys(input, ["status"])
      ? { status: "unavailable" }
      : null;
  }

  if (
    input.status !== "processed" ||
    !hasExactKeys(input, [
      "status",
      "sourceRecordingId",
      "suggestions",
      "selectedTopicValues",
    ]) ||
    !isNonEmptyString(input.sourceRecordingId)
  ) {
    return null;
  }

  const suggestions = parseTopicSuggestions(input.suggestions);
  const selectedTopicValues = parseSelectedTopicValues(
    input.selectedTopicValues,
  );

  if (suggestions === null || selectedTopicValues === null) {
    return null;
  }

  const suggestedTopicValues = new Set(
    suggestions.map((suggestion) => suggestion.topicValue),
  );

  if (
    selectedTopicValues.some(
      (topicValue) => !suggestedTopicValues.has(topicValue),
    )
  ) {
    return null;
  }

  return {
    status: "processed",
    sourceRecordingId: input.sourceRecordingId,
    suggestions,
    selectedTopicValues,
  };
}

function isIntakeStep(input: unknown): input is IntakeStep {
  return input === "record" || input === "topics" || input === "matches";
}

function isValidStepForProgress(
  currentStep: IntakeStep,
  recording: PersistedRecordingState,
  topics: PersistedTopicsState,
): boolean {
  switch (currentStep) {
    case "record":
      return true;
    case "topics":
      return recording.status === "completed";
    case "matches":
      return (
        recording.status === "completed" &&
        topics.status === "processed" &&
        topics.selectedTopicValues.length > 0
      );
  }
}

function hasConsistentProgress(
  recording: PersistedRecordingState,
  topics: PersistedTopicsState,
): boolean {
  if (topics.status === "unavailable") {
    return true;
  }

  return (
    recording.status === "completed" &&
    topics.sourceRecordingId === recording.recordingId
  );
}

export function validatePersistedIntakeState(
  input: unknown,
): PersistedIntakeStateValidationResult {
  if (!isRecord(input) || !("version" in input)) {
    return { status: "invalid" };
  }

  if (input.version !== PERSISTED_INTAKE_STATE_VERSION) {
    return { status: "versionMismatch" };
  }

  if (
    !hasExactKeys(input, [
      "version",
      "currentStep",
      "recording",
      "topics",
      "unfinishedRecordingAttemptId",
    ]) ||
    !isIntakeStep(input.currentStep) ||
    (input.unfinishedRecordingAttemptId !== null &&
      !isNonEmptyString(input.unfinishedRecordingAttemptId))
  ) {
    return { status: "invalid" };
  }

  const recording = parseRecordingState(input.recording);
  const topics = parseTopicsState(input.topics);

  if (
    recording === null ||
    topics === null ||
    !hasConsistentProgress(recording, topics) ||
    !isValidStepForProgress(input.currentStep, recording, topics) ||
    (input.unfinishedRecordingAttemptId !== null &&
      (input.currentStep !== "record" || topics.status !== "unavailable"))
  ) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    state: {
      version: PERSISTED_INTAKE_STATE_VERSION,
      currentStep: input.currentStep,
      recording,
      topics,
      unfinishedRecordingAttemptId: input.unfinishedRecordingAttemptId,
    },
  };
}
