import type {
  ProviderHighlight,
  ProviderSearchPage,
  ProviderSummary,
} from "../domain/providerModels";
import type {
  ProviderDto,
  ProviderTagDto,
  SearchProvidersData,
} from "./providerGraphqlDtos";

function cleanString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleanedValue = value.trim();
  return cleanedValue.length === 0 ? null : cleanedValue;
}

function cleanExperience(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function mapHighlights(
  tags: readonly (ProviderTagDto | null)[] | null | undefined,
): readonly ProviderHighlight[] {
  const highlights: ProviderHighlight[] = [];
  const seenLabels = new Set<string>();

  for (const tag of tags ?? []) {
    const label = cleanString(tag?.text);
    if (label === null || seenLabels.has(label)) {
      continue;
    }

    seenLabels.add(label);
    const type = cleanString(tag?.type) ?? "tag";
    const subType = cleanString(tag?.subType) ?? "general";
    highlights.push({ key: `${type}:${subType}:${label}`, label });
  }

  return highlights;
}

function createFallbackProviderId(
  provider: Omit<ProviderSummary, "providerId">,
  pageNum: number,
  providerIndex: number,
  fingerprintOccurrences: Map<string, number>,
): string {
  const identityParts = [
    provider.displayName,
    provider.avatarUrl,
    provider.professionalTitle,
    provider.yearsExperience?.toString() ?? null,
    ...provider.highlights.flatMap((highlight) => [
      highlight.key,
      highlight.label,
    ]),
  ].filter((identityPart): identityPart is string => identityPart !== null);

  if (identityParts.length === 0) {
    return `fallback:anonymous:${pageNum}:${providerIndex}`;
  }

  const profileFingerprint = identityParts
    .map(encodeURIComponent)
    .join("|");
  const occurrence = fingerprintOccurrences.get(profileFingerprint) ?? 0;
  fingerprintOccurrences.set(profileFingerprint, occurrence + 1);
  return `fallback:profile:${profileFingerprint}:${occurrence}`;
}

function mapProvider(
  providerDto: ProviderDto,
  pageNum: number,
  providerIndex: number,
  fingerprintOccurrences: Map<string, number>,
): ProviderSummary {
  const firstName = cleanString(providerDto.userName?.firstName);
  const lastName = cleanString(providerDto.userName?.lastName);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const providerWithoutId = {
    displayName,
    avatarUrl: cleanString(providerDto.userInfo?.avatar),
    professionalTitle: cleanString(
      providerDto.profile?.providerInfo?.providerTitle,
    ),
    yearsExperience: cleanExperience(
      providerDto.profile?.providerInfo?.yearExperience,
    ),
    highlights: mapHighlights(providerDto.profile?.providerTagInfo?.tags),
  } satisfies Omit<ProviderSummary, "providerId">;
  const firebaseUid = cleanString(providerDto.userInfo?.firebaseUid);

  return {
    providerId:
      firebaseUid === null
        ? createFallbackProviderId(
            providerWithoutId,
            pageNum,
            providerIndex,
            fingerprintOccurrences,
          )
        : `firebase:${firebaseUid}`,
    ...providerWithoutId,
  };
}

export function mapProviderSearchResponse(
  response: SearchProvidersData | null | undefined,
  pageNum: number,
): ProviderSearchPage {
  const providerConnection = response?.searchProviders?.providers;
  if (
    providerConnection === null ||
    providerConnection === undefined ||
    providerConnection.providers === null ||
    providerConnection.providers === undefined
  ) {
    throw new Error("Provider results are unavailable.");
  }

  const items: ProviderSummary[] = [];
  const fingerprintOccurrences = new Map<string, number>();

  for (const [providerIndex, providerDto] of providerConnection.providers.entries()) {
    if (providerDto !== null) {
      items.push(
        mapProvider(
          providerDto,
          pageNum,
          providerIndex,
          fingerprintOccurrences,
        ),
      );
    }
  }

  const totalSize = providerConnection?.totalSize;

  return {
    items,
    totalSize:
      typeof totalSize === "number" &&
      Number.isInteger(totalSize) &&
      totalSize >= 0
        ? totalSize
        : null,
    canLoadMore: providerConnection?.canLoadMore === true,
  };
}
