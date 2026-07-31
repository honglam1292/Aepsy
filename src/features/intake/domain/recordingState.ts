import type { RecordingState } from "./intakeTypes";

export type ActiveRecordingState = Extract<
  RecordingState,
  { readonly status: "requestingPermission" | "recording" | "stopping" }
>;

const activeRecordingStatuses: readonly RecordingState["status"][] = [
  "requestingPermission",
  "recording",
  "stopping",
];

export function isActiveRecordingState(
  recording: RecordingState,
): recording is ActiveRecordingState {
  return activeRecordingStatuses.includes(recording.status);
}
