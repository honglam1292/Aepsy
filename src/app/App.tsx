import { ApolloProvider } from "@apollo/client/react";
import type { ReactElement } from "react";
import { BrowserRouter } from "react-router";

import { IntakePersistenceProvider } from "../features/intake/application/IntakePersistenceProvider";
import { IntakeProvider } from "../features/intake/application/IntakeProvider";
import type { IntakeMetadataRepository } from "../features/intake/application/intakePersistence";
import { localStorageIntakeMetadataRepository } from "../features/intake/infrastructure/localStorageIntakeMetadataRepository";
import { RecordingProvider } from "../features/recording/application/RecordingProvider";
import type { ProviderSearchExecutor } from "../features/providers/application/providerSearchExecutor";
import { createApolloProviderSearchExecutor } from "../features/providers/infrastructure/apolloProviderSearchExecutor";
import type {
  AudioObjectUrlAdapter,
  RecordingAdapter,
} from "../features/recording/application/recordingAdapter";
import type { RecordingAudioRepository } from "../features/recording/application/recordingAudioRepository";
import { browserAudioObjectUrlAdapter } from "../features/recording/infrastructure/browserAudioObjectUrlAdapter";
import { browserRecordingAdapter } from "../features/recording/infrastructure/browserRecordingAdapter";
import { indexedDbRecordingAudioRepository } from "../features/recording/infrastructure/indexedDbRecordingAudioRepository";
import {
  suppliedAudioTranscriptionProcessor,
  type AudioTranscriptionProcessor,
} from "../features/topics/application/useAudioTranscriber";
import {
  browserAudioBufferAdapter,
  type AudioBufferReader,
} from "../features/topics/infrastructure/browserAudioBufferAdapter";
import { apolloClient } from "./apolloClient";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppRoutes } from "./AppRoutes";

const providerSearchExecutor = createApolloProviderSearchExecutor(apolloClient);

interface AppProps {
  readonly audioRepository?: RecordingAudioRepository;
  readonly metadataRepository?: IntakeMetadataRepository;
  readonly objectUrlAdapter?: AudioObjectUrlAdapter;
  readonly recordingAdapter?: RecordingAdapter;
  readonly providerSearchExecutor?: ProviderSearchExecutor;
  readonly topicAudioBufferReader?: AudioBufferReader;
  readonly topicAudioProcessor?: AudioTranscriptionProcessor;
}

export function App({
  audioRepository = indexedDbRecordingAudioRepository,
  metadataRepository = localStorageIntakeMetadataRepository,
  objectUrlAdapter = browserAudioObjectUrlAdapter,
  recordingAdapter = browserRecordingAdapter,
  providerSearchExecutor: configuredProviderSearchExecutor =
    providerSearchExecutor,
  topicAudioBufferReader = browserAudioBufferAdapter,
  topicAudioProcessor = suppliedAudioTranscriptionProcessor,
}: AppProps = {}): ReactElement {
  return (
    <AppErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <BrowserRouter>
          <IntakeProvider>
            <IntakePersistenceProvider
              audioRepository={audioRepository}
              metadataRepository={metadataRepository}
              objectUrlAdapter={objectUrlAdapter}
            >
              <RecordingProvider adapter={recordingAdapter}>
                <AppRoutes
                  providerSearchExecutor={configuredProviderSearchExecutor}
                  topicAudioBufferReader={topicAudioBufferReader}
                  topicAudioProcessor={topicAudioProcessor}
                />
              </RecordingProvider>
            </IntakePersistenceProvider>
          </IntakeProvider>
        </BrowserRouter>
      </ApolloProvider>
    </AppErrorBoundary>
  );
}
