import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const suppliedGraphqlEndpoint = "https://api-dev.aepsy.com/graphql";
const configuredGraphqlEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT?.trim();

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: configuredGraphqlEndpoint || suppliedGraphqlEndpoint,
  }),
  cache: new InMemoryCache(),
});

