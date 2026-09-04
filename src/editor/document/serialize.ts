import {
  DOCUMENT_SCHEMA_VERSION,
  type DocumentAsset,
  type DocumentCanvas,
  type DocumentMeta,
  type DrawCMSDocument,
} from "./schema";
import { createEmptyMotion, type MotionState } from "../motion/model";
import { createEmptyStory } from "../story/model";
import type { AppEdge, AppNode } from "../types";

export interface CreateDocumentInput {
  nodes: AppNode[];
  edges: AppEdge[];
  meta?: Partial<DocumentMeta>;
  canvas?: DocumentCanvas;
  motion?: MotionState;
}

const DEFAULT_NAME = "Untitled diagram";

/**
 * Asset references are derived from image nodes: `data.imageUrl` holds the
 * displayed (possibly cropped) image; `data._originalImageUrl` holds the
 * uncropped original when a crop was applied. Embedded assets keep their data
 * URL in the node itself; the assets list only references them.
 */
export function deriveAssets(nodes: AppNode[]): DocumentAsset[] {
  const assets: DocumentAsset[] = [];
  for (const node of nodes) {
    if (node.data.type !== "image") continue;
    const uri = (node.data._originalImageUrl as string | undefined) ?? node.data.imageUrl;
    if (!uri) continue;
    assets.push({
      id: `asset-${node.id}`,
      kind: "image",
      source: uri.startsWith("data:") ? "embedded" : "remote",
      uri,
    });
  }
  return assets;
}

/**
 * Build a versioned document from live editor state. Ephemeral fields
 * (`selected`) are stripped. No timestamps are invented here: hosts pass the
 * values they already have so serialization stays deterministic.
 */
export function createDocument(input: CreateDocumentInput): DrawCMSDocument {
  const nodes: DrawCMSDocument["nodes"] = input.nodes.map((node) => {
    // Ephemeral selection state must not enter the document.
    const copy = { ...node };
    delete copy.selected;
    return copy;
  });
  const edges: DrawCMSDocument["edges"] = input.edges.map((edge) => {
    // Selection is canvas UI state, not diagram content. Persisting it
    // creates spurious autosaves and can reopen a document with editing
    // controls unexpectedly active.
    const copy = { ...edge };
    delete copy.selected;
    return copy;
  });
  const motion = input.motion ?? createEmptyMotion();
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    meta: { name: input.meta?.name?.trim() || DEFAULT_NAME, ...input.meta },
    canvas: input.canvas ?? {},
    nodes,
    edges,
    assets: deriveAssets(input.nodes),
    motion: motion.story ? motion : { ...motion, story: createEmptyStory() },
  };
}

/**
 * Serialize a document deterministically: object keys are emitted in sorted
 * order at every depth, so semantically identical documents always produce
 * identical strings (array order is significant state and is preserved).
 */
export function deterministicStringify(document: DrawCMSDocument): string {
  return JSON.stringify(sortForDeterminism(document));
}

function sortForDeterminism(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForDeterminism);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortForDeterminism(record[key]);
    }
    return sorted;
  }
  return value;
}
