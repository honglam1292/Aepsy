import { useContext } from "react";

import {
  IntakePersistenceContext,
  type IntakePersistenceController,
} from "./IntakePersistenceContext";

export function useIntakePersistence(): IntakePersistenceController {
  const persistence = useContext(IntakePersistenceContext);

  if (persistence === null) {
    throw new Error(
      "useIntakePersistence must be used within IntakePersistenceProvider.",
    );
  }

  return persistence;
}
