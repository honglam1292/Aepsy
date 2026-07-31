import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { Link } from "react-router";

import type { ProviderSearchExecutor } from "../application/providerSearchExecutor";
import { useProviderSearch } from "../application/useProviderSearch";
import type { ProviderSummary } from "../domain/providerModels";
import type { ProviderSearchState } from "../domain/providerSearchState";
import { ProviderCard } from "./ProviderCard";

interface MatchesPageProps {
  readonly providerSearchExecutor: ProviderSearchExecutor;
}

type ProviderResultsState = Extract<
  ProviderSearchState,
  {
    readonly status: "ready" | "loadingMore" | "loadMoreError";
  }
>;

const primaryButtonClassName =
  "rounded-full bg-primary-600 px-6 py-3 font-semibold text-white outline-offset-4 transition-colors hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-wait disabled:bg-grey-300 disabled:text-grey-500";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-primary-400 bg-white px-6 py-3 font-semibold text-primary-600 outline-offset-4 transition-colors hover:bg-primary-200 focus-visible:outline-2 focus-visible:outline-focus";

function InitialLoadingPanel({
  statusRef,
}: {
  readonly statusRef: RefObject<HTMLDivElement | null>;
}): ReactElement {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="mt-8 rounded-2xl border border-primary-300 bg-primary-100 p-5 outline-offset-4 focus:outline-2 focus:outline-focus sm:p-7"
      ref={statusRef}
      role="status"
      tabIndex={-1}
    >
      <h2 className="font-serif text-2xl text-primary-600">
        Finding psychologists for you
      </h2>
      <p className="mt-2 max-w-2xl leading-7 text-grey-500">
        We’re looking for psychologists who match your selected topics.
      </p>
    </div>
  );
}

function InitialErrorPanel({
  headingRef,
  retryInitialSearch,
}: {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  retryInitialSearch(): void;
}): ReactElement {
  return (
    <div
      className="mt-8 rounded-2xl border border-rose-300 bg-rose-100 p-5 sm:p-7"
      role="alert"
    >
      <h2
        className="rounded-sm font-serif text-2xl text-primary-600 outline-offset-4 focus:outline-2 focus:outline-focus"
        ref={headingRef}
        tabIndex={-1}
      >
        We couldn’t load your matches
      </h2>
      <p className="mt-2 max-w-2xl leading-7 text-grey-500">
        Your topic selections are still here. Please try the search again.
      </p>
      <button
        className={`${primaryButtonClassName} mt-5`}
        onClick={retryInitialSearch}
        type="button"
      >
        Retry psychologist search
      </button>
    </div>
  );
}

function formatResultsCount(
  visibleCount: number,
  totalSize: number | null,
): string {
  const noun = totalSize === 1 ? "psychologist" : "psychologists";
  return totalSize === null
    ? `${visibleCount} ${visibleCount === 1 ? "psychologist" : "psychologists"} shown`
    : `Showing ${visibleCount} of ${totalSize} ${noun}`;
}

function getReliableTotalSize(
  totalSize: number | null,
  visibleCount: number,
): number | null {
  return totalSize !== null && totalSize >= visibleCount ? totalSize : null;
}

function ProviderResults({
  endStatusRef,
  firstNewHeadingRef,
  firstNewItemIndex,
  initialOutcomeHeadingRef,
  loadMore,
  loadMoreButtonRef,
  providerSearch,
}: {
  readonly endStatusRef: RefObject<HTMLParagraphElement | null>;
  readonly firstNewHeadingRef: RefObject<HTMLHeadingElement | null>;
  readonly firstNewItemIndex: number | null;
  readonly initialOutcomeHeadingRef: RefObject<HTMLHeadingElement | null>;
  readonly loadMoreButtonRef: RefObject<HTMLButtonElement | null>;
  readonly providerSearch: ProviderResultsState;
  loadMore(): void;
}): ReactElement {
  const hasResults = providerSearch.items.length > 0;
  const canLoadMore = providerSearch.nextPageNumber !== null;
  const isLoadingMore = providerSearch.status === "loadingMore";
  const didLoadMoreFail = providerSearch.status === "loadMoreError";

  return (
    <section className="mt-8" aria-labelledby="provider-results-title">
      {hasResults ? (
        <>
          <div
            aria-live="polite"
            className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
            role="status"
          >
            <div>
              <h2
                className="rounded-sm font-serif text-2xl text-primary-600 outline-offset-4 focus:outline-2 focus:outline-focus"
                id="provider-results-title"
                ref={initialOutcomeHeadingRef}
                tabIndex={-1}
              >
                Psychologists matched to your topics
              </h2>
              <p className="mt-2 text-grey-500">
                {formatResultsCount(
                  providerSearch.items.length,
                  getReliableTotalSize(
                    providerSearch.totalSize,
                    providerSearch.items.length,
                  ),
                )}
              </p>
            </div>
          </div>

          <ul className="mt-6 grid gap-5 lg:grid-cols-2">
            {providerSearch.items.map((provider, providerIndex) => (
              <li key={provider.providerId}>
                <ProviderCard
                  {...(providerIndex === firstNewItemIndex
                    ? { headingRef: firstNewHeadingRef }
                    : {})}
                  provider={provider}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div
          aria-live="polite"
          className="rounded-2xl border border-primary-300 bg-primary-100 p-5 sm:p-7"
          role="status"
        >
          <h2
            className="rounded-sm font-serif text-2xl text-primary-600 outline-offset-4 focus:outline-2 focus:outline-focus"
            id="provider-results-title"
            ref={initialOutcomeHeadingRef}
            tabIndex={-1}
          >
            No matches found this time
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-grey-500">
            You can review your topics and adjust what you’d like support with.
          </p>
        </div>
      )}

      {didLoadMoreFail ? (
        <p
          className="mt-6 rounded-2xl border border-rose-300 bg-rose-100 p-4 leading-7 text-grey-500"
          id="provider-load-more-error"
          role="alert"
        >
          We couldn’t load more psychologists. The matches already shown are
          still here.
        </p>
      ) : null}

      {canLoadMore ? (
        <div className="mt-7 flex justify-center">
          <button
            aria-describedby={
              didLoadMoreFail ? "provider-load-more-error" : undefined
            }
            className={primaryButtonClassName}
            disabled={isLoadingMore}
            onClick={loadMore}
            ref={loadMoreButtonRef}
            type="button"
          >
            {isLoadingMore
              ? "Loading more psychologists…"
              : didLoadMoreFail
                ? "Retry loading more psychologists"
                : "Load more psychologists"}
          </button>
        </div>
      ) : hasResults ? (
        <p
          className="mt-7 rounded-sm text-sm font-semibold text-primary-500 outline-offset-4 focus:outline-2 focus:outline-focus"
          ref={endStatusRef}
          role="status"
          tabIndex={-1}
        >
          You’ve reached the end of the available matches.
        </p>
      ) : null}
    </section>
  );
}

function getVisibleProviders(
  providerSearch: ProviderSearchState,
): readonly ProviderSummary[] {
  switch (providerSearch.status) {
    case "ready":
    case "loadingMore":
    case "loadMoreError":
      return providerSearch.items;
    case "unavailable":
    case "notStarted":
    case "loadingInitial":
    case "initialError":
      return [];
    default:
      return assertNever(providerSearch);
  }
}

export function MatchesPage({
  providerSearchExecutor,
}: MatchesPageProps): ReactElement {
  const controller = useProviderSearch({ executor: providerSearchExecutor });
  const initialLoadingRef = useRef<HTMLDivElement>(null);
  const initialErrorHeadingRef = useRef<HTMLHeadingElement>(null);
  const initialOutcomeHeadingRef = useRef<HTMLHeadingElement>(null);
  const endStatusRef = useRef<HTMLParagraphElement>(null);
  const firstNewHeadingRef = useRef<HTMLHeadingElement>(null);
  const loadMoreButtonRef = useRef<HTMLButtonElement>(null);
  const shouldFocusInitialLoadingRef = useRef(false);
  const shouldFocusInitialOutcomeRef = useRef(false);
  const shouldFocusAppendedResultsRef = useRef(false);
  const [firstNewItemIndex, setFirstNewItemIndex] = useState<number | null>(
    null,
  );
  const visibleProviders = getVisibleProviders(controller.providerSearch);

  const handleInitialRetry = (): void => {
    shouldFocusInitialLoadingRef.current = true;
    shouldFocusInitialOutcomeRef.current = true;
    controller.retryInitialSearch();
  };

  const handleLoadMore = (): void => {
    setFirstNewItemIndex(visibleProviders.length);
    shouldFocusAppendedResultsRef.current = true;
    controller.loadMore();
  };

  useEffect(() => {
    if (
      shouldFocusInitialLoadingRef.current &&
      controller.providerSearch.status === "loadingInitial"
    ) {
      shouldFocusInitialLoadingRef.current = false;
      const focusTimeout = globalThis.setTimeout(
        () => initialLoadingRef.current?.focus(),
        0,
      );
      return () => globalThis.clearTimeout(focusTimeout);
    }
  }, [controller.providerSearch.status]);

  useEffect(() => {
    if (!shouldFocusInitialOutcomeRef.current) {
      return;
    }

    if (controller.providerSearch.status === "initialError") {
      shouldFocusInitialOutcomeRef.current = false;
      const focusTimeout = globalThis.setTimeout(() => {
        initialErrorHeadingRef.current?.focus();
      }, 0);
      return () => globalThis.clearTimeout(focusTimeout);
    }

    if (controller.providerSearch.status === "ready") {
      shouldFocusInitialOutcomeRef.current = false;
      const focusTimeout = globalThis.setTimeout(() => {
        initialOutcomeHeadingRef.current?.focus();
      }, 0);
      return () => globalThis.clearTimeout(focusTimeout);
    }
  }, [controller.providerSearch.status]);

  useEffect(() => {
    if (
      !shouldFocusAppendedResultsRef.current ||
      (controller.providerSearch.status !== "ready" &&
        controller.providerSearch.status !== "loadMoreError")
    ) {
      return;
    }

    shouldFocusAppendedResultsRef.current = false;
    if (controller.providerSearch.status === "loadMoreError") {
      return;
    }

    const activeElement = document.activeElement;
    const mayMoveFocus =
      activeElement === document.body ||
      activeElement === loadMoreButtonRef.current;
    if (!mayMoveFocus) {
      return;
    }

    if (
      firstNewItemIndex !== null &&
      controller.providerSearch.items.length > firstNewItemIndex
    ) {
      const focusTimeout = globalThis.setTimeout(
        () => firstNewHeadingRef.current?.focus(),
        0,
      );
      return () => globalThis.clearTimeout(focusTimeout);
    }

    if (controller.providerSearch.nextPageNumber === null) {
      const focusTimeout = globalThis.setTimeout(
        () => endStatusRef.current?.focus(),
        0,
      );
      return () => globalThis.clearTimeout(focusTimeout);
    }
  }, [controller.providerSearch, firstNewItemIndex]);

  let searchContent: ReactElement;
  switch (controller.providerSearch.status) {
    case "unavailable":
    case "notStarted":
    case "loadingInitial":
      searchContent = <InitialLoadingPanel statusRef={initialLoadingRef} />;
      break;
    case "initialError":
      searchContent = (
        <InitialErrorPanel
          headingRef={initialErrorHeadingRef}
          retryInitialSearch={handleInitialRetry}
        />
      );
      break;
    case "ready":
    case "loadingMore":
    case "loadMoreError":
      searchContent = (
        <ProviderResults
          endStatusRef={endStatusRef}
          firstNewHeadingRef={firstNewHeadingRef}
          firstNewItemIndex={firstNewItemIndex}
          initialOutcomeHeadingRef={initialOutcomeHeadingRef}
          loadMore={handleLoadMore}
          loadMoreButtonRef={loadMoreButtonRef}
          providerSearch={controller.providerSearch}
        />
      );
      break;
    default:
      searchContent = assertNever(controller.providerSearch);
  }

  return (
    <section aria-labelledby="matches-title">
      <title>Aepsy | Meet your matches</title>
      <p className="text-sm font-semibold uppercase tracking-widest text-primary-500">
        Step 3 of 3
      </p>
      <h1
        className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-primary-600 sm:text-5xl"
        id="matches-title"
      >
        Meet your matches
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-grey-500">
        These psychologists are ranked using the topics you selected. You can
        return to those topics at any time.
      </p>

      {searchContent}

      <div className="mt-8">
        <Link className={secondaryButtonClassName} to="/topics">
          Back to topics
        </Link>
      </div>
    </section>
  );
}

function assertNever(unhandledValue: never): never {
  void unhandledValue;
  throw new Error("Unhandled provider presentation state.");
}
