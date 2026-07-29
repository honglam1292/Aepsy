/// <reference types="vite/client" />

interface ViteTypeOptions {
  readonly strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_ENDPOINT?: string;
}
