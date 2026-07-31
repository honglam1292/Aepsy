import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { useNavigate } from "react-router";

import { useRecording } from "../../recording/application/useRecording";
import { useIntakePersistence } from "../application/useIntakePersistence";
import type { PersistenceNotice } from "../application/IntakePersistenceContext";
import { isActiveRecordingState } from "../domain/recordingState";

const quietButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-primary-300 bg-white px-4 py-2 text-sm font-semibold text-primary-600 outline-offset-4 transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-grey-400";

function getNoticeMessage(notice: PersistenceNotice): string {
  switch (notice) {
    case "savedProgressReset":
      return "We couldn’t restore the saved progress, so this intake is ready to start again.";
    case "storageUnavailable":
      return "Progress can’t be saved right now. You can continue in this tab, but refreshing or closing it will clear new progress.";
    case "progressNotSaved":
      return "Your voice note is available in this tab, but this browser couldn’t save it for a refresh.";
    case "progressNotSavedCleanupFailed":
      return "Your voice note is available in this tab, but it wasn’t saved for a refresh and a previous browser-stored copy may remain. Starting over will retry the cleanup.";
    case "clearIncomplete":
      return "This intake was reset, but the browser couldn’t remove all saved data. You can try clearing it again.";
    case "progressCleared":
      return "Your saved intake progress was cleared.";
    case "storageCleanupFailed":
      return "Your new voice note is saved, but the browser couldn’t remove an older stored copy. Starting over will retry the cleanup.";
    default:
      return assertNever(notice);
  }
}

function assertNever(unhandledValue: never): never {
  void unhandledValue;
  throw new Error("Unhandled persistence notice.");
}

export function PersistenceStatus(): ReactElement | null {
  const persistence = useIntakePersistence();
  const recording = useRecording();
  const statusRef = useRef<HTMLElement>(null);

  if (persistence.notice === null) {
    return null;
  }

  const didCleanupFail = persistence.notice === "clearIncomplete";

  return (
    <aside
      aria-live={didCleanupFail ? "assertive" : "polite"}
      className="mt-5 flex flex-col gap-3 rounded-2xl border border-primary-200 bg-white px-5 py-4 text-sm leading-6 text-grey-500 sm:flex-row sm:items-center sm:justify-between"
      ref={statusRef}
      role={didCleanupFail ? "alert" : "status"}
      tabIndex={-1}
    >
      <p>{getNoticeMessage(persistence.notice)}</p>
      {didCleanupFail ? (
        <button
          className={quietButtonClassName}
          disabled={recording.isClearingProgress}
          onClick={() => {
            void recording.clearProgress().then(() => {
              statusRef.current?.focus();
            });
          }}
          type="button"
        >
          {recording.isClearingProgress ? "Clearing…" : "Retry clearing"}
        </button>
      ) : null}
    </aside>
  );
}

export function StartOverControl(): ReactElement | null {
  const recording = useRecording();
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const [usesFallbackDialog, setUsesFallbackDialog] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepProgressRef = useRef<HTMLButtonElement>(null);

  const closeDialog = (): void => {
    if (recording.isClearingProgress) {
      return;
    }

    const dialog = dialogRef.current;
    if (
      dialog !== null &&
      dialog.open &&
      typeof dialog.close === "function"
    ) {
      dialog.close();
    }
    setIsConfirming(false);
    globalThis.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!isConfirming) {
      return;
    }

    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    let focusTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      keepProgressRef.current?.focus();
    } else {
      setUsesFallbackDialog(true);
      focusTimeout = globalThis.setTimeout(() => {
        keepProgressRef.current?.focus();
      }, 0);
    }

    return () => {
      if (focusTimeout !== null) {
        globalThis.clearTimeout(focusTimeout);
      }
      if (dialog.open && typeof dialog.close === "function") {
        dialog.close();
      }
    };
  }, [isConfirming]);

  if (!recording.hasProgress && !isConfirming) {
    return null;
  }

  const handleDialogKeyDown = (
    event: KeyboardEvent<HTMLDialogElement>,
  ): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableControls = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not(:disabled)",
    );
    if (focusableControls === undefined || focusableControls.length === 0) {
      return;
    }

    const firstControl = focusableControls.item(0);
    const lastControl = focusableControls.item(focusableControls.length - 1);
    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault();
      lastControl.focus();
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
  };

  const confirmStartOver = async (): Promise<void> => {
    await recording.clearProgress();
    setIsConfirming(false);
    navigate("/record", { replace: true });
    globalThis.setTimeout(() => {
      document.getElementById("record-title")?.focus();
    }, 0);
  };

  const isActiveRecording = isActiveRecordingState(recording.lifecycle);

  return (
    <>
      <button
        className={quietButtonClassName}
        onClick={() => setIsConfirming(true)}
        ref={triggerRef}
        type="button"
      >
        Start over
      </button>
      {isConfirming ? (
        <dialog
          aria-describedby={
            isActiveRecording
              ? "start-over-description start-over-active-recording"
              : "start-over-description"
          }
          aria-labelledby="start-over-title"
          className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-primary-200 bg-white p-0 text-grey-600 shadow-xl backdrop:bg-primary-600/30"
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onKeyDown={handleDialogKeyDown}
          open={usesFallbackDialog || undefined}
          ref={dialogRef}
        >
          <div className="p-6 sm:p-8">
            <h2
              className="font-serif text-2xl text-primary-600"
              id="start-over-title"
            >
              Start over?
            </h2>
            <p
              className="mt-3 leading-7 text-grey-500"
              id="start-over-description"
            >
              This removes your voice note, topic selections, and saved progress
              from this browser. This can’t be undone.
            </p>
            {isActiveRecording ? (
              <p
                className="mt-3 text-sm font-semibold text-grey-500"
                id="start-over-active-recording"
              >
                The current recording will stop and won’t be saved.
              </p>
            ) : null}
            <p
              aria-atomic="true"
              aria-live="polite"
              className={
                recording.isClearingProgress
                  ? "mt-4 text-sm font-semibold text-primary-600"
                  : "sr-only"
              }
              role="status"
            >
              {recording.isClearingProgress
                ? "Clearing your saved intake progress…"
                : ""}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className={quietButtonClassName}
                disabled={recording.isClearingProgress}
                onClick={closeDialog}
                ref={keepProgressRef}
                type="button"
              >
                Keep my progress
              </button>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white outline-offset-4 transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-grey-300"
                disabled={recording.isClearingProgress}
                onClick={() => void confirmStartOver()}
                type="button"
              >
                {recording.isClearingProgress ? "Clearing…" : "Start over"}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
