import type { ProviderSearchPage, ProviderSummary } from "./providerModels";

interface ProviderSearchCriteria {
  readonly selectedTopicValues: readonly string[];
}

interface ProviderResultsSnapshot extends ProviderSearchCriteria {
  readonly searchId: string;
  readonly items: readonly ProviderSummary[];
  readonly totalSize: number | null;
  readonly nextPageNumber: number | null;
  readonly loadedPageNumbers: readonly number[];
}

export type ProviderSearchState =
  | { readonly status: "unavailable" }
  | ({ readonly status: "notStarted" } & ProviderSearchCriteria)
  | ({
      readonly status: "loadingInitial";
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
    } & ProviderSearchCriteria)
  | ({
      readonly status: "initialError";
      readonly failedPageNumber: number;
    } & ProviderSearchCriteria)
  | ({ readonly status: "ready" } & ProviderResultsSnapshot)
  | ({
      readonly status: "loadingMore";
      readonly requestId: string;
      readonly pageNumber: number;
    } & ProviderResultsSnapshot)
  | ({
      readonly status: "loadMoreError";
      readonly failedPageNumber: number;
    } & ProviderResultsSnapshot);

export type ProviderSearchEvent =
  | {
      readonly type: "providerSearchStarted";
      readonly selectedTopicValues: readonly string[];
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
    }
  | {
      readonly type: "providerSearchSucceeded";
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
      readonly page: ProviderSearchPage;
    }
  | {
      readonly type: "providerSearchFailed";
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
    }
  | {
      readonly type: "providerSearchCancelled";
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
    }
  | {
      readonly type: "providerPageLoadStarted";
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
    }
  | {
      readonly type: "providerPageLoaded";
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
      readonly page: ProviderSearchPage;
    }
  | {
      readonly type: "providerPageLoadFailed";
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
    }
  | {
      readonly type: "providerPageLoadCancelled";
      readonly searchId: string;
      readonly requestId: string;
      readonly pageNumber: number;
    };

export const unavailableProviderSearch: ProviderSearchState = {
  status: "unavailable",
};

export function createProviderSearchState(
  selectedTopicValues: readonly string[],
): ProviderSearchState {
  return selectedTopicValues.length === 0
    ? unavailableProviderSearch
    : { status: "notStarted", selectedTopicValues };
}

function selectionsMatch(
  currentSelection: readonly string[],
  nextSelection: readonly string[],
): boolean {
  return (
    currentSelection.length === nextSelection.length &&
    currentSelection.every(
      (topicValue, index) => topicValue === nextSelection[index],
    )
  );
}

export function mergeProviderSummaries(
  currentItems: readonly ProviderSummary[],
  incomingItems: readonly ProviderSummary[],
): readonly ProviderSummary[] {
  const mergedItems = [...currentItems];
  const providerIds = new Set(
    currentItems.map((provider) => provider.providerId),
  );

  for (const provider of incomingItems) {
    if (!providerIds.has(provider.providerId)) {
      providerIds.add(provider.providerId);
      mergedItems.push(provider);
    }
  }

  return mergedItems;
}

function isMatchingInitialRequest(
  state: ProviderSearchState,
  event: {
    readonly searchId: string;
    readonly requestId: string;
    readonly pageNumber: number;
  },
): state is Extract<ProviderSearchState, { readonly status: "loadingInitial" }> {
  return (
    state.status === "loadingInitial" &&
    state.searchId === event.searchId &&
    state.requestId === event.requestId &&
    state.pageNumber === event.pageNumber
  );
}

function isMatchingPageRequest(
  state: ProviderSearchState,
  event: {
    readonly searchId: string;
    readonly requestId: string;
    readonly pageNumber: number;
  },
): state is Extract<ProviderSearchState, { readonly status: "loadingMore" }> {
  return (
    state.status === "loadingMore" &&
    state.searchId === event.searchId &&
    state.requestId === event.requestId &&
    state.pageNumber === event.pageNumber
  );
}

function createResultsState(
  state: Extract<ProviderSearchState, { readonly status: "loadingInitial" }>,
  page: ProviderSearchPage,
): Extract<ProviderSearchState, { readonly status: "ready" }> {
  return {
    status: "ready",
    selectedTopicValues: state.selectedTopicValues,
    searchId: state.searchId,
    items: mergeProviderSummaries([], page.items),
    totalSize: page.totalSize,
    nextPageNumber: page.canLoadMore ? state.pageNumber + 1 : null,
    loadedPageNumbers: [state.pageNumber],
  };
}

function restoreReadyState(
  state: Extract<
    ProviderSearchState,
    { readonly status: "ready" | "loadingMore" | "loadMoreError" }
  >,
): Extract<ProviderSearchState, { readonly status: "ready" }> {
  return {
    status: "ready",
    selectedTopicValues: state.selectedTopicValues,
    searchId: state.searchId,
    items: state.items,
    totalSize: state.totalSize,
    nextPageNumber: state.nextPageNumber,
    loadedPageNumbers: state.loadedPageNumbers,
  };
}

export function providerSearchReducer(
  state: ProviderSearchState,
  event: ProviderSearchEvent,
): ProviderSearchState {
  switch (event.type) {
    case "providerSearchStarted":
      if (
        (state.status !== "notStarted" && state.status !== "initialError") ||
        event.selectedTopicValues.length === 0 ||
        !selectionsMatch(
          state.selectedTopicValues,
          event.selectedTopicValues,
        ) ||
        (state.status === "initialError" &&
          state.failedPageNumber !== event.pageNumber)
      ) {
        return state;
      }

      return {
        status: "loadingInitial",
        selectedTopicValues: state.selectedTopicValues,
        searchId: event.searchId,
        requestId: event.requestId,
        pageNumber: event.pageNumber,
      };

    case "providerSearchSucceeded":
      return isMatchingInitialRequest(state, event)
        ? createResultsState(state, event.page)
        : state;

    case "providerSearchFailed":
      if (!isMatchingInitialRequest(state, event)) {
        return state;
      }

      return {
        status: "initialError",
        selectedTopicValues: state.selectedTopicValues,
        failedPageNumber: event.pageNumber,
      };

    case "providerSearchCancelled":
      return isMatchingInitialRequest(state, event)
        ? {
            status: "notStarted",
            selectedTopicValues: state.selectedTopicValues,
          }
        : state;

    case "providerPageLoadStarted": {
      if (
        (state.status !== "ready" && state.status !== "loadMoreError") ||
        state.searchId !== event.searchId ||
        state.nextPageNumber !== event.pageNumber ||
        state.loadedPageNumbers.includes(event.pageNumber)
      ) {
        return state;
      }

      return {
        ...restoreReadyState(state),
        status: "loadingMore",
        requestId: event.requestId,
        pageNumber: event.pageNumber,
      };
    }

    case "providerPageLoaded":
      if (
        !isMatchingPageRequest(state, event) ||
        state.loadedPageNumbers.includes(event.pageNumber)
      ) {
        return state;
      }

      return {
        status: "ready",
        selectedTopicValues: state.selectedTopicValues,
        searchId: state.searchId,
        items: mergeProviderSummaries(state.items, event.page.items),
        totalSize: event.page.totalSize ?? state.totalSize,
        nextPageNumber: event.page.canLoadMore ? event.pageNumber + 1 : null,
        loadedPageNumbers: [...state.loadedPageNumbers, event.pageNumber],
      };

    case "providerPageLoadFailed":
      if (!isMatchingPageRequest(state, event)) {
        return state;
      }

      return {
        ...restoreReadyState(state),
        status: "loadMoreError",
        failedPageNumber: event.pageNumber,
      };

    case "providerPageLoadCancelled":
      return isMatchingPageRequest(state, event)
        ? restoreReadyState(state)
        : state;

    default:
      return assertNever(event);
  }
}

function assertNever(unhandledEvent: never): never {
  void unhandledEvent;
  throw new Error("Unhandled provider search event.");
}
