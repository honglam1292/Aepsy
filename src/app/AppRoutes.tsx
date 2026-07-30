import { useEffect, useRef, type ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router";

import { useIntakePersistence } from "../features/intake/application/useIntakePersistence";
import { useIntakeWorkflow } from "../features/intake/application/useIntakeWorkflow";
import {
  getNearestValidIntakeStep,
  type IntakeStep,
} from "../features/intake/domain/intakeProgress";
import { IntakeHydrationPage } from "../features/intake/presentation/IntakeHydrationPage";
import { MatchesPage } from "../features/providers/presentation/MatchesPage";
import { RecordPage } from "../features/recording/presentation/RecordPage";
import { TopicsPage } from "../features/topics/presentation/TopicsPage";
import { AppShell } from "./layout/AppShell";
import { NotFoundPage } from "./NotFoundPage";

export function AppRoutes(): ReactElement {
  const { state } = useIntakeWorkflow();
  const persistence = useIntakePersistence();
  const shouldFocusAfterRecoveryRef = useRef(false);

  useEffect(() => {
    if (persistence.hydration.status === "recoveryRequired") {
      shouldFocusAfterRecoveryRef.current = true;
      return;
    }

    if (
      persistence.hydration.status === "ready" &&
      shouldFocusAfterRecoveryRef.current
    ) {
      shouldFocusAfterRecoveryRef.current = false;
      globalThis.setTimeout(() => {
        document.getElementById("main-content")?.focus();
      }, 0);
    }
  }, [persistence.hydration.status]);

  if (persistence.hydration.status !== "ready") {
    return <IntakeHydrationPage />;
  }

  const guardStep = (
    requestedStep: IntakeStep,
    page: ReactElement,
  ): ReactElement => {
    const validStep = getNearestValidIntakeStep(state, requestedStep);
    return validStep === requestedStep ? (
      page
    ) : (
      <Navigate replace to={`/${validStep}`} />
    );
  };

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <Navigate replace to={`/${persistence.lastValidStep}`} />
          }
        />
        <Route element={<RecordPage />} path="/record" />
        <Route
          element={guardStep("topics", <TopicsPage />)}
          path="/topics"
        />
        <Route
          element={guardStep("matches", <MatchesPage />)}
          path="/matches"
        />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
}
