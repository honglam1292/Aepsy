import {
  useEffect,
  useRef,
  type ReactElement,
} from "react";
import { useNavigate } from "react-router";

import type {
  RecordingFailureReason,
  RecordingState,
} from "../../intake/domain/intakeTypes";
import type { RecordingController } from "../application/RecordingContext";
import { useRecording } from "../application/useRecording";

interface RecordingStatusCopy {
  readonly title: string;
  readonly message: string;
  readonly isAlert: boolean;
}

interface RecordAction {
  readonly label: string;
  readonly isDisabled: boolean;
  readonly intent: "start" | "stop";
}

const primaryButtonClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary-600 px-6 py-3 font-semibold text-white outline-offset-4 transition-colors hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-grey-300 disabled:text-grey-500 sm:w-auto";

const secondaryButtonClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-primary-400 bg-white px-6 py-3 font-semibold text-primary-600 outline-offset-4 transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-grey-300 disabled:text-grey-400 sm:w-auto";

function assertNever(unhandledValue: never): never {
  void unhandledValue;
  throw new Error("Unhandled recording presentation state.");
}

function getRecordingErrorMessage(reason: RecordingFailureReason): string {
  switch (reason) {
    case "permissionDenied":
      return "Microphone access is blocked. Allow access in your browser settings, then try again.";
    case "microphoneNotFound":
      return "We couldn’t find a microphone. Connect one, then try again.";
    case "microphoneUnavailable":
      return "We can’t use your microphone right now. Check that it’s connected and not being used by another app, then try again.";
    case "emptyRecording":
      return "We didn’t capture any audio. Check your microphone and try again.";
    case "recorderError":
      return "We couldn’t finish that recording. Please try again.";
    default:
      return assertNever(reason);
  }
}

function getInterruptionMessage(
  lifecycle: Extract<RecordingState, { readonly status: "interrupted" }>,
): string {
  switch (lifecycle.reason) {
    case "microphoneEnded":
      return "The microphone became unavailable, so this recording wasn’t saved. Check the connection and try again.";
    case "browserInterrupted":
      return "The browser stopped the recording before it was ready. Please try again.";
    case "navigation":
      return "The recording stopped when you left this step and wasn’t saved. Start again when you’re ready.";
    case "browserReload":
      return lifecycle.previousRecording === null
        ? "Your recording stopped when this page closed and wasn’t saved. Record again when you’re ready."
        : "Your new recording stopped when this page closed and wasn’t saved. Your previous voice note is still available.";
    case "storedAudioMissing":
      return "We couldn’t find your saved voice note in this browser. Record a new one to continue.";
    case "storedAudioUnavailable":
      return "We couldn’t reopen your saved voice note. Record a new one when you’re ready.";
    default:
      return assertNever(lifecycle.reason);
  }
}

function getRecordingStatusCopy(
  lifecycle: RecordingState,
): RecordingStatusCopy {
  switch (lifecycle.status) {
    case "idle":
      return {
        title: "Ready to record",
        message: "Start when you feel ready. You can listen back before continuing.",
        isAlert: false,
      };
    case "requestingPermission":
      return {
        title: "Waiting for microphone access",
        message:
          lifecycle.previousRecording === null
            ? "Check your browser’s permission prompt to continue."
            : "Check your browser’s permission prompt to continue. Your previous voice note remains available until a new one is ready.",
        isAlert: false,
      };
    case "recording":
      return {
        title: "Recording in progress",
        message:
          lifecycle.previousRecording === null
            ? "Speak at your own pace, then stop when you’re finished."
            : "Speak at your own pace, then stop when you’re finished. Your previous voice note remains available until this one is ready.",
        isAlert: false,
      };
    case "stopping":
      return {
        title: "Finishing your voice note",
        message:
          lifecycle.previousRecording === null
            ? "Keep this page open for a moment while the audio is prepared."
            : "Keep this page open for a moment. Your previous voice note remains available until this one is ready.",
        isAlert: false,
      };
    case "recorded":
      return {
        title: "Your voice note is ready",
        message: "Listen back, record it again, or continue to the next step.",
        isAlert: false,
      };
    case "interrupted":
      return {
        title: "Recording interrupted",
        message: getInterruptionMessage(lifecycle),
        isAlert: true,
      };
    case "unsupported":
      return {
        title: "Recording isn’t supported here",
        message:
          "Try a current browser on a device with a microphone to record a voice note.",
        isAlert: false,
      };
    case "error":
      return {
        title: "That recording wasn’t saved",
        message: getRecordingErrorMessage(lifecycle.reason),
        isAlert: true,
      };
    default:
      return assertNever(lifecycle);
  }
}

function getRecordAction(lifecycle: RecordingState): RecordAction | null {
  switch (lifecycle.status) {
    case "idle":
      return {
        label: "Start recording",
        isDisabled: false,
        intent: "start",
      };
    case "requestingPermission":
      return {
        label: "Requesting access…",
        isDisabled: true,
        intent: "start",
      };
    case "recording":
      return {
        label: "Stop recording",
        isDisabled: false,
        intent: "stop",
      };
    case "stopping":
      return {
        label: "Finishing recording…",
        isDisabled: true,
        intent: "stop",
      };
    case "recorded":
      return {
        label: "Record again",
        isDisabled: false,
        intent: "start",
      };
    case "interrupted":
      return {
        label:
          lifecycle.reason === "browserReload" ||
          lifecycle.reason === "storedAudioMissing" ||
          lifecycle.reason === "storedAudioUnavailable"
            ? "Record again"
            : "Start again",
        isDisabled: false,
        intent: "start",
      };
    case "unsupported":
      return null;
    case "error":
      return {
        label:
          lifecycle.reason === "emptyRecording" ? "Record again" : "Try again",
        isDisabled: false,
        intent: "start",
      };
    default:
      return assertNever(lifecycle);
  }
}

function formatElapsedTime(elapsedMilliseconds: number): string {
  const totalSeconds = Math.floor(elapsedMilliseconds / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function canShowPlayback(
  lifecycle: RecordingState,
  audioObjectUrl: string | null,
): audioObjectUrl is string {
  if (audioObjectUrl === null) {
    return false;
  }

  return (
    lifecycle.status === "recorded" ||
    lifecycle.status === "interrupted" ||
    lifecycle.status === "unsupported" ||
    lifecycle.status === "error"
  );
}

function RecordingPanel({
  recording,
}: {
  readonly recording: RecordingController;
}): ReactElement {
  const copy = getRecordingStatusCopy(recording.lifecycle);
  const recordAction = getRecordAction(recording.lifecycle);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const previousStatusRef = useRef(recording.lifecycle.status);
  const showPlayback = canShowPlayback(
    recording.lifecycle,
    recording.audioObjectUrl,
  );

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const currentStatus = recording.lifecycle.status;
    previousStatusRef.current = currentStatus;

    if (
      previousStatus === "requestingPermission" ||
      previousStatus === "stopping" ||
      (previousStatus === "recording" && currentStatus !== "stopping")
    ) {
      actionButtonRef.current?.focus();
    }
  }, [recording.lifecycle.status]);

  return (
    <section
      aria-labelledby="recording-panel-title"
      className="mt-9 rounded-2xl border border-primary-300 bg-primary-100 p-5 sm:p-7"
    >
      <div
        aria-atomic="true"
        aria-live={copy.isAlert ? "assertive" : "polite"}
        role={copy.isAlert ? "alert" : "status"}
      >
        <h2
          className="font-serif text-2xl text-primary-600 focus:outline-none"
          id="recording-panel-title"
        >
          {copy.title}
        </h2>
        <p className="mt-2 max-w-2xl leading-7 text-grey-500">
          {copy.message}
        </p>
      </div>

      {recording.lifecycle.status === "recording" ? (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-primary-600">
          <span className="flex items-center gap-3 font-semibold">
            <span
              aria-hidden="true"
              className="size-3 rounded-full bg-red-400"
            />
            Recording
          </span>
          <time
            aria-label={`Elapsed recording time ${formatElapsedTime(recording.elapsedMilliseconds)}`}
            className="font-mono text-lg font-semibold tabular-nums"
          >
            {formatElapsedTime(recording.elapsedMilliseconds)}
          </time>
        </div>
      ) : null}

      {showPlayback ? (
        <div className="mt-6">
          {recording.lifecycle.status !== "recorded" ? (
            <p className="mb-3 text-sm font-semibold text-primary-600">
              Your previous voice note is still available.
            </p>
          ) : null}
          <audio
            aria-label="Playback of your voice note"
            className="block w-full max-w-full"
            controls
            preload="metadata"
            src={recording.audioObjectUrl}
          />
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {recordAction === null ? null : (
          <button
            className={
              recordAction.isDisabled ||
              recording.lifecycle.status === "recorded"
                ? secondaryButtonClassName
                : primaryButtonClassName
            }
            disabled={recordAction.isDisabled}
            onClick={
              recordAction.intent === "stop"
                ? recording.stopRecording
                : recording.startRecording
            }
            ref={actionButtonRef}
            type="button"
          >
            {recordAction.label}
          </button>
        )}
      </div>
    </section>
  );
}

export function RecordPage(): ReactElement {
  const recording = useRecording();
  const { cancelActiveRecording } = recording;
  const navigate = useNavigate();

  useEffect(
    () => () => {
      cancelActiveRecording();
    },
    [cancelActiveRecording],
  );

  return (
    <section aria-labelledby="record-title">
      <title>Aepsy | Record your voice note</title>
      <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
        Step 1 of 3
      </p>
      <h1
        className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-primary-600 sm:text-5xl"
        id="record-title"
        tabIndex={-1}
      >
        Tell us what’s on your mind
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-grey-500">
        Record a short voice note in your own words. There’s no need to prepare
        what you want to say.
      </p>

      <aside className="mt-7 max-w-3xl rounded-2xl border border-primary-200 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-xl text-primary-600">
          Before you start
        </h2>
        <p className="mt-2 leading-7 text-grey-500">
          Your browser needs microphone access to capture your voice. We’ll ask
          for permission only after you choose Start recording.
        </p>
        <p className="mt-2 leading-7 text-grey-500">
          Your completed audio stays in this browser for this intake; if it
          won’t survive a refresh, we’ll tell you. It isn’t sent or analysed in
          this step, and you can remove it by starting over.
        </p>
      </aside>

      <RecordingPanel recording={recording} />

      <div className="mt-7 flex justify-end">
        <button
          className={primaryButtonClassName}
          disabled={!recording.canContinue}
          onClick={() => navigate("/topics")}
          type="button"
        >
          Continue to topics
        </button>
      </div>
    </section>
  );
}
