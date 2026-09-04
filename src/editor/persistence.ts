"use client";

export { isPersistenceError, PersistenceError } from "./persistence/types";
export type {
  DocumentPersistenceAdapter,
  PersistenceErrorCode,
  SaveReceipt,
} from "./persistence/types";
export { createMemoryAdapter } from "./persistence/memory";
export { createLocalStorageAdapter } from "./persistence/local-storage";
export { createPersistenceController } from "./persistence/controller";
export type {
  PersistenceController,
  PersistenceControllerOptions,
  PersistenceStatus,
} from "./persistence/controller";
export { useDocumentPersistence } from "./persistence/use-persistence";
export type { UseDocumentPersistenceOptions } from "./persistence/use-persistence";
