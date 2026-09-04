import { z } from "zod";
import {
  DOCUMENT_SCHEMA_VERSION,
  documentEdgeSchema,
  documentNodeSchema,
  documentV1Schema,
  documentV2Schema,
  documentV3Schema,
  documentV4Schema,
  parseDocument,
  type DrawCMSDocument,
  type DrawCMSDocumentV1,
  type DrawCMSDocumentV2,
  type DrawCMSDocumentV3,
  type DrawCMSDocumentV4,
} from "./schema";
import { storyFromLegacyMotion } from "../story/model";
import { isSequenceEdgeType, type AppEdge } from "../types";
import { createSequenceEdge, SEQUENCE_LIFELINE_TYPES, SEQUENCE_ROW_COUNT } from "../sequence-edges";

export class DocumentMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentMigrationError";
  }
}

/**
 * Version 0: the unversioned `{ nodes, edges }` payload stored by early
 * cloud builds and in-memory by early editors.
 */
const legacyV0Schema = z
  .object({
    nodes: z.array(documentNodeSchema),
    edges: z.array(documentEdgeSchema),
    name: z.string().min(1).max(120).optional(),
  })
  .passthrough();

export function detectDocumentVersion(input: unknown): 0 | 1 | 2 | 3 | 4 | 5 | "unknown" {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return "unknown";
  const version = (input as Record<string, unknown>).schemaVersion;
  if (version === DOCUMENT_SCHEMA_VERSION) return DOCUMENT_SCHEMA_VERSION;
  if (version === 4) return documentV4Schema.safeParse(input).success ? 4 : "unknown";
  if (version === 3) return documentV3Schema.safeParse(input).success ? 3 : "unknown";
  if (version === 2) return documentV2Schema.safeParse(input).success ? 2 : "unknown";
  if (version === 1) return documentV1Schema.safeParse(input).success ? 1 : "unknown";
  if (version === undefined) {
    return legacyV0Schema.safeParse(input).success ? 0 : "unknown";
  }
  return "unknown";
}

/**
 * Upgrade any supported payload to the current document version.
 *
 * - v5 documents are validated and returned as-is (unknown fields preserved).
 * - v4 documents drop the unplayed scene/track/step timeline; an authored
 *   story is kept, otherwise one is derived once from the timeline's step
 *   labels so nothing narratively meaningful is silently lost.
 * - v3 sequence message nodes become attached message edges.
 * - v2 documents gain a separate narrative story derived from timed motion.
 * - v1 documents gain the motion section (now story-only; legacy element
 *   presets already live on node/edge data and are unaffected).
 * - v0 `{ nodes, edges }` payloads are wrapped, then upgraded like any v1.
 * - Anything else (including future schema versions this build cannot
 *   understand) fails safe with a DocumentMigrationError instead of guessing.
 */
export function migrateDocument(input: unknown): DrawCMSDocument {
  const version = detectDocumentVersion(input);
  if (version === 5) {
    return parseDocument(input);
  }
  if (version === 4) return upgradeV4toV5(documentV4Schema.parse(input));
  if (version === 3) return upgradeV4toV5(upgradeV3toV4(documentV3Schema.parse(input)));
  if (version === 2) {
    return upgradeV4toV5(upgradeV3toV4(upgradeV2toV3(documentV2Schema.parse(input))));
  }
  if (version === 1) {
    return upgradeV4toV5(
      upgradeV3toV4(upgradeV2toV3(upgradeV1toV2(documentV1Schema.parse(input)))),
    );
  }
  if (version === 0) {
    const legacy = legacyV0Schema.parse(input);
    return upgradeV4toV5(upgradeV3toV4(upgradeV2toV3(upgradeV1toV2(buildV1FromLegacy(legacy)))));
  }
  throw new DocumentMigrationError(
    "Unsupported or unrecognized DrawCMS document. Expected schemaVersion 5, 4, 3, 2, 1, or a legacy {nodes, edges} payload.",
  );
}

/**
 * v1 presets already live on node/edge `data.preset`; the v1 -> v2 motion
 * section only ever needs an empty shell here (v5 removed the scene/track/
 * step timeline that used to be built from those presets, so there is
 * nothing to convert them into anymore).
 */
function upgradeV1toV2(v1: DrawCMSDocumentV1): DrawCMSDocumentV2 {
  const rest = { ...v1 };
  // Replaced by the current version below; the spread preserves passthrough fields.
  delete (rest as Record<string, unknown>).schemaVersion;
  return {
    ...rest,
    schemaVersion: 2,
    motion: { scenes: [] },
  };
}

function upgradeV2toV3(v2: DrawCMSDocumentV2): DrawCMSDocumentV3 {
  const rest = { ...v2 };
  delete (rest as Record<string, unknown>).schemaVersion;
  return documentV3Schema.parse({
    ...rest,
    schemaVersion: 3,
    motion: {
      ...v2.motion,
      story: v2.motion.story ?? storyFromLegacyMotion(v2.motion),
    },
  });
}

function nodeWidth(node: DrawCMSDocumentV3["nodes"][number]) {
  return Number((node.style as Record<string, unknown> | undefined)?.width ?? 140);
}

/** Convert the node-shaped message primitives shipped in v3 into attached edges. */
function upgradeV3toV4(v3: DrawCMSDocumentV3): DrawCMSDocumentV4 {
  const messageNodes = v3.nodes
    .filter((node) => isSequenceEdgeType(node.data.type))
    .sort((left, right) => left.position.y - right.position.y);

  if (messageNodes.length === 0) {
    return documentV4Schema.parse({ ...v3, schemaVersion: 4 });
  }

  const lifelines = v3.nodes
    .filter((node) => SEQUENCE_LIFELINE_TYPES.has(node.data.type))
    .map((node) => ({ node, centerX: node.position.x + nodeWidth(node) / 2 }));
  const convertedIds = new Set<string>();
  const convertedEdges: AppEdge[] = [];
  let nextRow = 1;

  const nearestLifeline = (x: number, excludeId?: string) =>
    lifelines
      .filter(({ node }) => node.id !== excludeId)
      .sort((left, right) => Math.abs(left.centerX - x) - Math.abs(right.centerX - x))[0]?.node;

  for (const message of messageNodes) {
    const sequenceType = message.data.type;
    if (!isSequenceEdgeType(sequenceType)) continue;

    const isSelfMessage = sequenceType === "sequence-message-self";
    const leftX = message.position.x;
    const rightX = message.position.x + nodeWidth(message);
    const messageCenterX = (leftX + rightX) / 2;
    const left = nearestLifeline(leftX);
    const right = nearestLifeline(rightX, left?.id);
    const self = nearestLifeline(messageCenterX);

    const source = isSelfMessage ? self : sequenceType === "sequence-message-return" ? right : left;
    const target = isSelfMessage ? self : sequenceType === "sequence-message-return" ? left : right;
    if (!source || !target) continue;

    const row = Math.min(nextRow, isSelfMessage ? SEQUENCE_ROW_COUNT - 1 : SEQUENCE_ROW_COUNT);
    const edge = createSequenceEdge({
      id: message.id,
      sequenceType,
      label: message.data.label,
      source: source.id,
      target: target.id,
      row,
    });
    edge.data = {
      ...edge.data,
      ...(message.data.preset ? { preset: message.data.preset } : {}),
      ...(message.data.motionSpeed ? { motionSpeed: message.data.motionSpeed } : {}),
      ...(message.data.motionLoop !== undefined ? { motionLoop: message.data.motionLoop } : {}),
    };
    convertedEdges.push(edge);
    convertedIds.add(message.id);
    nextRow = Math.min(row + (isSelfMessage ? 2 : 1), SEQUENCE_ROW_COUNT);
  }

  const updateTargetKind = <T extends { targetId: string; targetKind: "node" | "edge" }>(
    target: T,
  ): T => (convertedIds.has(target.targetId) ? ({ ...target, targetKind: "edge" } as T) : target);

  const motion = {
    ...v3.motion,
    scenes: v3.motion.scenes.map((scene) => ({
      ...scene,
      tracks: scene.tracks.map(updateTargetKind),
    })),
    ...(v3.motion.story
      ? {
          story: {
            ...v3.motion.story,
            scenes: v3.motion.story.scenes.map((scene) => ({
              ...scene,
              steps: scene.steps.map((step) => ({
                ...step,
                targets: step.targets.map(updateTargetKind),
              })),
            })),
          },
        }
      : {}),
  };

  return documentV4Schema.parse({
    ...v3,
    schemaVersion: 4,
    nodes: v3.nodes.filter((node) => !convertedIds.has(node.id)),
    edges: [...v3.edges, ...convertedEdges],
    motion,
  });
}

/**
 * Drop the unplayed scene/track/step timeline (DM-034). An authored story
 * survives untouched; documents that only ever had timed motion (no
 * separate story — the v2 -> v3 step always backfills one, but a
 * hand-crafted v4 payload might omit it) get one derived once from the
 * timeline's step labels so nothing narratively meaningful disappears
 * silently.
 */
function upgradeV4toV5(v4: DrawCMSDocumentV4): DrawCMSDocument {
  const rest = { ...v4 } as Record<string, unknown>;
  delete rest.schemaVersion;
  return parseDocument({
    ...rest,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    motion: { story: v4.motion.story ?? storyFromLegacyMotion(v4.motion) },
  });
}

function buildV1FromLegacy(legacy: z.infer<typeof legacyV0Schema>): DrawCMSDocumentV1 {
  const nodes: DrawCMSDocumentV1["nodes"] = legacy.nodes.map((node) => {
    const copy = { ...node };
    delete copy.selected;
    return copy;
  });
  return {
    schemaVersion: 1,
    meta: { name: legacy.name?.trim() || "Untitled diagram" },
    canvas: {},
    nodes,
    edges: legacy.edges,
    assets: nodes.flatMap((node) => {
      const data = node.data as Record<string, unknown>;
      if (data.type !== "image") return [];
      const uri =
        (data._originalImageUrl as string | undefined) ?? (data.imageUrl as string | undefined);
      if (!uri) return [];
      return [
        {
          id: `asset-${node.id}`,
          kind: "image" as const,
          source: (uri.startsWith("data:") ? "embedded" : "remote") as "embedded" | "remote",
          uri,
        },
      ];
    }),
  };
}
