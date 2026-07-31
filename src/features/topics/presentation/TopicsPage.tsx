import {
  useEffect,
  useRef,
  type ReactElement,
  type RefObject,
} from "react";
import { Link, useNavigate } from "react-router";

import type { TopicsState } from "../../intake/domain/intakeTypes";
import { useTopicProcessing } from "../application/useTopicProcessing";
import type { AudioTranscriptionProcessor } from "../application/useAudioTranscriber";
import type { AudioBufferReader } from "../infrastructure/browserAudioBufferAdapter";
import { TopicSelector } from "./TopicSelector";

interface TopicsPageProps {
  readonly audioBufferReader: AudioBufferReader;
  readonly audioProcessor: AudioTranscriptionProcessor;
}

const primaryButtonClassName =
  "rounded-full bg-primary-600 px-6 py-3 font-semibold text-white outline-offset-4 transition-colors hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-grey-300 disabled:text-grey-500";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-primary-400 bg-white px-6 py-3 font-semibold text-primary-600 outline-offset-4 transition-colors hover:bg-primary-200 focus-visible:outline-2 focus-visible:outline-focus";

type VisibleTopicStatus = Exclude<TopicsState["status"], "unavailable">;

function getVisibleStatus(topics: TopicsState): VisibleTopicStatus {
  return topics.status === "unavailable" ? "processing" : topics.status;
}

function ProcessingPanel({
  headingRef,
}: {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
}): ReactElement {
  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      className="mt-8 rounded-2xl border border-primary-300 bg-primary-100 p-5 sm:p-7"
      role="status"
    >
      <h2
        className="rounded-sm font-serif text-2xl text-primary-600 outline-offset-4 focus:outline-2 focus:outline-focus"
        ref={headingRef}
        tabIndex={-1}
      >
        Processing your voice note
      </h2>
      <p className="mt-2 max-w-2xl leading-7 text-grey-500">
        We’re preparing topic suggestions. This usually takes a couple of
        seconds.
      </p>
    </section>
  );
}

function RecoveryPanel({
  headingRef,
  isEmpty,
  reason,
  retryProcessing,
}: {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly isEmpty: boolean;
  readonly reason: "audioUnavailable" | "processingFailed" | null;
  retryProcessing(): void;
}): ReactElement {
  const title = isEmpty
    ? "No topic suggestions were found"
    : "We couldn’t prepare topic suggestions";
  const message = isEmpty
    ? "You can try processing the voice note again, or return to recording and make a new one."
    : reason === "audioUnavailable"
      ? "We couldn’t read the completed voice note. Try again, or return to recording to check it."
      : "Please try again. If it still doesn’t work, return to recording and make a new voice note.";

  return (
    <section
      aria-live={isEmpty ? "polite" : "assertive"}
      className="mt-8 rounded-2xl border border-primary-300 bg-primary-100 p-5 sm:p-7"
      role={isEmpty ? "status" : "alert"}
    >
      <h2
        className="rounded-sm font-serif text-2xl text-primary-600 outline-offset-4 focus:outline-2 focus:outline-focus"
        ref={headingRef}
        tabIndex={-1}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-2xl leading-7 text-grey-500">{message}</p>
      <button
        className={`${primaryButtonClassName} mt-5`}
        onClick={retryProcessing}
        type="button"
      >
        Retry processing
      </button>
    </section>
  );
}

function TopicResults({
  headingRef,
  setTopicSelected,
  topics,
}: {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly topics: Extract<TopicsState, { readonly status: "processed" }>;
  setTopicSelected(topicValue: string, isSelected: boolean): void;
}): ReactElement {
  return (
    <section className="mt-8" aria-labelledby="topic-results-title">
      <div aria-live="polite" role="status">
        <h2
          className="rounded-sm font-serif text-2xl text-primary-600 outline-offset-4 focus:outline-2 focus:outline-focus"
          id="topic-results-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Your suggested topics are ready
        </h2>
        <p className="mt-2 max-w-2xl leading-7 text-grey-500">
          Choose one or more topics that feel relevant. You can change them
          before continuing.
        </p>
      </div>

      <TopicSelector
        selectedTopicValues={topics.selectedTopicValues}
        setTopicSelected={setTopicSelected}
        suggestions={topics.suggestions}
      />
    </section>
  );
}

export function TopicsPage({
  audioBufferReader,
  audioProcessor,
}: TopicsPageProps): ReactElement {
  const navigate = useNavigate();
  const controller = useTopicProcessing({
    audioBufferReader,
    audioProcessor,
  });
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStatusRef = useRef<VisibleTopicStatus>(
    getVisibleStatus(controller.topics),
  );
  const visibleStatus = getVisibleStatus(controller.topics);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = visibleStatus;
    if (
      previousStatus !== visibleStatus &&
      (previousStatus === "processing" || visibleStatus === "processing")
    ) {
      const activeElement = document.activeElement;
      const canMoveFocus =
        activeElement === null ||
        activeElement === document.body ||
        activeElement?.id === "main-content";
      if (canMoveFocus) {
        const focusTimeout = globalThis.setTimeout(
          () => resultHeadingRef.current?.focus(),
          0,
        );
        return () => globalThis.clearTimeout(focusTimeout);
      }
    }
  }, [visibleStatus]);

  let content: ReactElement;
  switch (controller.topics.status) {
    case "unavailable":
    case "processing":
      content = <ProcessingPanel headingRef={resultHeadingRef} />;
      break;
    case "empty":
      content = (
        <RecoveryPanel
          headingRef={resultHeadingRef}
          isEmpty
          reason={null}
          retryProcessing={controller.retryProcessing}
        />
      );
      break;
    case "error":
      content = (
        <RecoveryPanel
          headingRef={resultHeadingRef}
          isEmpty={false}
          reason={controller.topics.reason}
          retryProcessing={controller.retryProcessing}
        />
      );
      break;
    case "processed":
      content = (
        <TopicResults
          headingRef={resultHeadingRef}
          setTopicSelected={controller.setTopicSelected}
          topics={controller.topics}
        />
      );
      break;
    default:
      content = assertNever(controller.topics);
  }

  return (
    <section aria-labelledby="topics-title">
      <title>Aepsy | Review your topics</title>
      <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
        Step 2 of 3
      </p>
      <h1
        className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-primary-600 sm:text-5xl"
        id="topics-title"
        tabIndex={-1}
      >
        Review your topics
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-grey-500">
        We use your completed voice note in this browser flow to suggest words
        for what you may want support with.
      </p>

      <aside className="mt-7 max-w-3xl rounded-2xl border border-primary-200 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-xl text-primary-600">
          Suggestions, not a diagnosis
        </h2>
        <p className="mt-2 leading-7 text-grey-500">
          These topics are a starting point for describing what matters to you.
          They are not a diagnosis, and you decide which ones to keep.
        </p>
      </aside>

      {content}

      <div
        className={`mt-7 flex flex-col gap-3 ${
          controller.topics.status === "processed"
            ? "sm:flex-row sm:items-center sm:justify-between"
            : "items-start"
        }`}
      >
        <Link className={secondaryButtonClassName} to="/record">
          Back to recording
        </Link>
        {controller.topics.status === "processed" ? (
          <div className="text-right">
            {!controller.canContinue ? (
              <p
                className="mb-2 text-sm text-grey-500"
                id="topic-selection-requirement"
              >
                Select at least one topic to continue.
              </p>
            ) : null}
            <button
              aria-describedby={
                controller.canContinue
                  ? undefined
                  : "topic-selection-requirement"
              }
              className={primaryButtonClassName}
              disabled={!controller.canContinue}
              onClick={() => navigate("/matches")}
              type="button"
            >
              Continue to matches
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function assertNever(unhandledTopics: never): never {
  void unhandledTopics;
  throw new Error("Unhandled topic presentation state.");
}
