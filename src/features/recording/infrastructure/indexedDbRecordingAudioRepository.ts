import type {
  RecordingAudioClearResult,
  RecordingAudioDeleteResult,
  RecordingAudioLoadResult,
  RecordingAudioPruneResult,
  RecordingAudioRepository,
  RecordingAudioSaveResult,
} from "../application/recordingAudioRepository";

const DATABASE_NAME = "aepsy-intake";
const DATABASE_VERSION = 1;
const AUDIO_STORE_NAME = "recording-audio";

interface StoredRecordingAudio {
  readonly recordingId: string;
  readonly audio: Blob;
}

function getBrowserIndexedDb(): IDBFactory | null {
  try {
    return typeof globalThis.indexedDB === "undefined"
      ? null
      : globalThis.indexedDB;
  } catch {
    return null;
  }
}

function openDatabase(indexedDbFactory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;

    try {
      request = indexedDbFactory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error: unknown) {
      reject(error);
      return;
    }

    let isSettled = false;

    const rejectOpen = (error: unknown): void => {
      if (!isSettled) {
        isSettled = true;
        reject(error);
      }
    };

    request.onupgradeneeded = () => {
      try {
        const database = request.result;
        if (!database.objectStoreNames.contains(AUDIO_STORE_NAME)) {
          database.createObjectStore(AUDIO_STORE_NAME, {
            keyPath: "recordingId",
          });
        }
      } catch (error: unknown) {
        try {
          request.transaction?.abort();
        } finally {
          rejectOpen(error);
        }
      }
    };

    request.onsuccess = () => {
      if (isSettled) {
        request.result.close();
        return;
      }

      isSettled = true;
      resolve(request.result);
    };
    request.onerror = () =>
      rejectOpen(request.error ?? new Error("IndexedDB open failed."));
    request.onblocked = () =>
      rejectOpen(new Error("IndexedDB open was blocked."));
  });
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

function isStoredRecordingAudio(input: unknown): input is StoredRecordingAudio {
  return (
    typeof input === "object" &&
    input !== null &&
    "recordingId" in input &&
    typeof input.recordingId === "string" &&
    "audio" in input &&
    input.audio instanceof Blob
  );
}

function isValidRecordingId(recordingId: string): boolean {
  return recordingId.trim().length > 0;
}

function pruneAudioStore(
  objectStore: IDBObjectStore,
  retainedRecordingId: string | null,
): void {
  if (retainedRecordingId === null) {
    objectStore.clear();
    return;
  }

  const cursorRequest = objectStore.openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor === null) {
      return;
    }

    if (cursor.primaryKey !== retainedRecordingId) {
      cursor.delete();
    }
    cursor.continue();
  };
}

export function createIndexedDbRecordingAudioRepository(
  indexedDbFactory: IDBFactory | null = getBrowserIndexedDb(),
): RecordingAudioRepository {
  return {
    async load(recordingId: string): Promise<RecordingAudioLoadResult> {
      if (indexedDbFactory === null) {
        return { status: "unsupported" };
      }

      if (!isValidRecordingId(recordingId)) {
        return { status: "failed" };
      }

      let database: IDBDatabase | null = null;

      try {
        database = await openDatabase(indexedDbFactory);
        const transaction = database.transaction(AUDIO_STORE_NAME, "readonly");
        const request: IDBRequest<unknown> = transaction
          .objectStore(AUDIO_STORE_NAME)
          .get(recordingId);
        const [storedAudio] = await Promise.all([
          waitForRequest(request),
          waitForTransaction(transaction),
        ]);

        if (storedAudio === undefined) {
          return { status: "notFound" };
        }

        if (
          !isStoredRecordingAudio(storedAudio) ||
          storedAudio.recordingId !== recordingId
        ) {
          return { status: "failed" };
        }

        return { status: "loaded", audio: storedAudio.audio };
      } catch {
        return { status: "failed" };
      } finally {
        database?.close();
      }
    },

    async save(
      recordingId: string,
      audio: Blob,
    ): Promise<RecordingAudioSaveResult> {
      if (indexedDbFactory === null) {
        return { status: "unsupported" };
      }

      if (!isValidRecordingId(recordingId)) {
        return { status: "failed" };
      }

      let database: IDBDatabase | null = null;

      try {
        database = await openDatabase(indexedDbFactory);
        const transaction = database.transaction(
          AUDIO_STORE_NAME,
          "readwrite",
        );
        transaction.objectStore(AUDIO_STORE_NAME).put({ recordingId, audio });
        await waitForTransaction(transaction);
        return { status: "saved" };
      } catch {
        return { status: "failed" };
      } finally {
        database?.close();
      }
    },

    async delete(recordingId: string): Promise<RecordingAudioDeleteResult> {
      if (indexedDbFactory === null) {
        return { status: "unsupported" };
      }

      if (!isValidRecordingId(recordingId)) {
        return { status: "failed" };
      }

      let database: IDBDatabase | null = null;

      try {
        database = await openDatabase(indexedDbFactory);
        const transaction = database.transaction(
          AUDIO_STORE_NAME,
          "readwrite",
        );
        transaction.objectStore(AUDIO_STORE_NAME).delete(recordingId);
        await waitForTransaction(transaction);
        return { status: "deleted" };
      } catch {
        return { status: "failed" };
      } finally {
        database?.close();
      }
    },

    async prune(
      retainedRecordingId: string | null,
    ): Promise<RecordingAudioPruneResult> {
      if (indexedDbFactory === null) {
        return { status: "unsupported" };
      }

      if (
        retainedRecordingId !== null &&
        !isValidRecordingId(retainedRecordingId)
      ) {
        return { status: "failed" };
      }

      let database: IDBDatabase | null = null;

      try {
        database = await openDatabase(indexedDbFactory);
        const transaction = database.transaction(
          AUDIO_STORE_NAME,
          "readwrite",
        );
        pruneAudioStore(
          transaction.objectStore(AUDIO_STORE_NAME),
          retainedRecordingId,
        );
        await waitForTransaction(transaction);
        return { status: "pruned" };
      } catch {
        return { status: "failed" };
      } finally {
        database?.close();
      }
    },

    async clear(): Promise<RecordingAudioClearResult> {
      if (indexedDbFactory === null) {
        return { status: "unsupported" };
      }

      let database: IDBDatabase | null = null;

      try {
        database = await openDatabase(indexedDbFactory);
        const transaction = database.transaction(
          AUDIO_STORE_NAME,
          "readwrite",
        );
        transaction.objectStore(AUDIO_STORE_NAME).clear();
        await waitForTransaction(transaction);
        return { status: "cleared" };
      } catch {
        return { status: "failed" };
      } finally {
        database?.close();
      }
    },
  };
}

export const indexedDbRecordingAudioRepository =
  createIndexedDbRecordingAudioRepository();
