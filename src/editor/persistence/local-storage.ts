import { migrateDocument } from "../document/migrate";
import type { DrawCMSDocument } from "../document/schema";
import { deterministicStringify } from "../document/serialize";
import { PersistenceError, type DocumentPersistenceAdapter, type SaveReceipt } from "./types";

/**
 * localStorage-backed adapter for the self-hosted OSS app. Documents are
 * stored as deterministic JSON; legacy payloads are migrated on load. Every
 * storage failure surfaces as a recoverable NETWORK PersistenceError so hosts
 * can offer a retry.
 */
export function createLocalStorageAdapter(
  storageKey = "drawcms.document.v1",
): DocumentPersistenceAdapter {
  let lastSerialized: string | null = null;
  let revision = 0;
  let lastReceipt: SaveReceipt | null = null;

  const storage = (): Storage => {
    if (typeof window === "undefined" || !window.localStorage) {
      throw new PersistenceError("NETWORK", "Local storage is unavailable.", true);
    }
    return window.localStorage;
  };

  return {
    id: "local-storage",
    async load() {
      let raw: string | null;
      try {
        raw = storage().getItem(storageKey);
      } catch {
        return null; // unavailable storage: behave like an empty backend
      }
      if (!raw) return null;
      const document = migrateDocument(JSON.parse(raw));
      lastSerialized = deterministicStringify(document);
      return document;
    },
    async save(document: DrawCMSDocument) {
      const serialized = deterministicStringify(document);
      if (serialized === lastSerialized && lastReceipt) {
        return lastReceipt; // unchanged content must not create a new revision
      }
      try {
        storage().setItem(storageKey, serialized);
      } catch (error) {
        throw new PersistenceError(
          "NETWORK",
          `Could not write to local storage: ${error instanceof Error ? error.message : String(error)}`,
          true,
        );
      }
      revision += 1;
      lastSerialized = serialized;
      lastReceipt = { revision: `local-${revision}`, savedAt: new Date().toISOString() };
      return lastReceipt;
    },
  };
}
