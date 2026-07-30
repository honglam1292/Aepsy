import { createContext } from "react";

import type { RecordingState } from "../../intake/domain/intakeTypes";

export interface RecordingController {
  readonly lifecycle: RecordingState;
  readonly audioObjectUrl: string | null;
  readonly elapsedMilliseconds: number;
  readonly canContinue: boolean;
  readonly hasProgress: boolean;
  readonly isClearingProgress: boolean;
  startRecording(): void;
  stopRecording(): void;
  cancelActiveRecording(): void;
  clearProgress(): Promise<void>;
}

export const RecordingContext = createContext<RecordingController | null>(null);
