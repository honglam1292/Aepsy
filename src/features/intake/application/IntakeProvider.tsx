import {
  useReducer,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  initialIntakeWorkflowState,
  intakeWorkflowReducer,
} from "../domain/intakeReducer";
import { IntakeContext } from "./IntakeContext";

interface IntakeProviderProps {
  readonly children: ReactNode;
}

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
