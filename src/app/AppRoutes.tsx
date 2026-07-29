import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router";

import { MatchesPage } from "../features/providers/presentation/MatchesPage";
import { RecordPage } from "../features/recording/presentation/RecordPage";
import { TopicsPage } from "../features/topics/presentation/TopicsPage";
import { AppShell } from "./layout/AppShell";
import { NotFoundPage } from "./NotFoundPage";

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate replace to="/record" />} />
        <Route element={<RecordPage />} path="/record" />
        <Route element={<TopicsPage />} path="/topics" />
        <Route element={<MatchesPage />} path="/matches" />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
}

