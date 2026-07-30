import { createContext } from "react";

import type { IntakeStep } from "../domain/intakeProgress";
import type { CompletedRecording } from "../domain/intakeTypes";

export type PersistenceNotice =
  | "savedProgressReset"
  | "storageUnavailable"
  | "progressNotSaved"
  | "progressNotSavedCleanupFailed"
  | "clearIncomplete"
  | "progressCleared"
  | "storageCleanupFailed";

export type IntakeHydrationState =
  | { readonly status: "hydrating" }
  | {
      readonly status: "recoveryRequired";
      readonly reason:
        | "metadataUnavailable"
        | "metadataReadFailed"
        | "audioUnavailable";
      readonly canRetry: boolean;
    }
  | { readonly status: "ready" };

export interface CompletedRecordingCommit {
  readonly attemptId: string;
  readonly isReplacement: boolean;
  readonly recording: CompletedRecording;
  readonly audioBlob: Blob;
}

export type CompletedRecordingCommitResult =
  | "completed"
  | "resourceError"
  | "stale";

export interface IntakePersistenceController {
  readonly hydration: IntakeHydrationState;
  readonly audioObjectUrl: string | null;
  readonly lastValidStep: IntakeStep;
  readonly notice: PersistenceNotice | null;
  readonly isClearingProgress: boolean;
  completeRecording(
    commit: CompletedRecordingCommit,
  ): Promise<CompletedRecordingCommitResult>;
  clearProgress(): Promise<void>;
  retryHydration(): void;
  continueWithoutRestoring(): void;
}

export const IntakePersistenceContext =
  createContext<IntakePersistenceController | null>(null);
