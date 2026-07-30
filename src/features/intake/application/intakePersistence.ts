import type { PersistedIntakeStateV1 } from "../persistence/persistedIntakeState";

export type IntakeMetadataLoadResult =
  | { readonly status: "loaded"; readonly state: PersistedIntakeStateV1 }
  | { readonly status: "empty" }
  | { readonly status: "invalid" }
  | { readonly status: "versionMismatch" }
  | { readonly status: "unavailable" }
  | { readonly status: "failed" };

export type IntakeMetadataSaveResult =
  | { readonly status: "saved" }
  | { readonly status: "unavailable" }
  | { readonly status: "failed" };

export type IntakeMetadataClearResult =
  | { readonly status: "cleared" }
  | { readonly status: "unavailable" }
  | { readonly status: "failed" };

export interface IntakeMetadataRepository {
  load(): IntakeMetadataLoadResult;
  save(state: PersistedIntakeStateV1): IntakeMetadataSaveResult;
  clear(): IntakeMetadataClearResult;
}
