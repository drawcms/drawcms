import { z } from "zod";
import type { StoryState, StoryStep, StoryTarget } from "../story/model";
import { STORY_STEP_MAX_DURATION_MS, STORY_STEP_MIN_DURATION_MS } from "../story/model";
import {
  getVisualRelationshipGrammar,
  normalizeRelationshipKind,
  type VisualDiagramType,
} from "./visual-grammar";

/**
 * Beats are the intent layer for agent-authored motion and narration
 * (content/docs/decisions/003-single-motion-model.md): an agent describes what a
 * moment in the explanation means, and DrawCMS resolves that into a
 * concrete preset, routing, and story step using the same
 * VISUAL_RELATIONSHIP_REGISTRY / VISUAL_MOTION_REGISTRY the recommendation
 * tool draws from (visual-grammar.ts). Any explicit field the agent
 * supplies on a beat, or on the node/edge itself, always wins over what a
 * beat would otherwise derive.
 */

export const BEAT_KINDS = [
  "request",
  "response",
  "async",
  "self-call",
  "data-flow",
  "handshake",
  "dependency",
  "state-transition",
  "error",
  "cycle",
] as const;

export type BeatKind = (typeof BEAT_KINDS)[number];

const idRefSchema = z.string().min(1).max(64);

export const beatInputSchema = z
  .object({
    id: idRefSchema.optional(),
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    /** Node and/or edge ids this beat concerns, in any order. */
    nodeIds: z.array(idRefSchema).max(100).default([]),
    edgeIds: z.array(idRefSchema).max(100).default([]),
    /** Semantic meaning used to derive motion when an edge has no explicit preset. */
    kind: z.enum(BEAT_KINDS).optional(),
    /** How long this beat holds during step-by-step playback. */
    durationMs: z
      .number()
      .min(STORY_STEP_MIN_DURATION_MS)
      .max(STORY_STEP_MAX_DURATION_MS)
      .optional(),
  })
  .strict()
  .refine((beat) => beat.nodeIds.length + beat.edgeIds.length > 0, {
    message: "A beat needs at least one nodeId or edgeId.",
  });

export type BeatInput = z.infer<typeof beatInputSchema>;

export const beatsJsonSchema = {
  type: "array",
  description:
    "Ordered narrative beats. Each beat becomes one presentation step and, for its edges, derives a motion preset from `kind` when the edge has no explicit motion. Beat order becomes playback order.",
  items: {
    type: "object",
    properties: {
      id: { type: "string", description: "Optional stable beat identifier." },
      title: { type: "string", description: "Visible step title shown during playback." },
      description: {
        type: "string",
        description: "Optional explanation shown alongside the title during playback.",
      },
      nodeIds: {
        type: "array",
        items: { type: "string" },
        description: "Node ids this beat concerns.",
      },
      edgeIds: {
        type: "array",
        items: { type: "string" },
        description:
          "Edge ids this beat concerns. Naming them pins the step to exactly those connectors; a beat with only nodeIds also highlights the direct connectors between them. Always name the message for a sequence beat, since several messages can share the same pair of lifelines.",
      },
      kind: {
        type: "string",
        enum: BEAT_KINDS,
        description:
          "Semantic meaning of this beat's edges, used to derive a motion preset and routing when an edge does not already set its own motion explicitly. Derived motion loops continuously; set the edge's own motion.loop to false for a once-only play.",
      },
      durationMs: {
        type: "number",
        description: `How long this beat holds during step-by-step playback, in milliseconds (${STORY_STEP_MIN_DURATION_MS}-${STORY_STEP_MAX_DURATION_MS}). Omit it to use the presentation default.`,
      },
    },
    required: ["title"],
  },
} as const;

export interface ResolvedBeatEdgeMotion {
  preset: string;
  routing: "straight" | "elbow" | "curve";
}

/**
 * Derive an edge's motion preset and routing from a beat's semantic kind.
 * Loop behavior is deliberately not derived here: agent-built motion loops
 * continuously by default (webmcp/tools.ts `DEFAULT_MOTION_LOOP`), and a
 * caller that wants a once-only message says so with an explicit
 * `motion.loop: false`.
 */
export function resolveBeatEdgeMotion(
  kind: BeatKind | undefined,
  label: string | undefined,
  diagramType: VisualDiagramType,
): ResolvedBeatEdgeMotion | null {
  const relationshipId = kind ?? normalizeRelationshipKind("", label ?? "", diagramType);
  const grammar = getVisualRelationshipGrammar(relationshipId);
  if (!grammar?.recommendedMotionPreset) return null;
  return {
    preset: grammar.recommendedMotionPreset,
    routing: grammar.routing,
  };
}

/**
 * Build a single narrative story scene from ordered beats. Each beat's
 * `nodeIds`/`edgeIds` become the step's targets; ids that do not exist on
 * the built document are silently dropped rather than failing the whole
 * build, matching sanitizeStory's existing "degrade safely" behavior for
 * this exact situation elsewhere.
 */
export function storyFromBeats(
  beats: BeatInput[],
  sceneName: string,
  knownNodeIds: ReadonlySet<string>,
  knownEdgeIds: ReadonlySet<string>,
): StoryState {
  const steps: StoryStep[] = beats.flatMap((beat, index) => {
    const targets: StoryTarget[] = [
      ...beat.nodeIds
        .filter((id) => knownNodeIds.has(id))
        .map((id) => ({ targetId: id, targetKind: "node" as const })),
      ...beat.edgeIds
        .filter((id) => knownEdgeIds.has(id))
        .map((id) => ({ targetId: id, targetKind: "edge" as const })),
    ];
    if (targets.length === 0) return [];
    return [
      {
        id: beat.id ?? `beat-${index + 1}`,
        title: beat.title,
        ...(beat.description ? { description: beat.description } : {}),
        ...(beat.durationMs !== undefined ? { durationMs: beat.durationMs } : {}),
        targets,
      },
    ];
  });

  const sceneId = "scene-1";
  return {
    scenes: [{ id: sceneId, title: sceneName, steps }],
    activeSceneId: sceneId,
  };
}
