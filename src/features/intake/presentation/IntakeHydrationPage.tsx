import { useEffect, useRef, type ReactElement } from "react";

import { useIntakePersistence } from "../application/useIntakePersistence";

const primaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-primary-600 px-6 py-3 font-semibold text-white outline-offset-4 transition-colors hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-focus";

const secondaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-primary-400 bg-white px-6 py-3 font-semibold text-primary-600 outline-offset-4 transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-focus";

function getRecoveryMessage(
  reason: Extract<
    ReturnType<typeof useIntakePersistence>["hydration"],
    { readonly status: "recoveryRequired" }
  >["reason"],
  canRetry: boolean,
): string {
  switch (reason) {
    case "metadataUnavailable":
      return "This browser can’t access saved intake progress right now. You can continue in this tab, but refreshing or closing it will clear new progress.";
    case "metadataReadFailed":
      return "We couldn’t access your saved progress. You can try again or continue without restoring it.";
    case "audioUnavailable":
      return canRetry
        ? "We couldn’t reopen your saved voice note. You can try again or continue by recording a new one."
        : "This browser can’t reopen your saved voice note. Continue in this tab to record a new one.";
    default:
      return assertNever(reason);
  }
}

function assertNever(unhandledValue: never): never {
  void unhandledValue;
  throw new Error("Unhandled hydration recovery value.");
}

export function IntakeHydrationPage(): ReactElement {
  const persistence = useIntakePersistence();
  const loadingStatusRef = useRef<HTMLDivElement>(null);
  const recoveryStatusRef = useRef<HTMLElement>(null);
  const hasShownRecoveryRef = useRef(false);

  useEffect(() => {
    if (
      persistence.hydration.status === "hydrating" &&
      hasShownRecoveryRef.current
    ) {
      loadingStatusRef.current?.focus();
    } else if (persistence.hydration.status === "recoveryRequired") {
      hasShownRecoveryRef.current = true;
      recoveryStatusRef.current?.focus();
    }
  }, [persistence.hydration.status]);

  if (persistence.hydration.status === "hydrating") {
    return (
      <main className="grid min-h-svh place-items-center bg-primary-100 px-5">
        <div
          aria-live="polite"
          className="w-[calc(100vw-2.5rem)] max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm"
          ref={loadingStatusRef}
          role="status"
          tabIndex={-1}
        >
          <p className="font-serif text-2xl text-primary-600">
            Getting your intake ready…
          </p>
          <p className="mt-3 leading-7 text-grey-500">
            This should only take a moment.
          </p>
        </div>
      </main>
    );
  }

  if (persistence.hydration.status === "ready") {
    return <></>;
  }

  return (
    <main className="grid min-h-svh place-items-center bg-primary-100 px-5">
      <section
        aria-labelledby="recovery-title"
        className="w-[calc(100vw-2.5rem)] max-w-xl rounded-3xl bg-white p-8 shadow-sm sm:p-10"
        ref={recoveryStatusRef}
        tabIndex={-1}
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
          Saved progress
        </p>
        <h1
          className="mt-3 font-serif text-3xl text-primary-600"
          id="recovery-title"
        >
          {persistence.hydration.canRetry
            ? "We couldn’t restore saved progress yet"
            : "Saved progress isn’t available in this browser"}
        </h1>
        <p className="mt-4 leading-7 text-grey-500" role="status">
          {getRecoveryMessage(
            persistence.hydration.reason,
            persistence.hydration.canRetry,
          )}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {persistence.hydration.canRetry ? (
            <button
              className={primaryButtonClassName}
              onClick={persistence.retryHydration}
              type="button"
            >
              Try again
            </button>
          ) : null}
          <button
            className={
              persistence.hydration.canRetry
                ? secondaryButtonClassName
                : primaryButtonClassName
            }
            onClick={persistence.continueWithoutRestoring}
            type="button"
          >
            Continue in this tab
          </button>
        </div>
      </section>
    </main>
  );
}
