import { render, type RenderResult } from "@testing-library/react";

import { App } from "../app/App";
import type { RecordingAdapter } from "../features/recording/application/recordingAdapter";
import {
  DeterministicObjectUrlAdapter,
  MemoryAudioRepository,
  MemoryMetadataRepository,
} from "./testDoubles";

export type TestAppDependencies = NonNullable<Parameters<typeof App>[0]>;

const unsupportedRecordingAdapter: RecordingAdapter = {
  isSupported: () => false,
  async start() {
    return { status: "failed", reason: "unsupported" };
  },
};

export function renderApp(
  route: string,
  dependencies: TestAppDependencies = {},
): RenderResult {
  window.location.hash = `#${route}`;

  return render(
    <App
      audioRepository={new MemoryAudioRepository()}
      metadataRepository={new MemoryMetadataRepository()}
      objectUrlAdapter={new DeterministicObjectUrlAdapter()}
      providerSearchExecutor={{
        async searchProviders() {
          return { items: [], totalSize: 0, canLoadMore: false };
        },
      }}
      recordingAdapter={unsupportedRecordingAdapter}
      topicAudioBufferReader={{
        async read() {
          return new Uint8Array([1]).buffer;
        },
      }}
      topicAudioProcessor={async () => []}
      {...dependencies}
    />,
  );
}
