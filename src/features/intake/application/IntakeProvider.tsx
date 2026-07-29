import {
  createContext,
  useReducer,
  type Dispatch,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  initialIntakeWorkflowState,
  intakeWorkflowReducer,
} from "../domain/intakeReducer";
import type {
  IntakeWorkflowEvent,
  IntakeWorkflowState,
} from "../domain/intakeTypes";

interface IntakeContextValue {
  readonly state: IntakeWorkflowState;
  readonly dispatch: Dispatch<IntakeWorkflowEvent>;
}

interface IntakeProviderProps {
  readonly children: ReactNode;
}

const IntakeContext = createContext<IntakeContextValue | null>(null);

export function IntakeProvider({
  children,
}: IntakeProviderProps): ReactElement {
  const [state, dispatch] = useReducer(
    intakeWorkflowReducer,
    initialIntakeWorkflowState,
  );

  return (
    <IntakeContext.Provider value={{ state, dispatch }}>
      {children}
    </IntakeContext.Provider>
  );
}

