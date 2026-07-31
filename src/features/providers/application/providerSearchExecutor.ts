import type { ProviderSearchPage } from "../domain/providerModels";

export interface ProviderSearchRequest {
  readonly pageNum: number;
  readonly pageSize: number;
  readonly rawDisorders: readonly string[];
}

export interface ProviderSearchExecutor {
  searchProviders(request: ProviderSearchRequest): Promise<ProviderSearchPage>;
}
