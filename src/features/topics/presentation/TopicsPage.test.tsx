import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PersistedIntakeStateV1 } from "../../intake/persistence/persistedIntakeState";
import {
  suppliedAudioTranscriptionProcessor,
  type AudioTranscriptionProcessor,
} from "../application/useAudioTranscriber";
import { normalizeTopicSuggestions } from "../domain/normalizeTopicSuggestions";
import { renderApp } from "../../../test/renderApp";
import {
  createDeferred,
  MemoryAudioRepository,
  MemoryMetadataRepository,
} from "../../../test/testDoubles";

const RECORDING_ID = "recording-for-topics";
const STORED_AUDIO = new Blob(["voice note"], { type: "audio/webm" });

function createTopicsMetadata(): PersistedIntakeStateV1 {
  return {
    version: 1,
    currentStep: "topics",
    recording: {
      status: "completed",
      recordingId: RECORDING_ID,
      durationMs: 1_500,
      mimeType: STORED_AUDIO.type,
      byteSize: STORED_AUDIO.size,
    },
    topics: { status: "unavailable" },
    unfinishedRecordingAttemptId: null,
  };
}

function renderTopics(
  audioProcessor: AudioTranscriptionProcessor,
  audioBuffer = new Uint8Array([1, 2, 3]).buffer,
) {
  const audioRepository = new MemoryAudioRepository();
  const metadataRepository = new MemoryMetadataRepository(
    createTopicsMetadata(),
  );
  const read = vi.fn(async () => audioBuffer);
  audioRepository.storedAudio.set(RECORDING_ID, STORED_AUDIO);

  const result = renderApp("/topics", {
    audioRepository,
    metadataRepository,
    topicAudioBufferReader: { read },
    topicAudioProcessor: audioProcessor,
  });

  return { ...result, read };
}

describe("topic processing and selection", () => {
  it("keeps the supplied two-second processing delay", async () => {
    vi.useFakeTimers();
    let hasFinished = false;
    const processing = suppliedAudioTranscriptionProcessor(
      new Uint8Array([1]),
    );
    void processing.then(() => {
      hasFinished = true;
    });

    await vi.advanceTimersByTimeAsync(1_999);
    expect(hasFinished).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const suggestions = await processing;

    expect(hasFinished).toBe(true);
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "U_DIS_STRESS",
          label: "Stress",
        }),
      ]),
    );
  });

  it("deduplicates exact values while retaining equal labels with different values", () => {
    expect(
      normalizeTopicSuggestions([
        { value: "TOPIC_STRESS", label: "Stress" },
        { value: "TOPIC_STRESS", label: "Work stress" },
        { value: "TOPIC_FAMILY", label: "Stress" },
      ]),
    ).toEqual([
      { topicValue: "TOPIC_STRESS", label: "Stress" },
      { topicValue: "TOPIC_FAMILY", label: "Stress" },
    ]);
  });

  it("processes restored audio before allowing multiple topic selections", async () => {
    const user = userEvent.setup();
    const processing = createDeferred<
      readonly { readonly value: string; readonly label: string }[]
    >();
    const audioProcessorMock = vi.fn(() => processing.promise);
    const audioBuffer = new Uint8Array([7, 8, 9]).buffer;
    const { read } = renderTopics(audioProcessorMock, audioBuffer);

    expect(
      await screen.findByRole("heading", {
        name: "Processing your voice note",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(read).toHaveBeenCalledWith(STORED_AUDIO);
      expect(audioProcessorMock).toHaveBeenCalledWith(audioBuffer);
    });

    await act(async () => {
      processing.resolve([
        { value: "TOPIC_STRESS", label: "Stress" },
        { value: "TOPIC_SLEEP", label: "Sleep problems" },
      ]);
    });

    const stress = await screen.findByRole("checkbox", { name: "Stress" });
    const sleep = screen.getByRole("checkbox", { name: "Sleep problems" });
    const continueButton = screen.getByRole("button", {
      name: "Continue to matches",
    });
    expect(continueButton).toBeDisabled();

    await user.click(stress);
    expect(stress).toBeChecked();
    expect(continueButton).toBeEnabled();

    await user.click(sleep);
    expect(stress).toBeChecked();
    expect(sleep).toBeChecked();

    await user.click(stress);
    expect(stress).not.toBeChecked();
    expect(sleep).toBeChecked();
    expect(continueButton).toBeEnabled();
  });

  it("rejects empty audio data and offers a retry", async () => {
    const audioProcessorMock = vi.fn(async () => [
      { value: "TOPIC_STRESS", label: "Stress" },
    ]);
    renderTopics(audioProcessorMock, new ArrayBuffer(0));

    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t prepare topic suggestions",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Retry processing" }),
    ).toBeEnabled();
    expect(audioProcessorMock).not.toHaveBeenCalled();
  });

  it("recovers from a processing failure when the user retries", async () => {
    const user = userEvent.setup();
    const audioProcessorMock = vi.fn<AudioTranscriptionProcessor>();
    audioProcessorMock
      .mockRejectedValueOnce(new Error("processor unavailable"))
      .mockResolvedValueOnce([{ value: "TOPIC_STRESS", label: "Stress" }]);
    renderTopics(audioProcessorMock);

    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t prepare topic suggestions",
      }),
    ).toBeVisible();
    expect(screen.queryByText("processor unavailable")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Retry processing" }),
    );

    expect(
      await screen.findByRole("checkbox", { name: "Stress" }),
    ).toBeVisible();
    expect(audioProcessorMock).toHaveBeenCalledTimes(2);
  });
});
