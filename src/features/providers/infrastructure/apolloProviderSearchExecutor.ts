import type { ApolloClient } from "@apollo/client";

import type {
  ProviderSearchExecutor,
  ProviderSearchRequest,
} from "../application/providerSearchExecutor";
import { mapProviderSearchResponse } from "./mapProviderSearchResponse";
import type {
  SearchProvidersData,
  SearchProvidersVariables,
} from "./providerGraphqlDtos";
import { SEARCH_PROVIDERS_QUERY } from "./searchProvidersQuery";

export function createApolloProviderSearchExecutor(
  client: ApolloClient,
): ProviderSearchExecutor {
  return {
    async searchProviders(request: ProviderSearchRequest) {
      const result = await client.query<
        SearchProvidersData,
        SearchProvidersVariables
      >({
        query: SEARCH_PROVIDERS_QUERY,
        variables: {
          pageNum: request.pageNum,
          pageSize: request.pageSize,
          rawDisorders: [...request.rawDisorders],
        },
        fetchPolicy: "no-cache",
      });

      return mapProviderSearchResponse(result.data, request.pageNum);
    },
  };
}
