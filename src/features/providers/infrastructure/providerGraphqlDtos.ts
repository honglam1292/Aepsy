export interface SearchProvidersVariables {
  readonly pageNum: number;
  readonly pageSize: number;
  readonly rawDisorders: readonly string[];
}

export interface ProviderTagDto {
  readonly type?: string | null;
  readonly subType?: string | null;
  readonly text?: string | null;
}

export interface ProviderDto {
  readonly userInfo?: {
    readonly firebaseUid?: string | null;
    readonly avatar?: string | null;
  } | null;
  readonly userName?: {
    readonly firstName?: string | null;
    readonly lastName?: string | null;
  } | null;
  readonly profile?: {
    readonly providerInfo?: {
      readonly yearExperience?: number | null;
      readonly providerTitle?: string | null;
    } | null;
    readonly providerTagInfo?: {
      readonly tags?: readonly (ProviderTagDto | null)[] | null;
    } | null;
  } | null;
}

export interface SearchProvidersData {
  readonly searchProviders?: {
    readonly id?: string | null;
    readonly providers?: {
      readonly canLoadMore?: boolean | null;
      readonly totalSize?: number | null;
      readonly providers?: readonly (ProviderDto | null)[] | null;
    } | null;
  } | null;
}
