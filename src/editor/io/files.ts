import type { DrawCMSDocument } from "../document/schema";
import { migrateDocument } from "../document/migrate";
import { createDocument, deterministicStringify } from "../document/serialize";

export const DRAWCMS_FILE_EXTENSION = ".drawcms";

export class DocumentFileError extends Error {
  constructor(
    message: string,
    readonly recoveryHint: string,
  ) {
    super(message);
    this.name = "DocumentFileError";
  }
}

/** Slug suitable for `<slug>.drawcms` and image downloads. */
export function documentFileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "diagram";
}

/** Serialize a document into a `.drawcms` file payload (deterministic). */
export function toDrawcmsFile(document: DrawCMSDocument): {
  filename: string;
  content: string;
} {
  return {
    filename: `${documentFileSlug(document.meta.name)}${DRAWCMS_FILE_EXTENSION}`,
    content: deterministicStringify(document),
  };
}

/**
 * Parse a `.drawcms` file into a current-version document. Invalid JSON,
 * non-document content, and unknown future versions all fail with recovery
 * guidance, never a stack of internals (DM-015).
 */
export function parseDrawcmsFile(text: string): DrawCMSDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DocumentFileError(
      "This file is not valid JSON.",
      "Choose a .drawcms file saved by DrawCMS, or import a .drawio or .excalidraw file instead.",
    );
  }
  try {
    return migrateDocument(raw);
  } catch (error) {
    if (error instanceof Error && error.name === "DocumentMigrationError") {
      throw new DocumentFileError(
        "This document version is not supported by this build.",
        "The file may come from a newer DrawCMS. Update the app, or keep working with your current browser copy.",
      );
    }
    throw new DocumentFileError(
      "This file does not contain a readable DrawCMS document.",
      "Try re-saving the file from the app it came from, or start a new diagram.",
    );
  }
}

/** Minimal starter document for "New" actions. */
export function createEmptyDocument(name = "Untitled diagram"): DrawCMSDocument {
  return createDocument({
    nodes: [],
    edges: [],
    meta: { name },
  });
}
