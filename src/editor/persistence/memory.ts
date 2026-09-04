import type { DrawCMSDocument } from "../document/schema";
import { deterministicStringify } from "../document/serialize";
import type { DocumentPersistenceAdapter, SaveReceipt } from "./types";

export interface MemoryAdapterOptions {
  /** Clock override for deterministic tests. */
  now?: () => string;
}

/**
 * In-memory adapter for tests and non-persisting hosts. Saving content that
 * matches the stored document returns the existing receipt instead of
 * creating a new revision.
 */
export function createMemoryAdapter(
  initial?: DrawCMSDocument | null,
  options?: MemoryAdapterOptions,
): DocumentPersistenceAdapter {
  const now = options?.now ?? (() => new Date().toISOString());
  let stored = initial ?? null;
  let storedSerialized = stored ? deterministicStringify(stored) : null;
  let revision = 0;
  let receipt: SaveReceipt | null = null;

  const id = "memory";
  return {
    id,
    async load() {
      return stored;
    },
    async save(document) {
      const serialized = deterministicStringify(document);
      if (storedSerialized === serialized && receipt) {
        return receipt;
      }
      revision += 1;
      stored = document;
      storedSerialized = serialized;
      receipt = { revision: `mem-${revision}`, savedAt: now() };
      return receipt;
    },
  };
}
