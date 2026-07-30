import type {
  IntakeMetadataClearResult,
  IntakeMetadataLoadResult,
  IntakeMetadataRepository,
  IntakeMetadataSaveResult,
} from "../application/intakePersistence";
import {
  validatePersistedIntakeState,
  type PersistedIntakeStateV1,
} from "../persistence/persistedIntakeState";

export const INTAKE_METADATA_STORAGE_KEY = "aepsy.intake.metadata";

export interface IntakeMetadataStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserLocalStorage(): IntakeMetadataStorage | null {
  try {
    return typeof globalThis.localStorage === "undefined"
      ? null
      : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function createLocalStorageIntakeMetadataRepository(
  storage: IntakeMetadataStorage | null = getBrowserLocalStorage(),
  storageKey: string = INTAKE_METADATA_STORAGE_KEY,
): IntakeMetadataRepository {
  return {
    load(): IntakeMetadataLoadResult {
      if (storage === null) {
        return { status: "unavailable" };
      }

      let serializedState: string | null;

      try {
        serializedState = storage.getItem(storageKey);
      } catch {
        return { status: "failed" };
      }

      if (serializedState === null) {
        return { status: "empty" };
      }

      let parsedState: unknown;

      try {
        parsedState = JSON.parse(serializedState);
      } catch {
        return { status: "invalid" };
      }

      const validation = validatePersistedIntakeState(parsedState);

      switch (validation.status) {
        case "valid":
          return { status: "loaded", state: validation.state };
        case "invalid":
          return { status: "invalid" };
        case "versionMismatch":
          return { status: "versionMismatch" };
      }
    },

    save(state: PersistedIntakeStateV1): IntakeMetadataSaveResult {
      if (storage === null) {
        return { status: "unavailable" };
      }

      try {
        if (validatePersistedIntakeState(state).status !== "valid") {
          return { status: "failed" };
        }

        storage.setItem(storageKey, JSON.stringify(state));
        return { status: "saved" };
      } catch {
        return { status: "failed" };
      }
    },

    clear(): IntakeMetadataClearResult {
      if (storage === null) {
        return { status: "unavailable" };
      }

      try {
        storage.removeItem(storageKey);
        return { status: "cleared" };
      } catch {
        return { status: "failed" };
      }
    },
  };
}

export const localStorageIntakeMetadataRepository =
  createLocalStorageIntakeMetadataRepository();
