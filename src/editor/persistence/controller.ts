import type { DrawCMSDocument } from "../document/schema";
import { deterministicStringify } from "../document/serialize";
import { isPersistenceError, PersistenceError, type DocumentPersistenceAdapter } from "./types";

export type PersistenceStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface PersistenceControllerOptions {
  debounceMs?: number;
  /** How long the "saved" status lingers before returning to idle. */
  savedIdleDelayMs?: number;
  onStatus?: (status: PersistenceStatus, error: PersistenceError | null) => void;
}

/**
 * Debounced, coalescing save controller shared by every host (DM-014).
 *
 * - `schedule` debounces; `flush` persists immediately and waits until every
 *   change queued before the save loop settles has completed.
 * - Multiple changes during one in-flight save coalesce into a follow-up save
 *   (revision marching), never into concurrent writes.
 * - Content identical to the last saved snapshot is never persisted, so
 *   unchanged documents do not create versions.
 * - Failures surface through onStatus as recoverable or permanent errors.
 */
export interface PersistenceController {
  schedule(document: DrawCMSDocument): void;
  flush(): Promise<void>;
  /** @deprecated Use `flush` for explicit/manual saves. */
  saveNow(): Promise<void>;
  /** The unsaved document, for hosts that flush on page unload (beacon). */
  getPendingDocument(): DrawCMSDocument | null;
  hasPendingChanges(): boolean;
  getStatus(): PersistenceStatus;
  destroy(): void;
}

export function createPersistenceController(
  adapter: DocumentPersistenceAdapter,
  options?: PersistenceControllerOptions,
): PersistenceController {
  const debounceMs = options?.debounceMs ?? 2000;
  const savedIdleDelayMs = options?.savedIdleDelayMs ?? 3000;

  let status: PersistenceStatus = "idle";
  let latestDocument: DrawCMSDocument | null = null;
  let latestRevision = 0;
  let savingRevision = 0;
  let savedRevision = 0;
  let savedSerialized: string | null = null;
  let destroyed = false;
  let activeSave: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (next: PersistenceStatus, error: PersistenceError | null = null) => {
    status = next;
    options?.onStatus?.(next, error);
  };

  const clearDebounce = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const markSaved = () => {
    setStatus("saved");
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!destroyed && status === "saved") setStatus("idle");
    }, savedIdleDelayMs);
  };

  const runSaveLoop = async () => {
    clearDebounce();

    while (!destroyed && latestRevision !== savedRevision && latestDocument) {
      savingRevision = latestRevision;
      const document = latestDocument;
      setStatus("saving");

      try {
        await adapter.save(document);
        if (destroyed) return;
        savedRevision = savingRevision;
        savedSerialized = deterministicStringify(document);
      } catch (error) {
        if (destroyed) return;
        const persistenceError = isPersistenceError(error)
          ? error
          : new PersistenceError(
              "UNKNOWN",
              error instanceof Error ? error.message : String(error),
              true,
            );
        setStatus("error", persistenceError);
        return;
      }
    }

    if (!destroyed && latestRevision === savedRevision && savedRevision > 0) markSaved();
  };

  // A change can arrive in the microtask between runSaveLoop reporting
  // "saved" and activeSave being cleared. Re-check the revision after every
  // completed loop so that settling-window edits cannot be stranded without a
  // debounce timer.
  const drainSaveQueue = async () => {
    do {
      await runSaveLoop();
    } while (
      !destroyed &&
      status !== "error" &&
      latestRevision !== savedRevision &&
      latestDocument
    );
  };

  const flush = () => {
    if (destroyed || latestRevision === savedRevision || !latestDocument) {
      return activeSave ?? Promise.resolve();
    }
    if (!activeSave) {
      activeSave = drainSaveQueue().finally(() => {
        activeSave = null;
      });
    }
    return activeSave;
  };

  return {
    schedule(document) {
      if (destroyed) return;
      const serialized = deterministicStringify(document);
      const matchesLastSave = savedSerialized !== null && serialized === savedSerialized;

      // Reverting before the debounce fires cancels the queued intermediate
      // document. If a write is already in flight, keep the reverted snapshot
      // queued so the save loop restores it immediately after that write.
      if (matchesLastSave && !activeSave) {
        if (latestRevision === savedRevision) return;
        clearDebounce();
        latestDocument = document;
        latestRevision += 1;
        savedRevision = latestRevision;
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        markSaved();
        return;
      }

      latestDocument = document;
      latestRevision += 1;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (activeSave) {
        if (status === "saved" || status === "idle") setStatus("dirty");
        return;
      }
      setStatus("dirty");
      clearDebounce();
      timer = setTimeout(() => {
        void flush();
      }, debounceMs);
    },
    flush,
    async saveNow() {
      await flush();
    },
    getPendingDocument() {
      return latestRevision === savedRevision ? null : latestDocument;
    },
    hasPendingChanges() {
      return latestRevision !== savedRevision;
    },
    getStatus() {
      return status;
    },
    destroy() {
      destroyed = true;
      clearDebounce();
      if (idleTimer) clearTimeout(idleTimer);
    },
  };
}
