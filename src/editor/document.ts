/**
 * Runtime-agnostic document API.
 *
 * This entrypoint intentionally has no `"use client"` directive so Next.js
 * server components and route handlers can validate and migrate stored
 * documents without crossing the React client boundary.
 */
export {
  DOCUMENT_SCHEMA_VERSION,
  DocumentValidationError,
  drawCMSDocumentSchema,
  parseDocument,
  safeParseDocument,
} from "./document/schema";
export type {
  DocumentAsset,
  DocumentCanvas,
  DocumentEdge,
  DocumentMeta,
  DocumentMotion,
  DocumentNode,
  DrawCMSDocument,
  DrawCMSDocumentV2,
} from "./document/schema";
export { createDocument, deriveAssets, deterministicStringify } from "./document/serialize";
export { DocumentMigrationError, detectDocumentVersion, migrateDocument } from "./document/migrate";
export { createEmptyMotion, motionStateSchema } from "./motion/model";
export type { MotionState } from "./motion/model";
export {
  createEmptyStory,
  storyFromLegacyMotion,
  storySceneSchema,
  storyStateSchema,
  storyStepSchema,
  storyTargetSchema,
} from "./story/model";
export type { StoryScene, StoryState, StoryStep, StoryTarget } from "./story/model";
