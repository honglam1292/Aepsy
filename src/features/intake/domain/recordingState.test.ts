import { describe, expect, it } from "vitest";

import type { RecordingState } from "./intakeTypes";
import { isActiveRecordingState } from "./recordingState";

const completedRecording = {
  recordingId: "recording-1",
  mimeType: "audio/webm",
  byteSize: 12,
  durationMs: 2_500,
} as const;

describe("isActiveRecordingState", () => {
  it("only treats permission, recording, and stopping states as active", () => {
    const activeStates: readonly RecordingState[] = [
      {
        status: "requestingPermission",
        attemptId: "attempt-1",
        previousRecording: null,
      },
      {
        status: "recording",
        attemptId: "attempt-1",
        startedAtEpochMs: 1_000,
        previousRecording: null,
      },
      {
        status: "stopping",
        attemptId: "attempt-1",
        startedAtEpochMs: 1_000,
        previousRecording: null,
      },
    ];
    const inactiveStates: readonly RecordingState[] = [
      { status: "idle" },
      { status: "recorded", recording: completedRecording },
      {
        status: "interrupted",
        attemptId: "attempt-1",
        reason: "navigation",
        previousRecording: completedRecording,
      },
      {
        status: "unsupported",
        attemptId: "attempt-1",
        previousRecording: completedRecording,
      },
      {
        status: "error",
        attemptId: "attempt-1",
        reason: "recorderError",
        previousRecording: completedRecording,
      },
    ];

    expect(activeStates.every(isActiveRecordingState)).toBe(true);
    expect(inactiveStates.some(isActiveRecordingState)).toBe(false);
  });
});
