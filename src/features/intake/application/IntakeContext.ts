import { createContext, type Dispatch } from "react";

import type {
  IntakeWorkflowEvent,
  IntakeWorkflowState,
} from "../domain/intakeTypes";

export interface IntakeContextValue {
  readonly state: IntakeWorkflowState;
  readonly dispatch: Dispatch<IntakeWorkflowEvent>;
  getState(): IntakeWorkflowState;
}

export const IntakeContext = createContext<IntakeContextValue | null>(null);
