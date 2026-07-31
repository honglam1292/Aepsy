import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { IntakeStep } from "../domain/intakeProgress";
import type { PersistedTopicsState } from "../persistence/persistedIntakeState";
import {
  PERSISTED_INTAKE_STATE_VERSION,
  type PersistedIntakeStateV1,
} from "../persistence/persistedIntakeState";
import type { RecordingAudioPruneResult } from "../../recording/application/recordingAudioRepository";
import { renderApp } from "../../../test/renderApp";
import {
  createDeferred,
  DeterministicObjectUrlAdapter,
  MemoryAudioRepository,
  MemoryMetadataRepository,
} from "../../../test/testDoubles";

const recordingId = "saved-recording";
const recordingMimeType = "audio/webm";

function createRecordingAudio(): Blob {
  return new Blob(["saved voice note"], { type: recordingMimeType });
}

function createCompletedMetadata(
  audio: Blob,
  currentStep: IntakeStep = "record",
  topics: PersistedTopicsState = { status: "unavailable" },
): PersistedIntakeStateV1 {
  return {
    version: PERSISTED_INTAKE_STATE_VERSION,
    currentStep,
    recording: {
      status: "completed",
      recordingId,
      durationMs: 4_200,
      mimeType: recordingMimeType,
      byteSize: audio.size,
    },
    topics,
    unfinishedRecordingAttemptId: null,
  };
}

class DeferredPruneAudioRepository extends MemoryAudioRepository {
  readonly pruneOperation = createDeferred<RecordingAudioPruneResult>();

  override prune(
    retainedRecordingId: string | null,
  ): Promise<RecordingAudioPruneResult> {
    void retainedRecordingId;
    return this.pruneOperation.promise;
  }
}

describe("persisted intake recovery", () => {
  it("restores a completed recording and recreates playback after hydration", async () => {
    const audio = createRecordingAudio();
    const metadataRepository = new MemoryMetadataRepository(
      createCompletedMetadata(audio),
    );
    const audioRepository = new MemoryAudioRepository();
    const objectUrlAdapter = new DeterministicObjectUrlAdapter();
    audioRepository.storedAudio.set(recordingId, audio);

    renderApp("/record", {
      audioRepository,
      metadataRepository,
      objectUrlAdapter,
    });

    expect(
      screen.getByText("Getting your intake ready…"),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Your voice note is ready" }),
    ).toBeInTheDocument();

    const playback = screen.getByLabelText("Playback of your voice note");
    expect(playback).toHaveAttribute("src", "blob:test-audio-1");
    expect(objectUrlAdapter.createdBlobs).toEqual([audio]);
    expect(
      screen.getByRole("button", { name: "Continue to topics" }),
    ).toBeEnabled();
  });

  it("recovers an active recording as interrupted rather than completed", async () => {
    const metadataRepository = new MemoryMetadataRepository({
      version: PERSISTED_INTAKE_STATE_VERSION,
      currentStep: "record",
      recording: { status: "none" },
      topics: { status: "unavailable" },
      unfinishedRecordingAttemptId: "recording-before-refresh",
    });

    renderApp("/record", { metadataRepository });

    expect(
      await screen.findByRole("heading", { name: "Recording interrupted" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your recording stopped when this page closed and wasn’t saved. Record again when you’re ready.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record again" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Continue to topics" }),
    ).toBeDisabled();
  });

  it("does not leave completed state behind when saved audio is missing", async () => {
    const audio = createRecordingAudio();
    const metadataRepository = new MemoryMetadataRepository(
      createCompletedMetadata(audio),
    );

    renderApp("/record", { metadataRepository });

    expect(
      await screen.findByRole("heading", { name: "Recording interrupted" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We couldn’t find your saved voice note in this browser. Record a new one to continue.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue to topics" }),
    ).toBeDisabled();
    expect(metadataRepository.storedState).toBeNull();
  });

  it("falls back safely and removes orphaned audio for corrupt metadata", async () => {
    const metadataRepository = new MemoryMetadataRepository();
    const audioRepository = new MemoryAudioRepository();
    metadataRepository.loadResult = { status: "invalid" };
    audioRepository.storedAudio.set("orphaned-recording", createRecordingAudio());

    renderApp("/record", { audioRepository, metadataRepository });

    expect(
      await screen.findByRole("heading", { name: "Ready to record" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We couldn’t restore the saved progress, so this intake is ready to start again.",
      ),
    ).toBeInTheDocument();
    expect(metadataRepository.storedState).toBeNull();
    expect(audioRepository.storedAudio.size).toBe(0);
  });

  it("clears persisted metadata, audio, and the active object URL", async () => {
    const user = userEvent.setup();
    const audio = createRecordingAudio();
    const metadataRepository = new MemoryMetadataRepository(
      createCompletedMetadata(audio),
    );
    const audioRepository = new MemoryAudioRepository();
    const objectUrlAdapter = new DeterministicObjectUrlAdapter();
    audioRepository.storedAudio.set(recordingId, audio);

    renderApp("/record", {
      audioRepository,
      metadataRepository,
      objectUrlAdapter,
    });

    await screen.findByRole("heading", { name: "Your voice note is ready" });
    await user.click(screen.getByRole("button", { name: "Start over" }));
    const confirmation = await screen.findByRole("dialog", {
      name: "Start over?",
    });
    await user.click(
      within(confirmation).getByRole("button", { name: "Start over" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Ready to record" }),
    ).toBeInTheDocument();
    expect(metadataRepository.storedState).toBeNull();
    expect(audioRepository.storedAudio.size).toBe(0);
    expect(objectUrlAdapter.revokedUrls).toContain("blob:test-audio-1");
  });

  it("waits for hydration before guarding direct access to Topics", async () => {
    const audioRepository = new DeferredPruneAudioRepository();

    renderApp("/topics", {
      audioRepository,
      metadataRepository: new MemoryMetadataRepository(),
    });

    expect(
      screen.getByText("Getting your intake ready…"),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/topics");

    audioRepository.pruneOperation.resolve({ status: "pruned" });

    expect(
      await screen.findByRole("heading", { name: "Tell us what’s on your mind" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe("#/record"));
  });

  it("redirects Matches to Topics when a recording exists without selected topics", async () => {
    const audio = createRecordingAudio();
    const topics: PersistedTopicsState = {
      status: "processed",
      sourceRecordingId: recordingId,
      suggestions: [{ topicValue: "U_DIS_STRESS", label: "Stress" }],
      selectedTopicValues: [],
    };
    const metadataRepository = new MemoryMetadataRepository(
      createCompletedMetadata(audio, "topics", topics),
    );
    const audioRepository = new MemoryAudioRepository();
    audioRepository.storedAudio.set(recordingId, audio);

    renderApp("/matches", { audioRepository, metadataRepository });

    expect(
      await screen.findByRole("heading", { name: "Review your topics" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe("#/topics"));
    expect(screen.getByRole("checkbox", { name: "Stress" })).not.toBeChecked();
  });
});
