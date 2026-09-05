---
title: "WebMCP agent authoring"
description: "Expose DrawCMS diagram and motion authoring as validated browser-native tools for AI agents."
---

## What it does

DrawCMS can expose the active authoring editor through the experimental
[WebMCP API](https://webmachinelearning.github.io/webmcp/). A browser agent can
then work through structured tool calls instead of trying to drag nodes and
connectors with simulated pointer input.

The integration is a progressive enhancement. DrawCMS checks for
`document.modelContext` at runtime, registers tools only when the API exists,
and removes them with an `AbortSignal` when the editor unmounts. No polyfill,
backend MCP server, API key, or agent SDK is added to the application.

## Enable it

The self-hosted OSS editor enables WebMCP on `/editor`. Hosts embedding the
editor source opt in per authoring editor:

```tsx
import { DrawCMSEditor } from "@/editor";

export function DiagramPage() {
  return <DrawCMSEditor webMcp />;
}
```

The option is ignored for `variant="presentation"`, so shared and embedded
viewers never expose authoring tools.

For local development, use a Chromium build with WebMCP support, enable
`chrome://flags/#enable-webmcp-testing`, and relaunch the browser. Live sites
currently need the Chrome 149+ WebMCP origin trial. WebMCP requires a secure,
origin-isolated document; the `tools` Permissions Policy defaults to `self`.
Do not opt out of origin isolation with `Origin-Agent-Cluster: ?0`.

## Exposed tools

| Tool                         | Effect                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `drawcms_get_diagram`        | Reads the complete current DrawCMS document. Read-only.                                                                                                      |
| `drawcms_get_visual_grammar` | Queries the complete element, motion, and relationship dictionary by category, diagram type, id, or free-text intent. Read-only.                             |
| `drawcms_recommend_visuals`  | Maps semantic entities and relationships to suitable elements, connector types, motion, loop behavior, and playback order. Read-only.                        |
| `drawcms_validate_diagram`   | Reviews the current diagram for unregistered elements, shape-purpose mismatches, unsuitable motion, sequence geometry problems, overlap, and narration gaps. |
| `drawcms_replace_diagram`    | Builds and displays a complete diagram from nodes, connectors, motion, and beats or an explicit story. Replaces the canvas and clears undo history.          |
| `drawcms_edit_diagram`       | Adds, updates, deletes, and connects nodes and connectors on the current diagram as one undoable batch, without rebuilding it.                               |
| `drawcms_set_motion`         | Sets or clears motion presets, speed, and loop behavior on existing nodes and connectors by id, without touching structure or narration.                     |
| `drawcms_set_story`          | Replaces presentation scenes and steps — titles, descriptions, pacing, and highlighted targets — without touching structure or motion presets.               |

## Visual grammar registry

The registry covers every element in the DrawCMS palette, including native
sequence notation, architecture and data-flow semantics, lifecycle states,
annotations, UML, BPMN, ER, containers, AWS, Google Cloud, Azure, and generic
infrastructure symbols. The dynamic Iconify and image elements are also
registered, but require an asset-selection workflow rather than plain diagram
replacement.

Every registry entry describes:

- its semantic purpose and the situations where it is normally used;
- common misuses to avoid;
- compatible diagram types;
- suitable motion presets and motion guidance;
- whether the element can be constructed directly through WebMCP.

Motion presets and relationship types have corresponding entries covering
directionality, typical use, unsuitable use, loop policy, and a reduced-motion
alternative. Palette-completeness tests fail when an editor element is added
without a registry entry.

Agents should query the relevant grammar section and call
`drawcms_recommend_visuals` before replacing or editing a semantic diagram. For
example, a sequence diagram recommendation uses native participant lifelines,
activation bars, synchronous or asynchronous message connectors, dashed return
messages, and self-message loops. Message motion is recommended once in
chronological order; only the complete scene should loop.

`drawcms_replace_diagram` and `drawcms_edit_diagram` accept every asset-free
node element in the registry, supply required defaults for tables, UML
classes, ER entities, containers, swimlanes, and semantic shapes, and accept
native sequence connector types. Nodes support Bounce, Spin, Pulse Node, and
Shake. Connectors support Pulse, Data Flow, Sequence Flow, Sequential Glow,
Fade Path, and Orbit.

## Loop behavior

Motion an agent applies loops continuously by default, matching the built-in
templates. Whenever a tool sets a preset — on a node or connector, through
`drawcms_replace_diagram`, `drawcms_edit_diagram`, a beat-derived preset, or
`drawcms_set_motion` — an omitted `loop` means the animation repeats, so the
agent gets a visibly animating diagram rather than one that plays once and
stops. Pass `loop: false` alongside the preset for a single play.

Retiming (`speed` only) and clearing (`preset: null`) never change loop
behavior: the element keeps whatever it already had. `prefers-reduced-motion`
still gates whether the ambient loop actually runs, and the human viewer's
controls are unaffected.

## Beats vs. an explicit story

`drawcms_replace_diagram` accepts nodes and edges plus one of two ways to
narrate them:

- **Beats** (`beats`) are the intent layer. Each beat is an ordered narrative
  moment — a title, optional description, the node and/or edge ids it
  concerns, and an optional semantic `kind` (`request`, `response`, `async`,
  `self-call`, `data-flow`, `handshake`, `dependency`, `state-transition`,
  `error`, `cycle`). DrawCMS resolves `kind` into a motion preset and
  connector routing from the same visual-relationship registry
  `drawcms_recommend_visuals` draws from, and turns the ordered beats into one
  presentation scene. An explicit `motion` field set directly on the node or
  edge always overrides what a beat would otherwise derive for it.
- **An explicit `story`** gives full control over scenes, steps, targets, and
  per-step `durationMs` pacing, and wins entirely over beats when both are
  supplied.

Use beats to describe what a moment means; use an explicit story when the
agent already knows the exact presentation structure it wants.

## Automatic layout

Node positions are optional. DrawCMS lays out only the nodes an agent omitted
a position for — an explicit `position` always wins:

- **`sequence`** diagrams place participant lifelines in columns ordered by
  their first appearance among the edges, at a uniform lifeline height.
  Activation bars positioned via `participantId` size themselves from the
  message rows that participant is actually involved in.
- **`flowchart`, `architecture`, `data-flow`, `lifecycle`** diagrams rank
  nodes by longest path over the edges (a topological layering) and place
  ranks left to right, with a barycenter sweep that reduces connector
  crossings. A real cycle in the edge set falls back to the grid below.
- Everything else — **`general`, `uml`, `bpmn`, `entity-relationship`**, and
  any cyclic graph among the ranked types — uses a readable grid.

## Sequence message rows

Native sequence connectors attach to ascending `sequence-row-N` lifeline
handles assigned in array order — the same chronological convention
hand-authored sequence diagrams use. A self-message
(`sequence-message-self`) consumes two consecutive rows.
`drawcms_edit_diagram` continues numbering from whatever rows existing
messages already occupy. A sequence diagram is limited to 12 message rows
total; exceeding it returns a retryable `INVALID_DIAGRAM` error naming the
offending edge instead of silently clamping every remaining message onto the
last row, so an agent can split the interaction into a smaller diagram.

## Incremental edits and undo

`drawcms_edit_diagram` applies a batch of `addNode` / `updateNode` /
`deleteNode` / `addEdge` / `updateEdge` / `deleteEdge` operations, in array
order, as a single undoable action — one <kbd>Cmd</kbd>+<kbd>Z</kbd> reverts
the whole batch. An operation can reference an id added earlier in the same
batch, for example connecting an edge to a node the same call just added. New
elements go through the same construction `drawcms_replace_diagram` uses, so
an incrementally added element matches one built from scratch. IDs are
validated against the live diagram before anything is applied — an unknown or
duplicate id fails the entire batch with nothing partially applied.

This is deliberately different from `drawcms_replace_diagram`, which still
clears undo history on every call. Replacing is for building a diagram from
scratch; editing is for refining what is already on the canvas.

## Retiming motion and narration without rebuilding

- `drawcms_set_motion` patches `preset` / `speed` / `loop` on existing nodes
  and connectors by id. Set `preset` to `null` to clear it. A preset set
  without an explicit `loop` loops continuously, so it never inherits a
  `loop: false` left over from the element's previous animation. It never
  touches structure, positions, or narration.
- `drawcms_set_story` replaces the full set of presentation scenes and steps —
  titles, descriptions, per-step `durationMs`, and which existing ids each
  step highlights — without touching structure or motion presets.

Both validate every id against the current diagram first and return a
retryable `INVALID_DIAGRAM` error naming the unknown id rather than applying
a partial change.

## Playback

Playback is human-driven only. There is no agent-facing playback tool: an
agent authors structure, motion, and narration, and a person drives the
ambient motion loop and step-by-step presentation from the editor's own
controls.

Try a prompt such as:

> Build a request-flow diagram with browser, API, worker, and database nodes.
> First recommend architecture elements and motion for HTTPS request, queue
> publish, worker processing, database write, and response relationships.
> Then build the result with beats describing that order.

## Validation and trust boundary

Tool input is validated again in editor code instead of trusting the JSON
Schema alone. Duplicate IDs, unknown edge or story-target endpoints, unknown
ids passed to `drawcms_set_motion` / `drawcms_set_story` / `drawcms_edit_diagram`,
unsupported element types, invalid presets, sequence-row exhaustion, and
out-of-range values all return a concise, retryable error that an agent can
correct and retry — never a partially applied change. Replacement and
incremental edits go through the same versioned document, undo history, and
persistence boundaries as human-authored content, so the visible canvas and
local autosave stay synchronized.

`drawcms_get_diagram`, `drawcms_get_visual_grammar`, `drawcms_recommend_visuals`,
and `drawcms_validate_diagram` are marked read-only. Tool output that can
contain authored labels is marked as untrusted content for compatible agents.
WebMCP still runs inside the current browser session, so enable authoring
tools only on pages where an agent is allowed to change the current diagram.

WebMCP is a draft Community Group report rather than a W3C standard and may
change. DrawCMS keeps its WebMCP-specific types behind a small adapter so hosts
can follow those changes without coupling their document model to the browser
API.
