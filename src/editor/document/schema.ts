import { z } from "zod";
import { motionStateSchema } from "../motion/model";
import { storyStateSchema } from "../story/model";

/**
 * DrawCMS document format (DM-011, extended for DM-019, reduced for DM-034).
 *
 * Unknown-field policy: **preserve**. Every object schema uses passthrough so
 * that fields written by a newer editor survive a round trip through an older
 * one. Known fields are still type-checked, and `schemaVersion` values this
 * build does not understand are rejected by `migrateDocument` (fail safe).
 *
 * Version history:
 * - v1: schemaVersion + meta + canvas + nodes + edges + assets
 * - v2: adds the `motion` section (scenes/tracks/steps); v1 presets migrate in
 * - v3: adds narrative story scenes/steps inside `motion.story`, decoupled from animation
 * - v4: sequence messages are attached edges with explicit message semantics
 * - v5: drops the unplayed scene/track/step timeline; `motion` now carries only
 *   `story`. Element animation continues to live on node/edge `data.preset`.
 *   See content/docs/decisions/003-single-motion-model.md.
 */

export const DOCUMENT_SCHEMA_VERSION = 5 as const;

const finiteNumber = z.number().finite();

/** Per-element motion settings (the document's "motion" section). */
export const documentMotionSchema = z
  .object({
    preset: z.string().max(200).optional(),
    motionSpeed: z.number().positive().max(100).optional(),
    motionLoop: z.boolean().optional(),
  })
  .passthrough();

export const documentNodeSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: z.string().max(100).optional(),
    position: z.object({ x: finiteNumber, y: finiteNumber }).passthrough(),
    data: z
      .object({
        label: z.string(),
        type: z.string(),
        preset: z.string().max(200).optional(),
        motionSpeed: z.number().positive().max(100).optional(),
        motionLoop: z.boolean().optional(),
        locked: z.boolean().optional(),
        iconName: z.string().max(120).optional(),
        iconBody: z.string().max(65536).optional(),
        iconViewBox: z.string().max(40).optional(),
      })
      .passthrough(),
    selected: z.boolean().optional(),
    style: z.record(z.string(), z.unknown()).optional(),
    parentId: z.string().min(1).max(200).optional(),
    zIndex: finiteNumber.optional(),
  })
  .passthrough();

export const documentEdgeSchema = z
  .object({
    id: z.string().min(1).max(250),
    source: z.string().min(1).max(200),
    target: z.string().min(1).max(200),
    sourceHandle: z.string().max(100).nullish(),
    targetHandle: z.string().max(100).nullish(),
    label: z.string().optional(),
    animated: z.boolean().optional(),
    data: documentMotionSchema
      .extend({
        label: z.string().optional(),
        routingMode: z.enum(["straight", "elbow", "curve"]).optional(),
        bend: z.object({ x: finiteNumber, y: finiteNumber }).passthrough().optional(),
        sourceOffset: z.object({ x: finiteNumber, y: finiteNumber }).passthrough().optional(),
        targetOffset: z.object({ x: finiteNumber, y: finiteNumber }).passthrough().optional(),
        curveOffset: finiteNumber.optional(),
        scale: finiteNumber.min(0.5).max(2).optional(),
        sequenceType: z
          .enum([
            "sequence-message",
            "sequence-message-async",
            "sequence-message-return",
            "sequence-message-self",
          ])
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const documentMetaSchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    createdAt: z.string().datetime({ offset: true }).optional(),
    updatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();

export const documentCanvasSchema = z
  .object({
    viewport: z
      .object({ x: finiteNumber, y: finiteNumber, zoom: z.number().positive().max(16) })
      .passthrough()
      .optional(),
    background: z.string().max(200).optional(),
  })
  .passthrough();

/** References to external or embedded assets used by the document. */
export const documentAssetSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal("image"),
    source: z.enum(["embedded", "remote"]),
    /** Original (uncropped) data URL or remote URL the reference points at. */
    uri: z.string().min(1),
  })
  .passthrough();

/**
 * Legacy scene/track/step timeline shape carried by v2–v4 documents. DM-034
 * removed this model from runtime (motion/model.ts) because nothing ever
 * played it back — see content/docs/decisions/003-single-motion-model.md — but old
 * documents must still validate through the migration path, so the shape is
 * preserved here for `migrateDocument` to read and discard.
 */
const legacyMotionStepSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().max(120).optional(),
    description: z.string().max(500).optional(),
    at: z.number().min(0),
    delay: z.number().min(0).max(60_000).optional(),
  })
  .passthrough();

const legacyMotionTrackSchema = z
  .object({
    id: z.string().min(1),
    targetId: z.string().min(1),
    targetKind: z.enum(["node", "edge"]),
    steps: z.array(legacyMotionStepSchema),
  })
  .passthrough();

const legacyMotionSceneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    tracks: z.array(legacyMotionTrackSchema),
  })
  .passthrough();

const legacyMotionStateSchema = z
  .object({
    scenes: z.array(legacyMotionSceneSchema),
    activeSceneId: z.string().min(1).optional(),
    story: storyStateSchema.optional(),
  })
  .passthrough();

/** The v1 envelope (kept for the v1 -> v2 migration path). */
export const documentV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    meta: documentMetaSchema,
    canvas: documentCanvasSchema,
    nodes: z.array(documentNodeSchema),
    edges: z.array(documentEdgeSchema),
    assets: z.array(documentAssetSchema),
  })
  .passthrough();

export const documentV2Schema = documentV1Schema
  .extend({
    schemaVersion: z.literal(2),
    motion: legacyMotionStateSchema,
  })
  .passthrough();

export const documentV3Schema = documentV2Schema
  .extend({ schemaVersion: z.literal(3) })
  .passthrough();

/** v4: sequence messages are attached edges rather than node-shaped primitives. */
export const documentV4Schema = documentV3Schema
  .extend({ schemaVersion: z.literal(4) })
  .passthrough();

/** v5: `motion` drops the legacy timeline and carries only `story`. */
export const drawCMSDocumentSchema = documentV4Schema
  .extend({ schemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION), motion: motionStateSchema })
  .passthrough();

export type DocumentMotion = z.infer<typeof documentMotionSchema>;
export type DocumentNode = z.infer<typeof documentNodeSchema>;
export type DocumentEdge = z.infer<typeof documentEdgeSchema>;
export type DocumentMeta = z.infer<typeof documentMetaSchema>;
export type DocumentCanvas = z.infer<typeof documentCanvasSchema>;
export type DocumentAsset = z.infer<typeof documentAssetSchema>;
export type DrawCMSDocumentV1 = z.infer<typeof documentV1Schema>;
export type DrawCMSDocumentV2 = z.infer<typeof documentV2Schema>;
export type DrawCMSDocumentV3 = z.infer<typeof documentV3Schema>;
export type DrawCMSDocumentV4 = z.infer<typeof documentV4Schema>;
export type DrawCMSDocument = z.infer<typeof drawCMSDocumentSchema>;

export class DocumentValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    super(
      `Invalid DrawCMS document: ${issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "DocumentValidationError";
    this.issues = issues;
  }
}

/** Validate a value as a document v1. Throws DocumentValidationError. */
export function parseDocument(input: unknown): DrawCMSDocument {
  const result = drawCMSDocumentSchema.safeParse(input);
  if (!result.success) {
    throw new DocumentValidationError(result.error.issues);
  }
  return result.data;
}

/** Non-throwing variant used by hosts that surface validation failures. */
export function safeParseDocument(input: unknown) {
  return drawCMSDocumentSchema.safeParse(input);
}
