import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
} from "@apollo/client";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PersistedIntakeStateV1 } from "../../intake/persistence/persistedIntakeState";
import type {
  ProviderSearchExecutor,
  ProviderSearchRequest,
} from "../application/providerSearchExecutor";
import type {
  ProviderSearchPage,
  ProviderSummary,
} from "../domain/providerModels";
import { createApolloProviderSearchExecutor } from "../infrastructure/apolloProviderSearchExecutor";
import type { SearchProvidersData } from "../infrastructure/providerGraphqlDtos";
import { renderApp } from "../../../test/renderApp";
import {
  createDeferred,
  MemoryAudioRepository,
  MemoryMetadataRepository,
} from "../../../test/testDoubles";

const RECORDING_ID = "recording-for-matches";
const STORED_AUDIO = new Blob(["voice note"], { type: "audio/webm" });
const STRESS_TOPIC_VALUE = "TOPIC_STRESS";

function createMatchesMetadata(
  selectedTopicValues: readonly string[] = [STRESS_TOPIC_VALUE],
): PersistedIntakeStateV1 {
  return {
    version: 1,
    currentStep: "matches",
    recording: {
      status: "completed",
      recordingId: RECORDING_ID,
      durationMs: 1_500,
      mimeType: STORED_AUDIO.type,
      byteSize: STORED_AUDIO.size,
    },
    topics: {
      status: "processed",
      sourceRecordingId: RECORDING_ID,
      suggestions: [
        { topicValue: STRESS_TOPIC_VALUE, label: "Work stress" },
      ],
      selectedTopicValues,
    },
    unfinishedRecordingAttemptId: null,
  };
}

function renderMatches(
  providerSearchExecutor: ProviderSearchExecutor,
  metadata = createMatchesMetadata(),
) {
  const audioRepository = new MemoryAudioRepository();
  const metadataRepository = new MemoryMetadataRepository(metadata);
  audioRepository.storedAudio.set(RECORDING_ID, STORED_AUDIO);

  return renderApp("/matches", {
    audioRepository,
    metadataRepository,
    providerSearchExecutor,
  });
}

function createProvider(
  overrides: Partial<ProviderSummary> = {},
): ProviderSummary {
  return {
    providerId: "firebase:provider-1",
    displayName: "Ada Lovelace",
    avatarUrl: null,
    professionalTitle: "Clinical psychologist",
    yearsExperience: 8,
    highlights: [{ key: "focus:stress", label: "Stress" }],
    ...overrides,
  };
}

function createPage(
  items: readonly ProviderSummary[],
  canLoadMore: boolean,
  totalSize: number | null = items.length,
): ProviderSearchPage {
  return { items, canLoadMore, totalSize };
}

describe("psychologist search and pagination", () => {
  it("passes topic values and page variables through Apollo and maps nullable data", async () => {
    let capturedVariables: Readonly<Record<string, unknown>> | null = null;
    const response: SearchProvidersData = {
      searchProviders: {
        providers: {
          canLoadMore: false,
          totalSize: 2,
          providers: [
            {
              userInfo: { firebaseUid: " provider-1 ", avatar: " " },
              userName: { firstName: " Ada ", lastName: " Lovelace " },
              profile: {
                providerInfo: {
                  yearExperience: 1,
                  providerTitle: " Clinical psychologist ",
                },
                providerTagInfo: {
                  tags: [
                    { type: "focus", subType: "topic", text: "Stress" },
                    { type: "focus", subType: "topic", text: "Stress" },
                    null,
                  ],
                },
              },
            },
            {
              userInfo: null,
              userName: null,
              profile: null,
            },
          ],
        },
      },
    };
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink((operation) => {
        capturedVariables = operation.variables;
        return new Observable((observer) => {
          observer.next({ data: response });
          observer.complete();
        });
      }),
    });
    const executor = createApolloProviderSearchExecutor(client);

    const result = await executor.searchProviders({
      pageNum: 1,
      pageSize: 6,
      rawDisorders: [STRESS_TOPIC_VALUE],
    });
    client.stop();

    expect(capturedVariables).toEqual({
      pageNum: 1,
      pageSize: 6,
      rawDisorders: [STRESS_TOPIC_VALUE],
    });
    expect(capturedVariables).not.toEqual(
      expect.objectContaining({ rawDisorders: ["Work stress"] }),
    );
    expect(result).toEqual({
      items: [
        {
          providerId: "firebase:provider-1",
          displayName: "Ada Lovelace",
          avatarUrl: null,
          professionalTitle: "Clinical psychologist",
          yearsExperience: 1,
          highlights: [{ key: "focus:topic:Stress", label: "Stress" }],
        },
        {
          providerId: "fallback:anonymous:1:1",
          displayName: null,
          avatarUrl: null,
          professionalTitle: null,
          yearsExperience: null,
          highlights: [],
        },
      ],
      totalSize: 2,
      canLoadMore: false,
    });
  });

  it("shows loading, mapped provider details, and neutral missing-field fallbacks", async () => {
    const initialRequest = createDeferred<ProviderSearchPage>();
    const executorMock = vi.fn(() => initialRequest.promise);
    renderMatches({ searchProviders: executorMock });

    expect(
      await screen.findByRole("heading", {
        name: "Finding psychologists for you",
      }),
    ).toBeVisible();

    await act(async () => {
      initialRequest.resolve(
        createPage([
          createProvider(),
          createProvider({
            providerId: "fallback:anonymous:1:1",
            displayName: null,
            professionalTitle: null,
            yearsExperience: null,
            highlights: [],
          }),
        ], false),
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
    const anonymousCard = screen
      .getByRole("heading", { name: "Psychologist profile" })
      .closest("article");
    expect(anonymousCard).not.toBeNull();
    if (anonymousCard !== null) {
      expect(
        within(anonymousCard).getByText(
          "Additional profile details aren’t available.",
        ),
      ).toBeVisible();
      expect(within(anonymousCard).queryByRole("img")).not.toBeInTheDocument();
    }
  });

  it("prevents repeated Load More requests, appends a page, and removes duplicates", async () => {
    const user = userEvent.setup();
    const nextPageRequest = createDeferred<ProviderSearchPage>();
    const firstProvider = createProvider();
    const secondProvider = createProvider({
      providerId: "firebase:provider-2",
      displayName: "Grace Hopper",
    });
    const executorMock = vi.fn((request: ProviderSearchRequest) =>
      request.pageNum === 1
        ? Promise.resolve(createPage([firstProvider], true, 2))
        : nextPageRequest.promise,
    );
    renderMatches({ searchProviders: executorMock });

    expect(
      await screen.findByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
    const loadMoreButton = screen.getByRole("button", {
      name: "Load more psychologists",
    });
    await user.click(loadMoreButton);

    const loadingButton = screen.getByRole("button", {
      name: "Loading more psychologists…",
    });
    expect(loadingButton).toBeDisabled();
    await user.click(loadingButton);
    expect(executorMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      nextPageRequest.resolve(
        createPage([firstProvider, secondProvider], false, 2),
      );
    });

    expect(
      await screen.findByRole("heading", { name: "Grace Hopper" }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("heading", { name: "Ada Lovelace" }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Load more psychologists" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("You’ve reached the end of the available matches."),
    ).toBeVisible();
  });

  it("keeps existing matches after a Load More failure and retries that page", async () => {
    const user = userEvent.setup();
    const firstProvider = createProvider();
    const secondProvider = createProvider({
      providerId: "firebase:provider-2",
      displayName: "Grace Hopper",
    });
    const executorMock = vi.fn<ProviderSearchExecutor["searchProviders"]>();
    executorMock
      .mockResolvedValueOnce(createPage([firstProvider], true, 2))
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(createPage([secondProvider], false, 2));
    renderMatches({ searchProviders: executorMock });

    expect(
      await screen.findByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Load more psychologists" }),
    );

    expect(
      await screen.findByText(
        "We couldn’t load more psychologists. The matches already shown are still here.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Retry loading more psychologists",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Grace Hopper" }),
    ).toBeVisible();
    expect(executorMock).toHaveBeenCalledTimes(3);
  });

  it("offers Retry after an initial error and then shows an empty state", async () => {
    const user = userEvent.setup();
    const executorMock = vi.fn<ProviderSearchExecutor["searchProviders"]>();
    executorMock
      .mockRejectedValueOnce(new Error("private network details"))
      .mockResolvedValueOnce(createPage([], false, 0));
    renderMatches({ searchProviders: executorMock });

    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t load your matches",
      }),
    ).toBeVisible();
    expect(screen.queryByText("private network details")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Retry psychologist search" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "No matches found this time",
      }),
    ).toBeVisible();
    expect(executorMock).toHaveBeenCalledTimes(2);
  });
});
