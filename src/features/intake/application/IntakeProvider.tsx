import {
  useCallback,
  useReducer,
  useRef,
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
import { IntakeContext } from "./IntakeContext";

interface IntakeProviderProps {
  readonly children: ReactNode;
}

export function IntakeProvider({
  children,
}: IntakeProviderProps): ReactElement {
  const [state, reducerDispatch] = useReducer(
    intakeWorkflowReducer,
    initialIntakeWorkflowState,
  );
  const stateRef = useRef<IntakeWorkflowState>(state);

  const dispatch = useCallback((event: IntakeWorkflowEvent): void => {
    stateRef.current = intakeWorkflowReducer(stateRef.current, event);
    reducerDispatch(event);
  }, []);
  const getState = useCallback((): IntakeWorkflowState => stateRef.current, []);

  return (
    <IntakeContext.Provider value={{ state, dispatch, getState }}>
      {children}
    </IntakeContext.Provider>
  );
}
