import { useContext } from "react";

import {
  RecordingContext,
  type RecordingController,
} from "./RecordingContext";

export function useRecording(): RecordingController {
  const recording = useContext(RecordingContext);

  if (recording === null) {
    throw new Error("useRecording must be used within RecordingProvider.");
  }

  return recording;
}
