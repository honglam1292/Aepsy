import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createBrowserRecordingAdapter,
  type RecorderPort,
  type RecorderPortState,
  type RecordingRuntime,
  type TrackPort,
} from "../infrastructure/browserRecordingAdapter";
import { renderApp } from "../../../test/renderApp";
import { DeterministicObjectUrlAdapter } from "../../../test/testDoubles";

class FakeRecorder implements RecorderPort {
  readonly stopCalls = vi.fn();

  private recorderState: RecorderPortState = "inactive";
  private readonly dataListeners = new Set<(chunk: Blob) => void>();
  private readonly stopListeners = new Set<() => void>();
  private readonly errorListeners = new Set<() => void>();

  getState(): RecorderPortState {
    return this.recorderState;
  }

  getMimeType(): string {
    return "audio/webm";
  }

  start(): void {
    this.recorderState = "recording";
  }

  stop(): void {
    this.stopCalls();
    this.recorderState = "inactive";
  }

  subscribeToData(listener: (chunk: Blob) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  subscribeToStop(listener: () => void): () => void {
    this.stopListeners.add(listener);
    return () => this.stopListeners.delete(listener);
  }

  subscribeToError(listener: () => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  finishStop(audioText = "recorded audio"): void {
    const audio = new Blob([audioText], { type: "audio/webm" });
    for (const listener of this.dataListeners) {
      listener(audio);
    }
    for (const listener of this.stopListeners) {
      listener();
    }
  }
}

class FakeTrack implements TrackPort {
  readonly stop = vi.fn();

  private readonly endedListeners = new Set<() => void>();

  subscribeToEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }
}

interface FakeCapture {
  readonly recorder: FakeRecorder;
  readonly track: FakeTrack;
}

function createSuccessfulRuntime(): {
  readonly runtime: RecordingRuntime;
  readonly captures: FakeCapture[];
} {
  const captures: FakeCapture[] = [];

  return {
    captures,
    runtime: {
      isAvailable: () => true,
      supportsMimeType: (mimeType) => mimeType === "audio/webm",
      async openCapture() {
        const capture = {
          recorder: new FakeRecorder(),
          track: new FakeTrack(),
        };
        captures.push(capture);
        return {
          recorder: capture.recorder,
          tracks: [capture.track],
          audioTrackCount: 1,
        };
      },
    },
  };
}

async function waitForRecordingPage(): Promise<void> {
  await screen.findByRole("heading", {
    name: "Tell us what’s on your mind",
  });
}

async function completeCurrentRecording(
  capture: FakeCapture,
  audioText?: string,
): Promise<void> {
  await act(async () => {
    capture.recorder.finishStop(audioText);
    await Promise.resolve();
  });
  await screen.findByText("Your voice note is ready");
}

describe("RecordPage", () => {
  it("records, stops once, exposes playback and enables Continue after valid audio", async () => {
    const user = userEvent.setup();
    const { runtime, captures } = createSuccessfulRuntime();
    renderApp("/record", {
      recordingAdapter: createBrowserRecordingAdapter(runtime),
    });
    await waitForRecordingPage();

    const continueButton = screen.getByRole("button", {
      name: "Continue to topics",
    });
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Start recording" }));
    expect(await screen.findByText("Recording in progress")).toBeVisible();
    expect(captures).toHaveLength(1);

    const stopButton = screen.getByRole("button", {
      name: "Stop recording",
    });
    fireEvent.click(stopButton);
    fireEvent.click(stopButton);

    expect(captures[0]?.recorder.stopCalls).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Finishing recording…" }),
    ).toBeDisabled();

    const capture = captures[0];
    expect(capture).toBeDefined();
    if (capture === undefined) {
      return;
    }
    await completeCurrentRecording(capture);

    expect(
      screen.getByLabelText("Playback of your voice note"),
    ).toHaveAttribute("src", "blob:test-audio-1");
    expect(continueButton).toBeEnabled();
    expect(capture.track.stop).toHaveBeenCalledTimes(1);
  });

  it("replaces a completed recording and revokes its previous playback URL", async () => {
    const user = userEvent.setup();
    const { runtime, captures } = createSuccessfulRuntime();
    const objectUrlAdapter = new DeterministicObjectUrlAdapter();
    renderApp("/record", {
      objectUrlAdapter,
      recordingAdapter: createBrowserRecordingAdapter(runtime),
    });
    await waitForRecordingPage();

    await user.click(screen.getByRole("button", { name: "Start recording" }));
    await user.click(
      await screen.findByRole("button", { name: "Stop recording" }),
    );
    const firstCapture = captures[0];
    expect(firstCapture).toBeDefined();
    if (firstCapture === undefined) {
      return;
    }
    await completeCurrentRecording(firstCapture, "first voice note");

    await user.click(screen.getByRole("button", { name: "Record again" }));
    expect(await screen.findByText("Recording in progress")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Stop recording" }));
    const secondCapture = captures[1];
    expect(secondCapture).toBeDefined();
    if (secondCapture === undefined) {
      return;
    }
    await completeCurrentRecording(secondCapture, "replacement voice note");

    expect(
      screen.getByLabelText("Playback of your voice note"),
    ).toHaveAttribute("src", "blob:test-audio-2");
    expect(objectUrlAdapter.revokedUrls).toContain("blob:test-audio-1");
    expect(firstCapture.track.stop).toHaveBeenCalledTimes(1);
    expect(secondCapture.track.stop).toHaveBeenCalledTimes(1);
  });

  it("shows permission guidance and a retry action when microphone access is denied", async () => {
    const user = userEvent.setup();
    const runtime: RecordingRuntime = {
      isAvailable: () => true,
      supportsMimeType: () => false,
      async openCapture() {
        throw new DOMException("Permission denied", "NotAllowedError");
      },
    };
    renderApp("/record", {
      recordingAdapter: createBrowserRecordingAdapter(runtime),
    });
    await waitForRecordingPage();

    await user.click(screen.getByRole("button", { name: "Start recording" }));

    expect(
      await screen.findByText(
        "Microphone access is blocked. Allow access in your browser settings, then try again.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Continue to topics" }),
    ).toBeDisabled();
  });

  it("shows a clear unsupported state when recording APIs are unavailable", async () => {
    const user = userEvent.setup();
    const runtime: RecordingRuntime = {
      isAvailable: () => false,
      supportsMimeType: () => false,
      async openCapture() {
        throw new Error("openCapture should not run");
      },
    };
    renderApp("/record", {
      recordingAdapter: createBrowserRecordingAdapter(runtime),
    });
    await waitForRecordingPage();

    await user.click(screen.getByRole("button", { name: "Start recording" }));

    expect(
      await screen.findByText("Recording isn’t supported here"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Try a current browser on a device with a microphone to record a voice note.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Start recording" }),
    ).not.toBeInTheDocument();
  });
});
