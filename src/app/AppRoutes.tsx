import { useEffect, useRef, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";

import { useIntakePersistence } from "../features/intake/application/useIntakePersistence";
import { useIntakeWorkflow } from "../features/intake/application/useIntakeWorkflow";
import {
  getNearestValidIntakeStep,
  type IntakeStep,
} from "../features/intake/domain/intakeProgress";
import { IntakeHydrationPage } from "../features/intake/presentation/IntakeHydrationPage";
import type { ProviderSearchExecutor } from "../features/providers/application/providerSearchExecutor";
import { MatchesPage } from "../features/providers/presentation/MatchesPage";
import { RecordPage } from "../features/recording/presentation/RecordPage";
import { TopicsPage } from "../features/topics/presentation/TopicsPage";
import type { AudioTranscriptionProcessor } from "../features/topics/application/useAudioTranscriber";
import type { AudioBufferReader } from "../features/topics/infrastructure/browserAudioBufferAdapter";
import { AppShell } from "./layout/AppShell";
import { NotFoundPage } from "./NotFoundPage";

interface AppRoutesProps {
  readonly providerSearchExecutor: ProviderSearchExecutor;
  readonly topicAudioBufferReader: AudioBufferReader;
  readonly topicAudioProcessor: AudioTranscriptionProcessor;
}

export function AppRoutes({
  providerSearchExecutor,
  topicAudioBufferReader,
  topicAudioProcessor,
}: AppRoutesProps): ReactElement {
  const { pathname } = useLocation();
  const { state } = useIntakeWorkflow();
  const persistence = useIntakePersistence();
  const shouldFocusAfterRecoveryRef = useRef(false);
  const previousPathnameRef = useRef(pathname);

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

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    if (
      persistence.hydration.status === "ready" &&
      previousPathname !== pathname
    ) {
      globalThis.setTimeout(() => {
        document.getElementById("main-content")?.focus();
      }, 0);
    }
  }, [pathname, persistence.hydration.status]);

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
          element={guardStep(
            "topics",
            <TopicsPage
              audioBufferReader={topicAudioBufferReader}
              audioProcessor={topicAudioProcessor}
            />,
          )}
          path="/topics"
        />
        <Route
          element={guardStep(
            "matches",
            <MatchesPage providerSearchExecutor={providerSearchExecutor} />,
          )}
          path="/matches"
        />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
}
