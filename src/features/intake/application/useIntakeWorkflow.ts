import { useContext } from "react";

import { IntakeContext, type IntakeContextValue } from "./IntakeContext";

export function useIntakeWorkflow(): IntakeContextValue {
  const intake = useContext(IntakeContext);

  if (intake === null) {
    throw new Error("useIntakeWorkflow must be used within IntakeProvider.");
  }

  return intake;
}
