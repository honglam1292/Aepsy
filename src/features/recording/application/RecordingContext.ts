import { createContext } from "react";

import type { RecordingState } from "../../intake/domain/intakeTypes";

export interface RecordingController {
  readonly lifecycle: RecordingState;
  readonly audioObjectUrl: string | null;
  readonly elapsedMilliseconds: number;
  readonly canContinue: boolean;
  startRecording(): void;
  stopRecording(): void;
  cancelActiveRecording(): void;
}

export const RecordingContext = createContext<RecordingController | null>(null);
