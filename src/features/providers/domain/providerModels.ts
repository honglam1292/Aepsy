export interface ProviderHighlight {
  readonly key: string;
  readonly label: string;
}

export interface ProviderSummary {
  readonly providerId: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly professionalTitle: string | null;
  readonly yearsExperience: number | null;
  readonly highlights: readonly ProviderHighlight[];
}

export interface ProviderSearchPage {
  readonly items: readonly ProviderSummary[];
  readonly totalSize: number | null;
  readonly canLoadMore: boolean;
}
