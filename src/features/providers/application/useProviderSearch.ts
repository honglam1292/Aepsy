import { useCallback, useEffect, useRef } from "react";

import { useIntakeWorkflow } from "../../intake/application/useIntakeWorkflow";
import type { ProviderSearchState } from "../domain/providerSearchState";
import type { ProviderSearchExecutor } from "./providerSearchExecutor";

// The development API rejects page 0, so its pagination is one-based.
export const PROVIDER_FIRST_PAGE_NUMBER = 1;
export const PROVIDER_PAGE_SIZE = 6;

interface ActiveProviderRequest {
  readonly kind: "initial" | "loadMore";
  readonly searchId: string;
  readonly requestId: string;
  readonly pageNumber: number;
  readonly selectedTopicValues: readonly string[];
}

interface UseProviderSearchOptions {
  readonly executor: ProviderSearchExecutor;
}

export interface ProviderSearchController {
  readonly providerSearch: ProviderSearchState;
  loadMore(): void;
  retryInitialSearch(): void;
}

function selectionsMatch(
  firstSelection: readonly string[],
  secondSelection: readonly string[],
): boolean {
  return (
    firstSelection.length === secondSelection.length &&
    firstSelection.every(
      (topicValue, index) => topicValue === secondSelection[index],
    )
  );
}

export function useProviderSearch({
  executor,
}: UseProviderSearchOptions): ProviderSearchController {
  const { state, dispatch, getState } = useIntakeWorkflow();
  const activeRequestRef = useRef<ActiveProviderRequest | null>(null);
  const requestSequenceRef = useRef(0);
  const searchSequenceRef = useRef(0);
  const isMountedRef = useRef(true);

  const isCurrentRequest = useCallback(
    (request: ActiveProviderRequest): boolean => {
      if (!isMountedRef.current || activeRequestRef.current !== request) {
        return false;
      }

      const providerSearch = getState().providerSearch;
      if (
        !selectionsMatch(
          providerSearch.status === "unavailable"
            ? []
            : providerSearch.selectedTopicValues,
          request.selectedTopicValues,
        )
      ) {
        return false;
      }

      if (request.kind === "initial") {
        return (
          providerSearch.status === "loadingInitial" &&
          providerSearch.searchId === request.searchId &&
          providerSearch.requestId === request.requestId &&
          providerSearch.pageNumber === request.pageNumber
        );
      }

      return (
        providerSearch.status === "loadingMore" &&
        providerSearch.searchId === request.searchId &&
        providerSearch.requestId === request.requestId &&
        providerSearch.pageNumber === request.pageNumber
      );
    },
    [getState],
  );

  const dispatchCancellation = useCallback(
    (request: ActiveProviderRequest): void => {
      dispatch({
        type:
          request.kind === "initial"
            ? "providerSearchCancelled"
            : "providerPageLoadCancelled",
        searchId: request.searchId,
        requestId: request.requestId,
        pageNumber: request.pageNumber,
      });
    },
    [dispatch],
  );

  const runRequest = useCallback(
    async (request: ActiveProviderRequest): Promise<void> => {
      try {
        const page = await executor.searchProviders({
          pageNum: request.pageNumber,
          pageSize: PROVIDER_PAGE_SIZE,
          rawDisorders: request.selectedTopicValues,
        });
        if (!isCurrentRequest(request)) {
          return;
        }

        dispatch(
          request.kind === "initial"
            ? {
                type: "providerSearchSucceeded",
                searchId: request.searchId,
                requestId: request.requestId,
                pageNumber: request.pageNumber,
                page,
              }
            : {
                type: "providerPageLoaded",
                searchId: request.searchId,
                requestId: request.requestId,
                pageNumber: request.pageNumber,
                page,
              },
        );
      } catch {
        if (!isCurrentRequest(request)) {
          return;
        }

        dispatch({
          type:
            request.kind === "initial"
              ? "providerSearchFailed"
              : "providerPageLoadFailed",
          searchId: request.searchId,
          requestId: request.requestId,
          pageNumber: request.pageNumber,
        });
      } finally {
        if (activeRequestRef.current === request) {
          activeRequestRef.current = null;
        }
      }
    },
    [dispatch, executor, isCurrentRequest],
  );

  const startInitialSearch = useCallback((): void => {
    if (activeRequestRef.current !== null) {
      return;
    }

    const providerSearch = getState().providerSearch;
    if (
      (providerSearch.status !== "notStarted" &&
        providerSearch.status !== "initialError") ||
      providerSearch.selectedTopicValues.length === 0
    ) {
      return;
    }

    searchSequenceRef.current += 1;
    requestSequenceRef.current += 1;
    const request: ActiveProviderRequest = {
      kind: "initial",
      searchId: `provider-search-${searchSequenceRef.current}`,
      requestId: `provider-request-${requestSequenceRef.current}`,
      pageNumber: PROVIDER_FIRST_PAGE_NUMBER,
      selectedTopicValues: providerSearch.selectedTopicValues,
    };
    activeRequestRef.current = request;
    dispatch({
      type: "providerSearchStarted",
      selectedTopicValues: request.selectedTopicValues,
      searchId: request.searchId,
      requestId: request.requestId,
      pageNumber: request.pageNumber,
    });

    if (!isCurrentRequest(request)) {
      activeRequestRef.current = null;
      return;
    }

    void runRequest(request);
  }, [dispatch, getState, isCurrentRequest, runRequest]);

  const startPageLoad = useCallback((): void => {
    if (activeRequestRef.current !== null) {
      return;
    }

    const providerSearch = getState().providerSearch;
    if (
      (providerSearch.status !== "ready" &&
        providerSearch.status !== "loadMoreError") ||
      providerSearch.nextPageNumber === null
    ) {
      return;
    }

    requestSequenceRef.current += 1;
    const request: ActiveProviderRequest = {
      kind: "loadMore",
      searchId: providerSearch.searchId,
      requestId: `provider-request-${requestSequenceRef.current}`,
      pageNumber: providerSearch.nextPageNumber,
      selectedTopicValues: providerSearch.selectedTopicValues,
    };
    activeRequestRef.current = request;
    dispatch({
      type: "providerPageLoadStarted",
      searchId: request.searchId,
      requestId: request.requestId,
      pageNumber: request.pageNumber,
    });

    if (!isCurrentRequest(request)) {
      activeRequestRef.current = null;
      return;
    }

    void runRequest(request);
  }, [dispatch, getState, isCurrentRequest, runRequest]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      const request = activeRequestRef.current;
      activeRequestRef.current = null;
      if (request !== null) {
        dispatchCancellation(request);
      }
    };
  }, [dispatchCancellation]);

  const selectedTopicValues =
    state.providerSearch.status === "unavailable"
      ? []
      : state.providerSearch.selectedTopicValues;
  const selectionKey = JSON.stringify(selectedTopicValues);

  useEffect(() => {
    const providerSearch = getState().providerSearch;
    const request = activeRequestRef.current;
    const currentSelection =
      providerSearch.status === "unavailable"
        ? []
        : providerSearch.selectedTopicValues;

    if (
      request !== null &&
      !selectionsMatch(request.selectedTopicValues, currentSelection)
    ) {
      activeRequestRef.current = null;
      dispatchCancellation(request);
    }

    if (providerSearch.status === "notStarted") {
      startInitialSearch();
    }
  }, [
    dispatchCancellation,
    getState,
    selectionKey,
    startInitialSearch,
    state.providerSearch.status,
  ]);

  return {
    providerSearch: state.providerSearch,
    loadMore: startPageLoad,
    retryInitialSearch: startInitialSearch,
  };
}
