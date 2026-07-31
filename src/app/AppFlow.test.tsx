import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ProviderSearchExecutor } from "../features/providers/application/providerSearchExecutor";
import type {
  ProviderSearchPage,
  ProviderSummary,
} from "../features/providers/domain/providerModels";
import type { AudioTranscriptionProcessor } from "../features/topics/application/useAudioTranscriber";
import type { AudioBufferReader } from "../features/topics/infrastructure/browserAudioBufferAdapter";
import {
  PERSISTED_INTAKE_STATE_VERSION,
  type PersistedIntakeStateV1,
} from "../features/intake/persistence/persistedIntakeState";
import { renderApp } from "../test/renderApp";
import {
  createDeferred,
  MemoryAudioRepository,
  MemoryMetadataRepository,
} from "../test/testDoubles";

const recordingId = "full-flow-recording";

function createProvider(
  providerId: string,
  displayName: string,
): ProviderSummary {
  return {
    providerId,
    displayName,
    avatarUrl: null,
    professionalTitle: "Psychologist",
    yearsExperience: 4,
    highlights: [],
  };
}

function createPage(
  items: readonly ProviderSummary[],
  canLoadMore: boolean,
): ProviderSearchPage {
  return {
    items,
    totalSize: canLoadMore ? 2 : items.length,
    canLoadMore,
  };
}

describe("critical intake flow", () => {
  it("moves from restored audio through topic selection and paginated matches", async () => {
    const user = userEvent.setup();
    const audio = new Blob(["completed voice note"], { type: "audio/webm" });
    const metadata: PersistedIntakeStateV1 = {
      version: PERSISTED_INTAKE_STATE_VERSION,
      currentStep: "record",
      recording: {
        status: "completed",
        recordingId,
        durationMs: 3_500,
        mimeType: audio.type,
        byteSize: audio.size,
      },
      topics: { status: "unavailable" },
      unfinishedRecordingAttemptId: null,
    };
    const audioRepository = new MemoryAudioRepository();
    audioRepository.storedAudio.set(recordingId, audio);
    const topicProcessing = createDeferred<
      Awaited<ReturnType<AudioTranscriptionProcessor>>
    >();
    const decodedAudio: Blob[] = [];
    const audioBufferReader: AudioBufferReader = {
      async read(audioBlob): Promise<ArrayBuffer> {
        decodedAudio.push(audioBlob);
        return new Uint8Array([1, 2, 3]).buffer;
      },
    };
    const processedAudio: (ArrayBuffer | Uint8Array)[] = [];
    const topicAudioProcessor: AudioTranscriptionProcessor = (
      audioBuffer,
    ) => {
      processedAudio.push(audioBuffer);
      return topicProcessing.promise;
    };
    const providerRequests: Parameters<
      ProviderSearchExecutor["searchProviders"]
    >[0][] = [];
    const firstProvider = createProvider("provider-1", "Alex Alpha");
    const secondProvider = createProvider("provider-2", "Blair Beta");
    const refreshedProvider = createProvider("provider-3", "Casey Gamma");
    const providerSearchExecutor: ProviderSearchExecutor = {
      async searchProviders(request): Promise<ProviderSearchPage> {
        providerRequests.push(request);

        if (request.rawDisorders.includes("U_DIS_SLEEP_PROBLEM")) {
          return createPage([refreshedProvider], false);
        }

        return request.pageNum === 1
          ? createPage([firstProvider], true)
          : createPage([secondProvider], false);
      },
    };

    renderApp("/record", {
      audioRepository,
      metadataRepository: new MemoryMetadataRepository(metadata),
      topicAudioBufferReader: audioBufferReader,
      topicAudioProcessor,
      providerSearchExecutor,
    });

    await screen.findByRole("heading", { name: "Your voice note is ready" });
    await user.click(
      screen.getByRole("button", { name: "Continue to topics" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Processing your voice note",
      }),
    ).toBeInTheDocument();
    await waitFor(() => expect(processedAudio).toHaveLength(1));
    expect(decodedAudio).toEqual([audio]);
    expect(processedAudio[0]?.byteLength).toBe(3);

    topicProcessing.resolve([
      { value: "U_DIS_STRESS", label: "Stress" },
      { value: "U_DIS_SLEEP_PROBLEM", label: "Sleep problems" },
    ]);

    const stressTopic = await screen.findByRole("checkbox", {
      name: "Stress",
    });
    const continueToMatches = screen.getByRole("button", {
      name: "Continue to matches",
    });
    expect(continueToMatches).toBeDisabled();
    await user.click(stressTopic);
    expect(stressTopic).toBeChecked();
    expect(continueToMatches).toBeEnabled();
    await user.click(continueToMatches);

    expect(
      await screen.findByRole("heading", { name: "Alex Alpha" }),
    ).toBeInTheDocument();
    expect(providerRequests[0]).toEqual({
      pageNum: 1,
      pageSize: 6,
      rawDisorders: ["U_DIS_STRESS"],
    });

    await user.click(
      screen.getByRole("button", { name: "Load more psychologists" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Blair Beta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Alex Alpha" }),
    ).toBeInTheDocument();
    expect(providerRequests[1]).toEqual({
      pageNum: 2,
      pageSize: 6,
      rawDisorders: ["U_DIS_STRESS"],
    });

    await user.click(screen.getByRole("link", { name: "Back to topics" }));
    const restoredStressTopic = await screen.findByRole("checkbox", {
      name: "Stress",
    });
    expect(restoredStressTopic).toBeChecked();
    await user.click(
      screen.getByRole("checkbox", { name: "Sleep problems" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue to matches" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Casey Gamma" }),
    ).toBeInTheDocument();
    expect(providerRequests[2]).toEqual({
      pageNum: 1,
      pageSize: 6,
      rawDisorders: ["U_DIS_STRESS", "U_DIS_SLEEP_PROBLEM"],
    });
    expect(
      screen.queryByRole("heading", { name: "Alex Alpha" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Blair Beta" }),
    ).not.toBeInTheDocument();
  });
});
