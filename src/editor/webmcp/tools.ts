import { z } from "zod";
import { getNodeSize } from "../constants";
import { SHAPE_CATEGORIES } from "../components/shapes/catalog";
import { createDocument } from "../document/serialize";
import {
  defaultEdgeHandles,
  defaultNodeData,
  nodeRendererType,
  nodeStyle,
  nodeZIndex,
} from "../node-factory";
import type { DrawCMSDocument } from "../document/schema";
import {
  createSequenceEdge,
  nextSequenceRow,
  SEQUENCE_LIFELINE_TYPES,
  SEQUENCE_ROW_COUNT,
  sequenceActivationBounds,
} from "../sequence-edges";
import type { GraphEditOperation } from "../commands/commands";
import { SEQUENCE_EDGE_TYPES, type AppEdge, type AppNode } from "../types";
import {
  createEmptyStory,
  STORY_STEP_MAX_DURATION_MS,
  STORY_STEP_MIN_DURATION_MS,
  storyStateSchema,
  type StoryState,
} from "../story/model";
import { layoutNodes, SEQUENCE_LIFELINE_HEIGHT, type LayoutEdge, type LayoutNode } from "./layout";
import {
  beatInputSchema,
  beatsJsonSchema,
  resolveBeatEdgeMotion,
  storyFromBeats,
  type BeatInput,
  type BeatKind,
} from "./beats";
import {
  VISUAL_DIAGRAM_TYPES,
  VISUAL_ELEMENT_REGISTRY,
  VISUAL_MOTION_REGISTRY,
  VISUAL_RELATIONSHIP_REGISTRY,
  inferDiagramTypeFromNodeTypes,
  recommendVisualGrammar,
  validateDiagramVisualGrammar,
} from "./visual-grammar";

/** Default animation speed for agent-built motion, matching the built-in
 * templates (document/templates.ts) so a single WebMCP call produces the
 * same pace as the hand-authored reference diagrams. */
const DEFAULT_MOTION_SPEED = 0.5;

/** Agent-built motion loops continuously unless the caller explicitly opts
 * out with `loop: false`. This matches the built-in templates
 * (document/templates.ts), which always loop, and the renderers' own
 * fallback for an absent `motionLoop` (components/DiagramCanvas.tsx,
 * components/CustomEdge.tsx), so a preset an agent applies is visibly
 * animating rather than playing once and stopping. */
const DEFAULT_MOTION_LOOP = true;

const constructibleNodeTypes = VISUAL_ELEMENT_REGISTRY.filter(
  (entry) => entry.kind === "node" && entry.buildSupport === "full",
).map((entry) => entry.id);

export const WEBMCP_NODE_TYPES = constructibleNodeTypes as [string, ...string[]];
export const WEBMCP_EDGE_TYPES = SEQUENCE_EDGE_TYPES;
export const WEBMCP_NODE_MOTION_PRESETS = VISUAL_MOTION_REGISTRY.filter(
  (entry) => entry.target === "node",
).map((entry) => entry.id) as [string, ...string[]];
export const WEBMCP_EDGE_MOTION_PRESETS = VISUAL_MOTION_REGISTRY.filter(
  (entry) => entry.target === "edge",
).map((entry) => entry.id) as [string, ...string[]];

type JsonSchema = Record<string, unknown>;

export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMCPToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  execute(input: unknown, options?: { signal?: AbortSignal }): unknown | Promise<unknown>;
  annotations?: WebMCPToolAnnotations;
}

export interface WebMCPModelContext {
  registerTool(
    tool: WebMCPToolDefinition,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<void>;
}

export interface DrawCMSWebMCPAdapter {
  getDocument(): DrawCMSDocument;
  replaceDocument(document: DrawCMSDocument): void | Promise<void>;
  /** Id-addressed element motion patches, independent of editor selection. */
  setElementMotion(
    patches: Array<{
      targetId: string;
      targetKind: "node" | "edge";
      preset?: string | null;
      speed?: number;
      loop?: boolean;
    }>,
  ): void | Promise<void>;
  /** Replace the narrative story without touching nodes, edges, or positions. */
  replaceStory(story: StoryState): void | Promise<void>;
  /** Apply a batch of incremental structural edits as one undoable unit. */
  applyGraphEdit(operations: GraphEditOperation[]): void | Promise<void>;
}

const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Use letters, numbers, underscores, or hyphens.");

const motionSettingsSchema = z
  .object({
    speed: z.number().positive().max(4).optional(),
    loop: z.boolean().optional(),
  })
  .strict();

const nodeInputSchema = z
  .object({
    id: idSchema,
    label: z.string().max(240),
    type: z.enum(WEBMCP_NODE_TYPES).default("round-rect"),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict().optional(),
    width: z.number().positive().max(2_000).optional(),
    height: z.number().positive().max(2_000).optional(),
    fillColor: z.string().max(100).optional(),
    strokeColor: z.string().max(100).optional(),
    textColor: z.string().max(100).optional(),
    /** sequence-activation only: the lifeline node id this activation belongs to. */
    participantId: idSchema.optional(),
    motion: motionSettingsSchema
      .extend({ preset: z.enum(WEBMCP_NODE_MOTION_PRESETS) })
      .strict()
      .optional(),
  })
  .strict();

const edgeInputSchema = z
  .object({
    id: idSchema.optional(),
    source: idSchema,
    target: idSchema,
    label: z.string().max(240).optional(),
    type: z.enum(WEBMCP_EDGE_TYPES).optional(),
    routing: z.enum(["straight", "elbow", "curve"]).optional(),
    motion: motionSettingsSchema
      .extend({ preset: z.enum(WEBMCP_EDGE_MOTION_PRESETS) })
      .strict()
      .optional(),
  })
  .strict();

const replaceDiagramInputSchema = z
  .object({
    name: z.string().min(1).max(120).default("AI-generated diagram"),
    nodes: z.array(nodeInputSchema).min(1).max(250),
    edges: z.array(edgeInputSchema).max(500).default([]),
    /** Intent-driven narration and motion; ignored fields when `story` is also given. */
    beats: z.array(beatInputSchema).max(200).optional(),
    /** Fully explicit narration, for agents that want complete control instead of beats. */
    story: storyStateSchema.optional(),
  })
  .strict();

const replaceDiagramJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Human-readable diagram name.",
    },
    nodes: {
      type: "array",
      description:
        "Diagram elements. Positions are optional; DrawCMS lays out omitted positions automatically (lifeline columns for sequence diagrams, ranked left-to-right layers for flowcharts and architecture, a grid otherwise).",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Stable short identifier used by edge source and target fields.",
          },
          label: { type: "string", description: "Visible text on the element." },
          type: {
            type: "string",
            enum: WEBMCP_NODE_TYPES,
            description: "Visual element type. round-rect is a useful general default.",
          },
          position: {
            type: "object",
            description: "Optional canvas position. Omit it to use automatic grid layout.",
            properties: {
              x: { type: "number", description: "Horizontal canvas coordinate." },
              y: { type: "number", description: "Vertical canvas coordinate." },
            },
            required: ["x", "y"],
          },
          width: { type: "number", description: "Optional width in canvas pixels." },
          height: { type: "number", description: "Optional height in canvas pixels." },
          fillColor: { type: "string", description: "Optional CSS color for the fill." },
          strokeColor: { type: "string", description: "Optional CSS color for the border." },
          textColor: { type: "string", description: "Optional CSS color for the label." },
          participantId: {
            type: "string",
            description:
              "sequence-activation only: the sequence-actor or sequence-participant lifeline this activation bar belongs to. When set and position is omitted, DrawCMS positions and sizes the bar from that participant's message rows.",
          },
          motion: {
            type: "object",
            description: "Optional animation preset attached to this element.",
            properties: {
              preset: { type: "string", enum: WEBMCP_NODE_MOTION_PRESETS },
              speed: {
                type: "number",
                description: "Animation speed multiplier from greater than 0 through 4.",
              },
              loop: {
                type: "boolean",
                description:
                  "Whether the animation repeats. Defaults to true: an applied preset loops continuously unless you pass false for a once-only play.",
              },
            },
            required: ["preset"],
          },
        },
        required: ["id", "label"],
      },
    },
    edges: {
      type: "array",
      description: "Connectors between node ids.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Optional stable connector identifier." },
          source: { type: "string", description: "Source node id." },
          target: { type: "string", description: "Target node id." },
          label: { type: "string", description: "Optional visible connector label." },
          type: {
            type: "string",
            enum: WEBMCP_EDGE_TYPES,
            description:
              "Optional native sequence connector type for calls, async events, returns, or self-messages. DrawCMS assigns lifeline message rows in array order automatically (a self-message consumes two rows); a sequence diagram is limited to 12 rows total and returns a retryable error past that.",
          },
          routing: {
            type: "string",
            enum: ["straight", "elbow", "curve"],
            description:
              "Connector geometry; native sequence messages default to straight (self-messages to elbow) and other connectors to curve.",
          },
          motion: {
            type: "object",
            description: "Optional flow animation attached to this connector.",
            properties: {
              preset: { type: "string", enum: WEBMCP_EDGE_MOTION_PRESETS },
              speed: {
                type: "number",
                description: "Animation speed multiplier from greater than 0 through 4.",
              },
              loop: {
                type: "boolean",
                description:
                  "Whether the animation repeats. Defaults to true: an applied preset loops continuously unless you pass false for a once-only play.",
              },
            },
            required: ["preset"],
          },
        },
        required: ["source", "target"],
      },
    },
    beats: beatsJsonSchema,
    story: {
      type: "object",
      description:
        "Fully explicit narration instead of beats, for an agent that wants complete control over presentation scenes and steps. When both are given, story wins and beats are ignored.",
    },
  },
  required: ["nodes"],
};

const visualGrammarQuerySchema = z
  .object({
    scope: z.enum(["summary", "elements", "motions", "relationships", "all"]).default("summary"),
    query: z.string().max(120).optional(),
    category: z.string().max(64).optional(),
    diagramType: z.enum(VISUAL_DIAGRAM_TYPES).optional(),
    ids: z.array(z.string().min(1).max(100)).max(250).optional(),
    limit: z.number().int().min(1).max(250).default(50),
  })
  .strict();

const visualGrammarQueryJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      enum: ["summary", "elements", "motions", "relationships", "all"],
      description:
        "Registry section to return. Use summary first, then request only the entries needed for the diagram.",
    },
    query: {
      type: "string",
      description:
        "Optional search text matched against ids, titles, purposes, keywords, and use cases.",
    },
    category: {
      type: "string",
      description:
        "Optional element category id such as sequence, architecture, flowchart, aws, or gcp.",
    },
    diagramType: {
      type: "string",
      enum: VISUAL_DIAGRAM_TYPES,
      description: "Optional diagram type used to filter suitable elements.",
    },
    ids: {
      type: "array",
      items: { type: "string" },
      description: "Optional exact element, motion, or relationship ids.",
    },
    limit: {
      type: "number",
      description: "Maximum entries per returned section, from 1 through 250; defaults to 50.",
    },
  },
};

const recommendVisualsSchema = z
  .object({
    diagramType: z.enum(VISUAL_DIAGRAM_TYPES),
    entities: z
      .array(
        z
          .object({
            id: idSchema,
            label: z.string().min(1).max(240),
            role: z.string().max(120).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(250),
    relationships: z
      .array(
        z
          .object({
            id: idSchema.optional(),
            source: idSchema,
            target: idSchema,
            label: z.string().max(240).optional(),
            kind: z.string().max(120).optional(),
          })
          .strict(),
      )
      .max(500)
      .default([]),
    animationGoal: z
      .enum(["explain-flow", "highlight-change", "show-state", "none"])
      .default("explain-flow"),
  })
  .strict();

const recommendVisualsJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    diagramType: {
      type: "string",
      enum: VISUAL_DIAGRAM_TYPES,
      description: "The visual notation the finished diagram should follow.",
    },
    entities: {
      type: "array",
      description:
        "Things that need visual elements. Supply meaning in role rather than a shape name.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Stable entity identifier." },
          label: { type: "string", description: "Visible entity label." },
          role: {
            type: "string",
            description:
              "Semantic role such as user, browser client, DNS resolver, API, queue, or database.",
          },
        },
        required: ["id", "label"],
      },
    },
    relationships: {
      type: "array",
      description: "Semantic relationships in intended playback order.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Optional stable relationship identifier." },
          source: { type: "string", description: "Source entity id." },
          target: { type: "string", description: "Target entity id." },
          label: { type: "string", description: "Visible relationship label." },
          kind: {
            type: "string",
            description:
              "Meaning such as request, response, async event, handshake, data flow, dependency, error, or cycle.",
          },
        },
        required: ["source", "target"],
      },
    },
    animationGoal: {
      type: "string",
      enum: ["explain-flow", "highlight-change", "show-state", "none"],
      description: "How motion should support the explanation; defaults to explain-flow.",
    },
  },
  required: ["diagramType", "entities"],
};

const validateVisualsSchema = z
  .object({ diagramType: z.enum(VISUAL_DIAGRAM_TYPES).optional() })
  .strict();

/** Either a node or an edge motion preset — used where the caller addresses
 * an existing element by id and the tool cannot narrow the enum by kind. */
const anyMotionPresetSchema = z
  .enum(WEBMCP_NODE_MOTION_PRESETS)
  .or(z.enum(WEBMCP_EDGE_MOTION_PRESETS));

/** A motion patch for an existing element: every field optional, preset
 * nullable to clear it. Distinct from the `motion` field used when
 * creating a new node/edge, where a preset (if given at all) is required. */
const motionPatchSchema = z
  .object({
    preset: anyMotionPresetSchema.nullable().optional(),
    speed: z.number().positive().max(4).optional(),
    loop: z.boolean().optional(),
  })
  .strict();

const elementMotionPatchSchema = z
  .object({
    targetId: idSchema,
    targetKind: z.enum(["node", "edge"]),
    preset: anyMotionPresetSchema.nullable().optional(),
    speed: z.number().positive().max(4).optional(),
    loop: z.boolean().optional(),
  })
  .strict();

const setMotionInputSchema = z
  .object({ patches: z.array(elementMotionPatchSchema).min(1).max(250) })
  .strict();

const setMotionJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    patches: {
      type: "array",
      description:
        "Motion changes for existing nodes and connectors, addressed by id. Unlike drawcms_replace_diagram, this does not touch structure, positions, or narration.",
      items: {
        type: "object",
        properties: {
          targetId: { type: "string", description: "Existing node or connector id." },
          targetKind: { type: "string", enum: ["node", "edge"] },
          preset: {
            description:
              "Motion preset appropriate for the target kind. Set to null to remove the current preset, or omit to leave it unchanged.",
          },
          speed: {
            type: "number",
            description: "Animation speed multiplier from greater than 0 through 4.",
          },
          loop: {
            type: "boolean",
            description:
              "Whether the animation repeats. Omitting it while setting a preset loops continuously; pass false for a once-only play. Omitting it without a preset leaves the current loop setting unchanged.",
          },
        },
        required: ["targetId", "targetKind"],
      },
      minItems: 1,
    },
  },
  required: ["patches"],
};

const storyTargetInputSchema = z
  .object({ targetId: idSchema, targetKind: z.enum(["node", "edge"]) })
  .strict();

const storyStepInputSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    targets: z.array(storyTargetInputSchema).min(1).max(100),
    durationMs: z
      .number()
      .min(STORY_STEP_MIN_DURATION_MS)
      .max(STORY_STEP_MAX_DURATION_MS)
      .optional(),
  })
  .strict();

const storySceneInputSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    steps: z.array(storyStepInputSchema).max(2_000).default([]),
  })
  .strict();

const setStoryInputSchema = z
  .object({ scenes: z.array(storySceneInputSchema).min(1).max(100) })
  .strict();

const editNodeSchema = z
  .object({
    op: z.literal("addNode"),
    id: idSchema,
    label: z.string().max(240),
    type: z.enum(WEBMCP_NODE_TYPES).default("round-rect"),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict().optional(),
    width: z.number().positive().max(2_000).optional(),
    height: z.number().positive().max(2_000).optional(),
    fillColor: z.string().max(100).optional(),
    strokeColor: z.string().max(100).optional(),
    textColor: z.string().max(100).optional(),
    motion: motionSettingsSchema
      .extend({ preset: z.enum(WEBMCP_NODE_MOTION_PRESETS) })
      .strict()
      .optional(),
  })
  .strict();

const updateNodeSchema = z
  .object({
    op: z.literal("updateNode"),
    nodeId: idSchema,
    label: z.string().max(240).optional(),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict().optional(),
    fillColor: z.string().max(100).optional(),
    strokeColor: z.string().max(100).optional(),
    textColor: z.string().max(100).optional(),
    motion: motionPatchSchema.optional(),
  })
  .strict();

const deleteNodeSchema = z.object({ op: z.literal("deleteNode"), nodeId: idSchema }).strict();

const editEdgeSchema = z
  .object({
    op: z.literal("addEdge"),
    id: idSchema.optional(),
    source: idSchema,
    target: idSchema,
    label: z.string().max(240).optional(),
    type: z.enum(WEBMCP_EDGE_TYPES).optional(),
    routing: z.enum(["straight", "elbow", "curve"]).optional(),
    motion: motionSettingsSchema
      .extend({ preset: z.enum(WEBMCP_EDGE_MOTION_PRESETS) })
      .strict()
      .optional(),
  })
  .strict();

const updateEdgeSchema = z
  .object({
    op: z.literal("updateEdge"),
    edgeId: idSchema,
    label: z.string().max(240).optional(),
    motion: motionPatchSchema.optional(),
  })
  .strict();

const deleteEdgeSchema = z.object({ op: z.literal("deleteEdge"), edgeId: idSchema }).strict();

const editOperationSchema = z.discriminatedUnion("op", [
  editNodeSchema,
  updateNodeSchema,
  deleteNodeSchema,
  editEdgeSchema,
  updateEdgeSchema,
  deleteEdgeSchema,
]);

const editDiagramInputSchema = z
  .object({ operations: z.array(editOperationSchema).min(1).max(100) })
  .strict();

type EditOperationInput = z.infer<typeof editOperationSchema>;

const editDiagramJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    operations: {
      type: "array",
      description:
        "Ordered incremental edits applied to the current diagram as one undoable action. Unlike drawcms_replace_diagram, this does not rebuild the whole canvas or clear undo history — an agent edit here can be reversed with a single Cmd+Z. Operations execute in array order, so an edge can reference a node added earlier in the same batch.",
      items: {
        type: "object",
        properties: {
          op: {
            type: "string",
            enum: ["addNode", "updateNode", "deleteNode", "addEdge", "updateEdge", "deleteEdge"],
          },
          id: { type: "string", description: "addNode: new node id." },
          nodeId: { type: "string", description: "updateNode/deleteNode: existing node id." },
          label: { type: "string", description: "Visible text on the element." },
          type: {
            type: "string",
            description: "addNode: element type. addEdge: native sequence connector type.",
          },
          position: {
            type: "object",
            description: "Canvas position. addNode defaults to an open area if omitted.",
            properties: { x: { type: "number" }, y: { type: "number" } },
          },
          width: { type: "number", description: "addNode: optional width in canvas pixels." },
          height: { type: "number", description: "addNode: optional height in canvas pixels." },
          fillColor: { type: "string" },
          strokeColor: { type: "string" },
          textColor: { type: "string" },
          motion: {
            type: "object",
            description:
              "Motion preset for this element. updateNode/updateEdge accept preset: null to clear the current preset.",
            properties: {
              preset: { type: "string" },
              speed: { type: "number" },
              loop: {
                type: "boolean",
                description:
                  "Whether the animation repeats. Defaults to true whenever a preset is set; pass false for a once-only play.",
              },
            },
          },
          source: { type: "string", description: "addEdge: source node id." },
          target: { type: "string", description: "addEdge: target node id." },
          routing: { type: "string", enum: ["straight", "elbow", "curve"] },
          edgeId: { type: "string", description: "updateEdge/deleteEdge: existing edge id." },
        },
        required: ["op"],
      },
      minItems: 1,
    },
  },
  required: ["operations"],
};

const setStoryJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      description:
        "Complete replacement for the diagram's presentation narration. Structure, positions, and element motion presets are untouched.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Optional stable scene identifier." },
          title: { type: "string", description: "Visible scene title." },
          description: { type: "string", description: "Optional scene-level explanation." },
          steps: {
            type: "array",
            description: "Ordered presentation steps within this scene.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Optional stable step identifier." },
                title: { type: "string", description: "Visible step title shown during playback." },
                description: { type: "string", description: "Optional step-level explanation." },
                targets: {
                  type: "array",
                  description:
                    "Existing node and connector ids highlighted by this step. Including any connector pins the step to exactly the connectors it lists; a node-only step also highlights the direct connectors between those nodes. Always include the message id for a sequence step, since several messages can share the same pair of lifelines.",
                  items: {
                    type: "object",
                    properties: {
                      targetId: { type: "string" },
                      targetKind: { type: "string", enum: ["node", "edge"] },
                    },
                    required: ["targetId", "targetKind"],
                  },
                  minItems: 1,
                },
                durationMs: {
                  type: "number",
                  description: `How long this step holds before auto-advancing, in milliseconds (${STORY_STEP_MIN_DURATION_MS}-${STORY_STEP_MAX_DURATION_MS}).`,
                },
              },
              required: ["title", "targets"],
            },
          },
        },
        required: ["title"],
      },
      minItems: 1,
    },
  },
  required: ["scenes"],
};

class WebMCPDiagramInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebMCPDiagramInputError";
  }
}

function toErrorResult(error: unknown) {
  if (error instanceof z.ZodError || error instanceof WebMCPDiagramInputError) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_DIAGRAM",
        message:
          error instanceof z.ZodError
            ? error.issues
                .slice(0, 5)
                .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
                .join("; ")
            : error.message,
      },
    };
  }
  return {
    ok: false as const,
    error: {
      code: "TOOL_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function matchesRegistryQuery(entry: unknown, query: string | undefined): boolean {
  if (!query?.trim()) return true;
  return JSON.stringify(entry).toLowerCase().includes(query.trim().toLowerCase());
}

function queryVisualGrammar(input: z.infer<typeof visualGrammarQuerySchema>) {
  const ids = input.ids ? new Set(input.ids) : null;
  const matchingElements = VISUAL_ELEMENT_REGISTRY.filter(
    (entry) =>
      (!ids || ids.has(entry.id)) &&
      (!input.category || entry.categoryId === input.category) &&
      (!input.diagramType || entry.diagramTypes.includes(input.diagramType)) &&
      matchesRegistryQuery(entry, input.query),
  );
  const matchingMotions = VISUAL_MOTION_REGISTRY.filter(
    (entry) => (!ids || ids.has(entry.id)) && matchesRegistryQuery(entry, input.query),
  );
  const matchingRelationships = VISUAL_RELATIONSHIP_REGISTRY.filter(
    (entry) => (!ids || ids.has(entry.id)) && matchesRegistryQuery(entry, input.query),
  );
  const elements = matchingElements.slice(0, input.limit);
  const motions = matchingMotions.slice(0, input.limit);
  const relationships = matchingRelationships.slice(0, input.limit);

  const summary = {
    elementCount: VISUAL_ELEMENT_REGISTRY.length,
    motionPresetCount: VISUAL_MOTION_REGISTRY.length,
    relationshipTypeCount: VISUAL_RELATIONSHIP_REGISTRY.length,
    categories: SHAPE_CATEGORIES.map((category) => ({
      id: category.id,
      title: category.title,
      elementCount: category.id === "icons" ? 1 : category.shapes.length,
    })),
    diagramTypes: VISUAL_DIAGRAM_TYPES,
    guidance:
      "Query the relevant registry entries, then call drawcms_recommend_visuals before building a semantic diagram.",
  };

  if (input.scope === "summary") return { ok: true, scope: input.scope, summary };
  if (input.scope === "elements")
    return {
      ok: true,
      scope: input.scope,
      totalMatches: matchingElements.length,
      returnedCount: elements.length,
      elements,
    };
  if (input.scope === "motions")
    return {
      ok: true,
      scope: input.scope,
      totalMatches: matchingMotions.length,
      returnedCount: motions.length,
      motions,
    };
  if (input.scope === "relationships")
    return {
      ok: true,
      scope: input.scope,
      totalMatches: matchingRelationships.length,
      returnedCount: relationships.length,
      relationships,
    };
  return {
    ok: true,
    scope: input.scope,
    summary,
    elements,
    motions,
    relationships,
  };
}

/** Auto-height elements (tables, UML classes, ER entities) report 0 for
 * layout purposes; estimate a typical rendered height so automatic
 * placement still leaves them clear of their neighbors. */
const AUTO_HEIGHT_LAYOUT_ESTIMATE = 140;

type ParsedEdge = z.infer<typeof edgeInputSchema>;

/**
 * Assign ascending `sequence-row-N` handles to sequence messages in array
 * order — the same chronological convention `createSequenceEdge` uses for
 * human-authored messages (sequence-edges.ts) — instead of the generic
 * left/right/top/bottom handles `defaultEdgeHandles` computes for ordinary
 * connectors. A self-message consumes two consecutive rows (see
 * `createSequenceEdge`). Throws a retryable error rather than silently
 * clamping every remaining message onto the last row once the 12-row
 * lifeline budget is exhausted.
 */
function assignSequenceRows(edges: ParsedEdge[]): Map<number, number> {
  const rows = new Map<number, number>();
  let nextRow = 1;
  edges.forEach((edge, index) => {
    if (!edge.type) return;
    const rowsNeeded = edge.type === "sequence-message-self" ? 2 : 1;
    if (nextRow + rowsNeeded - 1 > SEQUENCE_ROW_COUNT) {
      throw new WebMCPDiagramInputError(
        `Sequence diagram exceeds the ${SEQUENCE_ROW_COUNT} available message rows at edge ${
          edge.id ?? index + 1
        }. Split the interaction into a smaller diagram or fewer messages.`,
      );
    }
    rows.set(index, nextRow);
    nextRow += rowsNeeded;
  });
  return rows;
}

/** First beat that mentions an edge id decides that edge's semantic kind. */
function beatKindsByEdgeId(beats: BeatInput[] | undefined): Map<string, BeatKind> {
  const kinds = new Map<string, BeatKind>();
  for (const beat of beats ?? []) {
    if (!beat.kind) continue;
    for (const edgeId of beat.edgeIds) {
      if (!kinds.has(edgeId)) kinds.set(edgeId, beat.kind);
    }
  }
  return kinds;
}

export function createDocumentFromWebMCP(input: unknown): DrawCMSDocument {
  const parsed = replaceDiagramInputSchema.parse(input);
  const ids = new Set<string>();
  for (const node of parsed.nodes) {
    if (ids.has(node.id)) throw new WebMCPDiagramInputError(`Duplicate node id: ${node.id}`);
    ids.add(node.id);
  }

  const diagramType = inferDiagramTypeFromNodeTypes(
    parsed.nodes.map((node) => node.type),
    parsed.edges.some((edge) => edge.type !== undefined),
  );
  const sequenceRows = assignSequenceRows(parsed.edges);
  const edgeBeatKinds = beatKindsByEdgeId(parsed.beats);
  const layoutNodeInputs: LayoutNode[] = parsed.nodes.map((node) => {
    const size = getNodeSize(node.type);
    return {
      id: node.id,
      type: node.type,
      width: node.width ?? size.width,
      height: node.height ?? (size.height > 0 ? size.height : AUTO_HEIGHT_LAYOUT_ESTIMATE),
    };
  });
  const layoutEdgeInputs: LayoutEdge[] = parsed.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));
  // Automatic layout only ever fills in positions the agent omitted; an
  // explicit position always wins outright.
  const needsLayout = parsed.nodes.some((node) => !node.position);
  const computedPositions = needsLayout
    ? layoutNodes(diagramType, layoutNodeInputs, layoutEdgeInputs)
    : null;

  const nodes: AppNode[] = parsed.nodes.map((node) => {
    const computed = computedPositions?.get(node.id);
    const position = node.position ?? computed ?? { x: 0, y: 0 };
    const data: AppNode["data"] = {
      ...defaultNodeData(node.type, node.label),
      ...(node.fillColor ? { fillColor: node.fillColor } : {}),
      ...(node.strokeColor ? { strokeColor: node.strokeColor } : {}),
      ...(node.textColor ? { textColor: node.textColor } : {}),
      ...(node.motion
        ? {
            preset: node.motion.preset,
            motionSpeed: node.motion.speed ?? DEFAULT_MOTION_SPEED,
            motionLoop: node.motion.loop ?? DEFAULT_MOTION_LOOP,
          }
        : {}),
    };
    const style = nodeStyle(node.type, node.width, node.height);
    if (computed?.height !== undefined && !node.height) style.height = computed.height;
    return {
      id: node.id,
      position: { x: position.x, y: position.y },
      data,
      type: nodeRendererType(node.type),
      style,
      ...(nodeZIndex(node.type) !== undefined ? { zIndex: nodeZIndex(node.type) } : {}),
    };
  });

  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  // Position sequence-activation bars from the message rows their
  // participant is actually involved in, matching the geometry
  // document/templates.ts hand-authors (see sequence-edges.ts
  // sequenceActivationBounds). Only nodes without an explicit position are
  // touched; an agent-supplied position always wins.
  parsed.nodes.forEach((node, nodeIndex) => {
    if (node.type !== "sequence-activation" || node.position || !node.participantId) return;
    const participant = nodesById.get(node.participantId);
    if (!participant || !SEQUENCE_LIFELINE_TYPES.has(participant.data.type)) {
      throw new WebMCPDiagramInputError(
        `Node ${node.id} has participantId ${node.participantId}, which is not a sequence-actor or sequence-participant lifeline.`,
      );
    }
    const involvedRows = parsed.edges.flatMap((edge, edgeIndex) => {
      if (!edge.type || (edge.source !== node.participantId && edge.target !== node.participantId))
        return [];
      const row = sequenceRows.get(edgeIndex);
      if (row === undefined) return [];
      return edge.type === "sequence-message-self" ? [row, row + 1] : [row];
    });
    if (involvedRows.length === 0) return;
    const lifelineHeight = Number(participant.style?.height ?? SEQUENCE_LIFELINE_HEIGHT);
    const bounds = sequenceActivationBounds(
      participant.position.y,
      lifelineHeight,
      Math.min(...involvedRows),
      Math.max(...involvedRows),
    );
    const activationNode = nodes[nodeIndex];
    const width = Number(activationNode.style?.width ?? 90);
    const participantWidth = Number(participant.style?.width ?? 140);
    activationNode.position = {
      x: Math.round((participant.position.x + participantWidth / 2 - width / 2) * 10) / 10,
      y: Math.round(bounds.y * 10) / 10,
    };
    activationNode.style = { ...activationNode.style, height: Math.round(bounds.height * 10) / 10 };
  });

  const edgeIds = new Set<string>();
  const edges: AppEdge[] = parsed.edges.map((edge, index) => {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source) {
      throw new WebMCPDiagramInputError(
        `Edge ${edge.id ?? index + 1} has unknown source: ${edge.source}`,
      );
    }
    if (!target) {
      throw new WebMCPDiagramInputError(
        `Edge ${edge.id ?? index + 1} has unknown target: ${edge.target}`,
      );
    }
    const id = edge.id ?? `edge-${edge.source}-${edge.target}-${index + 1}`;
    if (edgeIds.has(id)) throw new WebMCPDiagramInputError(`Duplicate edge id: ${id}`);
    edgeIds.add(id);

    // An explicit `motion` field always wins. Otherwise, a beat that names
    // this edge's semantic kind derives a preset from the visual grammar
    // registry — the same resolution `drawcms_recommend_visuals` uses.
    const derivedMotion = edge.motion
      ? null
      : resolveBeatEdgeMotion(edgeBeatKinds.get(id), edge.label, diagramType);
    const motionFields = edge.motion
      ? {
          preset: edge.motion.preset,
          motionSpeed: edge.motion.speed ?? DEFAULT_MOTION_SPEED,
          motionLoop: edge.motion.loop ?? DEFAULT_MOTION_LOOP,
        }
      : derivedMotion
        ? {
            preset: derivedMotion.preset,
            motionSpeed: DEFAULT_MOTION_SPEED,
            motionLoop: DEFAULT_MOTION_LOOP,
          }
        : {};
    const derivedRouting = !edge.routing && derivedMotion ? derivedMotion.routing : null;

    if (edge.type) {
      // Native sequence message: attach to the lifeline row assigned above
      // instead of a generic side handle, and honor an explicit routing
      // override the same way ordinary connectors do.
      const row = sequenceRows.get(index)!;
      const message = createSequenceEdge({
        id,
        sequenceType: edge.type,
        label: edge.label ?? "",
        source: edge.source,
        target: edge.target,
        row,
      });
      return {
        ...message,
        data: {
          ...message.data,
          ...(edge.routing ? { routingMode: edge.routing } : {}),
          ...motionFields,
        },
      };
    }

    const routingMode = edge.routing ?? derivedRouting ?? "curve";
    const handles = defaultEdgeHandles(source, target);
    return {
      id,
      source: edge.source,
      target: edge.target,
      ...handles,
      ...(edge.label ? { label: edge.label } : {}),
      data: {
        ...(edge.label ? { label: edge.label } : {}),
        routingMode,
        ...motionFields,
      },
    };
  });

  const knownNodeIds = new Set(nodes.map((node) => node.id));
  const knownEdgeIds = new Set(edges.map((edge) => edge.id));
  const story = parsed.story
    ? parsed.story
    : parsed.beats
      ? storyFromBeats(parsed.beats, parsed.name, knownNodeIds, knownEdgeIds)
      : createEmptyStory();

  return createDocument({ nodes, edges, meta: { name: parsed.name }, motion: { story } });
}

/**
 * Loop behavior for a motion *patch* against an element that already exists.
 * Applying a preset without saying anything about looping means continuous
 * loop, the same default the build paths use — otherwise a newly applied
 * preset would silently inherit a `loop: false` left over from whatever the
 * element animated with before. Retiming (`speed` only) and clearing
 * (`preset: null`) leave the current loop setting untouched.
 */
function resolvePatchedMotionLoop(motion: {
  preset?: string | null;
  loop?: boolean;
}): { motionLoop: boolean } | Record<string, never> {
  if (motion.loop !== undefined) return { motionLoop: motion.loop };
  if (typeof motion.preset === "string") return { motionLoop: DEFAULT_MOTION_LOOP };
  return {};
}

/**
 * Translate agent-facing edit operations into the internal
 * `GraphEditOperation` shape `applyGraphEdit` mechanically applies,
 * validating every id against the document snapshot the batch starts from.
 * Node construction goes through node-factory.ts and sequence connectors
 * through sequence-edges.ts — the same builders `createDocumentFromWebMCP`
 * uses — so an incrementally added element matches one built via
 * `drawcms_replace_diagram`. IDs are tracked as the batch is resolved so an
 * edge can reference a node added earlier in the same call.
 */
function resolveGraphEditOperations(
  operations: EditOperationInput[],
  document: DrawCMSDocument,
): GraphEditOperation[] {
  const nodeIds = new Set(document.nodes.map((node) => node.id));
  const edgeIds = new Set(document.edges.map((edge) => edge.id));
  const nodesById = new Map(document.nodes.map((node) => [node.id, node as AppNode]));
  // Rows already used by existing sequence messages must not be reassigned.
  let nextSequenceRowNumber = nextSequenceRow(document.edges as AppEdge[]);

  const requireNode = (id: string) => {
    const node = nodesById.get(id);
    if (!node) throw new WebMCPDiagramInputError(`Unknown node id: ${id}`);
    return node;
  };

  return operations.map((operation): GraphEditOperation => {
    switch (operation.op) {
      case "addNode": {
        if (nodeIds.has(operation.id)) {
          throw new WebMCPDiagramInputError(`Duplicate node id: ${operation.id}`);
        }
        nodeIds.add(operation.id);
        const position = operation.position ?? { x: 300, y: 200 };
        const data: AppNode["data"] = {
          ...defaultNodeData(operation.type, operation.label),
          ...(operation.fillColor ? { fillColor: operation.fillColor } : {}),
          ...(operation.strokeColor ? { strokeColor: operation.strokeColor } : {}),
          ...(operation.textColor ? { textColor: operation.textColor } : {}),
          ...(operation.motion
            ? {
                preset: operation.motion.preset,
                motionSpeed: operation.motion.speed ?? DEFAULT_MOTION_SPEED,
                motionLoop: operation.motion.loop ?? DEFAULT_MOTION_LOOP,
              }
            : {}),
        };
        const node: AppNode = {
          id: operation.id,
          position,
          data,
          type: nodeRendererType(operation.type),
          style: nodeStyle(operation.type, operation.width, operation.height),
          ...(nodeZIndex(operation.type) !== undefined
            ? { zIndex: nodeZIndex(operation.type) }
            : {}),
        };
        nodesById.set(operation.id, node);
        return { op: "addNode", node };
      }
      case "updateNode": {
        requireNode(operation.nodeId);
        const dataPatch: Record<string, unknown> = {};
        if (operation.label !== undefined) dataPatch.label = operation.label;
        if (operation.fillColor !== undefined) dataPatch.fillColor = operation.fillColor;
        if (operation.strokeColor !== undefined) dataPatch.strokeColor = operation.strokeColor;
        if (operation.textColor !== undefined) dataPatch.textColor = operation.textColor;
        if (operation.motion) {
          if (operation.motion.preset === null) dataPatch.preset = undefined;
          else if (operation.motion.preset !== undefined)
            dataPatch.preset = operation.motion.preset;
          if (operation.motion.speed !== undefined) dataPatch.motionSpeed = operation.motion.speed;
          Object.assign(dataPatch, resolvePatchedMotionLoop(operation.motion));
        }
        return {
          op: "updateNode",
          nodeId: operation.nodeId,
          dataPatch,
          ...(operation.position ? { position: operation.position } : {}),
        };
      }
      case "deleteNode": {
        requireNode(operation.nodeId);
        nodeIds.delete(operation.nodeId);
        nodesById.delete(operation.nodeId);
        return { op: "deleteNode", nodeId: operation.nodeId };
      }
      case "addEdge": {
        const source = requireNode(operation.source);
        const target = requireNode(operation.target);
        const id =
          operation.id ?? `edge-${operation.source}-${operation.target}-${edgeIds.size + 1}`;
        if (edgeIds.has(id)) throw new WebMCPDiagramInputError(`Duplicate edge id: ${id}`);
        edgeIds.add(id);

        const motionFields = operation.motion
          ? {
              preset: operation.motion.preset,
              motionSpeed: operation.motion.speed ?? DEFAULT_MOTION_SPEED,
              motionLoop: operation.motion.loop ?? DEFAULT_MOTION_LOOP,
            }
          : {};

        if (operation.type) {
          const isSelfMessage = operation.type === "sequence-message-self";
          const rowsNeeded = isSelfMessage ? 2 : 1;
          if (nextSequenceRowNumber + rowsNeeded - 1 > SEQUENCE_ROW_COUNT) {
            throw new WebMCPDiagramInputError(
              `Sequence diagram exceeds the ${SEQUENCE_ROW_COUNT} available message rows at edge ${id}. Split the interaction into a smaller diagram or fewer messages.`,
            );
          }
          const row = nextSequenceRowNumber;
          nextSequenceRowNumber += rowsNeeded;
          const message = createSequenceEdge({
            id,
            sequenceType: operation.type,
            label: operation.label ?? "",
            source: operation.source,
            target: operation.target,
            row,
          });
          return {
            op: "addEdge",
            edge: {
              ...message,
              data: {
                ...message.data,
                ...(operation.routing ? { routingMode: operation.routing } : {}),
                ...motionFields,
              },
            },
          };
        }

        const routingMode = operation.routing ?? "curve";
        const handles = defaultEdgeHandles(source, target);
        return {
          op: "addEdge",
          edge: {
            id,
            source: operation.source,
            target: operation.target,
            ...handles,
            ...(operation.label ? { label: operation.label } : {}),
            data: {
              ...(operation.label ? { label: operation.label } : {}),
              routingMode,
              ...motionFields,
            },
          },
        };
      }
      case "updateEdge": {
        if (!edgeIds.has(operation.edgeId)) {
          throw new WebMCPDiagramInputError(`Unknown edge id: ${operation.edgeId}`);
        }
        const dataPatch: Record<string, unknown> = {};
        if (operation.motion) {
          if (operation.motion.preset === null) dataPatch.preset = undefined;
          else if (operation.motion.preset !== undefined)
            dataPatch.preset = operation.motion.preset;
          if (operation.motion.speed !== undefined) dataPatch.motionSpeed = operation.motion.speed;
          Object.assign(dataPatch, resolvePatchedMotionLoop(operation.motion));
        }
        return {
          op: "updateEdge",
          edgeId: operation.edgeId,
          dataPatch,
          ...(operation.label !== undefined ? { label: operation.label } : {}),
        };
      }
      case "deleteEdge": {
        if (!edgeIds.has(operation.edgeId)) {
          throw new WebMCPDiagramInputError(`Unknown edge id: ${operation.edgeId}`);
        }
        edgeIds.delete(operation.edgeId);
        return { op: "deleteEdge", edgeId: operation.edgeId };
      }
    }
  });
}

export function createDrawCMSWebMCPTools(adapter: DrawCMSWebMCPAdapter): WebMCPToolDefinition[] {
  return [
    {
      name: "drawcms_get_diagram",
      title: "Read DrawCMS diagram",
      description:
        "Returns the complete DrawCMS diagram currently visible in the editor, including nodes, connectors, motion presets, and presentation data.",
      inputSchema: { type: "object", properties: {} },
      execute: () => ({ ok: true, document: adapter.getDocument() }),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: "drawcms_get_visual_grammar",
      title: "Explore DrawCMS visual grammar",
      description:
        "Queries the complete DrawCMS dictionary of elements, semantic purposes, common uses, unsuitable uses, compatible diagram types, motion guidance, motion presets, and relationship types.",
      inputSchema: visualGrammarQueryJsonSchema,
      execute: (input) => {
        const result = visualGrammarQuerySchema.safeParse(input);
        if (!result.success) return toErrorResult(result.error);
        return queryVisualGrammar(result.data);
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "drawcms_recommend_visuals",
      title: "Recommend DrawCMS elements and motion",
      description:
        "Recommends semantically appropriate DrawCMS elements, connector types, routing, motion presets, loop behavior, and playback order from entity roles and relationship meanings before a diagram is built.",
      inputSchema: recommendVisualsJsonSchema,
      execute: (input) => {
        const result = recommendVisualsSchema.safeParse(input);
        if (!result.success) return toErrorResult(result.error);
        try {
          const entityIds = new Set<string>();
          for (const entity of result.data.entities) {
            if (entityIds.has(entity.id))
              throw new WebMCPDiagramInputError(`Duplicate entity id: ${entity.id}`);
            entityIds.add(entity.id);
          }
          for (const relationship of result.data.relationships) {
            if (!entityIds.has(relationship.source)) {
              throw new WebMCPDiagramInputError(
                `Relationship has unknown source: ${relationship.source}`,
              );
            }
            if (!entityIds.has(relationship.target)) {
              throw new WebMCPDiagramInputError(
                `Relationship has unknown target: ${relationship.target}`,
              );
            }
          }
          return { ok: true, ...recommendVisualGrammar(result.data) };
        } catch (error) {
          return toErrorResult(error);
        }
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: "drawcms_validate_diagram",
      title: "Validate DrawCMS visual semantics",
      description:
        "Reviews the current diagram against the DrawCMS visual grammar and reports unregistered elements, shape-purpose mismatches, unsuitable motion, invalid sequence connectors, and choreography problems.",
      inputSchema: {
        type: "object",
        properties: {
          diagramType: {
            type: "string",
            enum: VISUAL_DIAGRAM_TYPES,
            description: "Optional intended notation; omit it to infer the diagram type.",
          },
        },
      },
      execute: (input) => {
        const result = validateVisualsSchema.safeParse(input);
        if (!result.success) return toErrorResult(result.error);
        try {
          return validateDiagramVisualGrammar(adapter.getDocument(), result.data.diagramType);
        } catch (error) {
          return toErrorResult(error);
        }
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
    },
    {
      name: "drawcms_replace_diagram",
      title: "Build DrawCMS diagram",
      description:
        "Builds and displays a complete animated technical diagram, replacing the current DrawCMS diagram with validated nodes, connectors, colors, and motion presets. Motion presets loop continuously unless a motion explicitly sets loop to false.",
      inputSchema: replaceDiagramJsonSchema,
      execute: async (input, options) => {
        try {
          if (options?.signal?.aborted)
            throw new DOMException("Tool execution aborted.", "AbortError");
          const document = createDocumentFromWebMCP(input);
          await adapter.replaceDocument(document);
          return {
            ok: true,
            documentName: document.meta.name,
            nodeCount: document.nodes.length,
            edgeCount: document.edges.length,
            animatedNodeCount: document.nodes.filter((node) => node.data.preset).length,
            animatedEdgeCount: document.edges.filter((edge) => edge.data?.preset).length,
          };
        } catch (error) {
          return toErrorResult(error);
        }
      },
      annotations: { untrustedContentHint: true },
    },
    {
      name: "drawcms_edit_diagram",
      title: "Edit DrawCMS diagram incrementally",
      description:
        "Adds, updates, deletes, and connects nodes and connectors on the current diagram as one undoable batch, without rebuilding it. Use this to refine an existing diagram; use drawcms_replace_diagram to build one from scratch.",
      inputSchema: editDiagramJsonSchema,
      execute: async (input, options) => {
        try {
          if (options?.signal?.aborted)
            throw new DOMException("Tool execution aborted.", "AbortError");
          const result = editDiagramInputSchema.safeParse(input);
          if (!result.success) return toErrorResult(result.error);
          const document = adapter.getDocument();
          const operations = resolveGraphEditOperations(result.data.operations, document);
          await adapter.applyGraphEdit(operations);
          const counts = {
            addNode: 0,
            updateNode: 0,
            deleteNode: 0,
            addEdge: 0,
            updateEdge: 0,
            deleteEdge: 0,
          };
          for (const operation of operations) counts[operation.op] += 1;
          return { ok: true, operationCount: operations.length, ...counts };
        } catch (error) {
          return toErrorResult(error);
        }
      },
      annotations: { untrustedContentHint: true },
    },
    {
      name: "drawcms_set_motion",
      title: "Retime DrawCMS motion",
      description:
        "Sets or clears motion presets, speed, and loop behavior on existing nodes and connectors by id, without rebuilding the diagram. A preset set here loops continuously unless the patch sets loop to false. Structure, positions, and narration are untouched.",
      inputSchema: setMotionJsonSchema,
      execute: async (input) => {
        const result = setMotionInputSchema.safeParse(input);
        if (!result.success) return toErrorResult(result.error);
        try {
          const document = adapter.getDocument();
          const nodeIds = new Set(document.nodes.map((node) => node.id));
          const edgeIds = new Set(document.edges.map((edge) => edge.id));
          for (const patch of result.data.patches) {
            const known = patch.targetKind === "node" ? nodeIds : edgeIds;
            if (!known.has(patch.targetId)) {
              throw new WebMCPDiagramInputError(
                `Unknown ${patch.targetKind} id: ${patch.targetId}`,
              );
            }
          }
          // Setting a preset without naming loop behavior means continuous
          // loop, matching the build paths, rather than inheriting whatever
          // the element happened to animate with before.
          const patches = result.data.patches.map((patch) =>
            patch.loop === undefined && typeof patch.preset === "string"
              ? { ...patch, loop: DEFAULT_MOTION_LOOP }
              : patch,
          );
          await adapter.setElementMotion(patches);
          return { ok: true, patchedCount: patches.length };
        } catch (error) {
          return toErrorResult(error);
        }
      },
      annotations: { untrustedContentHint: true },
    },
    {
      name: "drawcms_set_story",
      title: "Renarrate DrawCMS presentation",
      description:
        "Replaces the diagram's presentation scenes and steps — titles, descriptions, pacing, and which existing nodes and connectors each step highlights — without rebuilding structure or motion presets.",
      inputSchema: setStoryJsonSchema,
      execute: async (input) => {
        const result = setStoryInputSchema.safeParse(input);
        if (!result.success) return toErrorResult(result.error);
        try {
          const document = adapter.getDocument();
          const nodeIds = new Set(document.nodes.map((node) => node.id));
          const edgeIds = new Set(document.edges.map((edge) => edge.id));
          for (const scene of result.data.scenes) {
            for (const step of scene.steps) {
              for (const target of step.targets) {
                const known = target.targetKind === "node" ? nodeIds : edgeIds;
                if (!known.has(target.targetId)) {
                  throw new WebMCPDiagramInputError(
                    `Unknown ${target.targetKind} id: ${target.targetId}`,
                  );
                }
              }
            }
          }
          const scenes = result.data.scenes.map((scene, index) => ({
            id: scene.id ?? `scene-${index + 1}`,
            title: scene.title,
            ...(scene.description ? { description: scene.description } : {}),
            steps: scene.steps.map((step, stepIndex) => ({
              id: step.id ?? `step-${index + 1}-${stepIndex + 1}`,
              title: step.title,
              ...(step.description ? { description: step.description } : {}),
              ...(step.durationMs !== undefined ? { durationMs: step.durationMs } : {}),
              targets: step.targets,
            })),
          }));
          const story: StoryState = { scenes, activeSceneId: scenes[0].id };
          await adapter.replaceStory(story);
          return {
            ok: true,
            sceneCount: scenes.length,
            stepCount: scenes.flatMap((s) => s.steps).length,
          };
        } catch (error) {
          return toErrorResult(error);
        }
      },
      annotations: { untrustedContentHint: true },
    },
  ];
}

export interface RegisterDrawCMSWebMCPOptions {
  onError?: (error: unknown) => void;
}

/** Register the editor tools and return the spec-defined AbortSignal cleanup. */
export function registerDrawCMSWebMCPTools(
  modelContext: WebMCPModelContext,
  adapter: DrawCMSWebMCPAdapter,
  options?: RegisterDrawCMSWebMCPOptions,
): () => void {
  const controller = new AbortController();
  for (const tool of createDrawCMSWebMCPTools(adapter)) {
    void modelContext.registerTool(tool, { signal: controller.signal }).catch((error) => {
      if (!controller.signal.aborted) options?.onError?.(error);
    });
  }
  return () => controller.abort();
}

/** Current standard first; legacy navigator location supports older previews. */
export function resolveWebMCPModelContext(
  ownerDocument: Document | undefined = typeof document === "undefined" ? undefined : document,
): WebMCPModelContext | null {
  if (!ownerDocument) return null;
  const documentContext = (ownerDocument as Document & { modelContext?: WebMCPModelContext })
    .modelContext;
  if (documentContext?.registerTool) return documentContext;
  const legacyNavigator = ownerDocument.defaultView?.navigator as
    (Navigator & { modelContext?: WebMCPModelContext }) | undefined;
  return legacyNavigator?.modelContext?.registerTool ? legacyNavigator.modelContext : null;
}
