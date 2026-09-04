import type { DrawCMSDocument } from "../document/schema";

export type PersistenceErrorCode = "NETWORK" | "CONFLICT" | "FORBIDDEN" | "VALIDATION" | "UNKNOWN";

/**
 * Adapter failures carry whether a host should offer a retry. Recoverable
 * failures (network, conflicts) keep pending changes saveable; permanent ones
 * (forbidden, validation) require user intervention.
 */
export class PersistenceError extends Error {
  constructor(
    readonly code: PersistenceErrorCode,
    message: string,
    readonly recoverable: boolean,
  ) {
    super(message);
    this.name = "PersistenceError";
  }
}

export function isPersistenceError(error: unknown): error is PersistenceError {
  return error instanceof PersistenceError;
}

export interface SaveReceipt {
  /** Adapter-defined version marker for the stored document. */
  revision: string;
  savedAt: string;
}

/**
 * The seam between the editor core and any storage backend (DM-014).
 * Implementations live in the host (cloud uses server actions, the OSS app
 * uses local storage); the editor itself never imports backend SDKs.
 */
export interface DocumentPersistenceAdapter {
  /** Stable identifier of the backend (for example "supabase" or "local-storage"). */
  readonly id: string;
  /** The stored document, or null when nothing has been saved yet. */
  load(): Promise<DrawCMSDocument | null>;
  /** Persist a document; unchanged content must not create new revisions. */
  save(document: DrawCMSDocument): Promise<SaveReceipt>;
}
