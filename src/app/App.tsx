import { ApolloProvider } from "@apollo/client/react";
import type { ReactElement } from "react";
import { BrowserRouter } from "react-router";

import { IntakeProvider } from "../features/intake/application/IntakeProvider";
import { apolloClient } from "./apolloClient";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppRoutes } from "./AppRoutes";

export function App(): ReactElement {
  return (
    <AppErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <IntakeProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </IntakeProvider>
      </ApolloProvider>
    </AppErrorBoundary>
  );
}

