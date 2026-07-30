import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router";

import { MatchesPage } from "../features/providers/presentation/MatchesPage";
import { useRecording } from "../features/recording/application/useRecording";
import { RecordPage } from "../features/recording/presentation/RecordPage";
import { TopicsPage } from "../features/topics/presentation/TopicsPage";
import { AppShell } from "./layout/AppShell";
import { NotFoundPage } from "./NotFoundPage";

export function AppRoutes(): ReactElement {
  const { canContinue } = useRecording();

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate replace to="/record" />} />
        <Route element={<RecordPage />} path="/record" />
        <Route
          element={
            canContinue ? <TopicsPage /> : <Navigate replace to="/record" />
          }
          path="/topics"
        />
        <Route
          element={
            canContinue ? <MatchesPage /> : <Navigate replace to="/record" />
          }
          path="/matches"
        />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
}
