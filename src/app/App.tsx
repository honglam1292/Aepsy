import { ApolloProvider } from "@apollo/client/react";
import type { ReactElement } from "react";
import { BrowserRouter } from "react-router";

import { IntakeProvider } from "../features/intake/application/IntakeProvider";
import { RecordingProvider } from "../features/recording/application/RecordingProvider";
import { browserAudioObjectUrlAdapter } from "../features/recording/infrastructure/browserAudioObjectUrlAdapter";
import { browserRecordingAdapter } from "../features/recording/infrastructure/browserRecordingAdapter";
import { apolloClient } from "./apolloClient";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppRoutes } from "./AppRoutes";

export function App(): ReactElement {
  return (
    <AppErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <IntakeProvider>
          <RecordingProvider
            adapter={browserRecordingAdapter}
            objectUrlAdapter={browserAudioObjectUrlAdapter}
          >
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </RecordingProvider>
        </IntakeProvider>
      </ApolloProvider>
    </AppErrorBoundary>
  );
}
