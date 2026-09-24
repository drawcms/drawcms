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

The self-hosted OSS editor enables WebMCP on `/` (`/editor` redirects there).
Hosts embedding the
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
`chrome://flags/#enable-webmcp-testing`, and relaunch the browser. Chrome 149
introduced a time-limited WebMCP origin trial for live sites. Check the
[Chrome origin-trial page](https://developer.chrome.com/blog/ai-webmcp-origin-trial)
before relying on it in production. WebMCP requires a secure, origin-isolated
document; the `tools` Permissions Policy defaults to `self`. Do not opt out of
origin isolation with `Origin-Agent-Cluster: ?0`.

## Exposed tools

| Tool                         | Effect                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drawcms_get_diagram`        | Reads the complete current DrawCMS document. Read-only.                                                                                                                 |
| `drawcms_search_icons`       | Searches Iconify for exact icon names, collections, and license metadata. Sends only the search query; never uploads the diagram. Read-only.                            |
| `drawcms_get_visual_grammar` | Queries the complete element, motion, and relationship dictionary by category, diagram type, id, or free-text intent. Read-only.                                        |
| `drawcms_recommend_visuals`  | Maps semantic entities and relationships to suitable elements, connector types, motion, loop behavior, and playback order. Read-only.                                   |
| `drawcms_validate_diagram`   | Reviews the current diagram for unregistered elements, shape-purpose mismatches, unsuitable motion, sequence geometry problems, overlap, and narration gaps.            |
| `drawcms_replace_diagram`    | Builds and displays a complete diagram from nodes, connectors, motion, and beats or an explicit story. Replaces the canvas and clears undo history.                     |
| `drawcms_edit_diagram`       | Adds, updates, deletes, and connects nodes and connectors on the current diagram as one undoable batch, without rebuilding it.                                          |
| `drawcms_tidy_diagram`       | Re-derives positions and connector geometry for the diagram already on the canvas so nothing overlaps, as one undoable batch. Scope it to positions or connectors only. |
| `drawcms_set_motion`         | Sets or clears motion presets, speed, and loop behavior on existing nodes and connectors by id, without touching structure or narration.                                |
| `drawcms_set_story`          | Replaces presentation scenes and steps — titles, descriptions, pacing, and highlighted targets — without touching structure or motion presets.                          |

## Visual grammar registry

The registry covers every element in the DrawCMS palette, including native
sequence notation, architecture and data-flow semantics, lifecycle states,
annotations, UML, BPMN, ER, containers, AWS, Google Cloud, Azure, and generic
infrastructure symbols. Iconify icons can be searched with `drawcms_search_icons`
and built as `type: "icon"` with an `iconName`. The editor downloads, sanitizes,
and embeds the SVG before applying the change. Image elements still require
their separate asset-selection workflow.

Every registry entry describes:

- its semantic purpose and the situations where it is normally used;
- common misuses to avoid;
- compatible diagram types;
- suitable motion presets and motion guidance;
- whether the element can be constructed directly through WebMCP.

Motion presets and relationship types have corresponding entries covering
directionality, typical use, unsuitable use, loop policy, and a reduced-motion
alternative. Relationship entries also carry the `notation` value to pass on a
built connector, so the structural notations (`association`, `include`,
`extend`, `message-flow`) are discoverable through the registry rather than
only through a tool's schema. Palette-completeness tests fail when an editor
element is added without a registry entry, and every diagram type is required
to carry its own authoring conventions.

Agents should query the relevant grammar section and call
`drawcms_recommend_visuals` before replacing or editing a semantic diagram. For
example, a sequence diagram recommendation uses native participant lifelines,
activation bars, synchronous or asynchronous message connectors, dashed return
messages, and self-message loops. Message motion is recommended once in
chronological order; only the complete scene should loop.

Recommendation reads both the `role` and the `label` of each entity, matching
whole words. An entity given `{ role: "component", label: "Postgres" }` is still
recognized as a datastore, a named technology gets its own mark (Redis,
Postgres, Kubernetes and similar resolve to their logo elements rather than a
generic box), and a label ending in "?" is treated as a branch in every notation
that has one. Whole-word matching is what keeps "Build pipeline" from reading as
a front end.

`drawcms_replace_diagram` and `drawcms_edit_diagram` accept every asset-free
node element plus named Iconify icons, supply required defaults for tables, UML
classes, ER entities, containers, swimlanes, and semantic shapes, and accept
native sequence connector types. Nodes support Bounce, Spin, Pulse Node, and
Shake. Connectors support Pulse, Data Flow, Sequence Flow, Sequential Glow,
Fade Path, and Orbit.

## Reference layouts, icons, and real groups

Use `drawcms_search_icons({ query: "shield check", prefix: "lucide", limit: 12 })` before placing
a pictogram. Results contain `iconName`, `prefix`, `name`, `setTitle`,
`licenseTitle`, and `licenseSpdx`. Pick a consistent family and pass its exact
identifier to an icon node. `iconColor` controls monochrome artwork using
`currentColor`; multi-color artwork retains its own colors. Raw SVG and arbitrary
asset URLs are not accepted as authoring inputs. A download failure or
cancellation leaves the diagram unchanged. If the diagram changes while
artwork is downloading, the tool rejects the stale operation so the agent can
read and retry against the latest state.

Compose a reference card using a background shape as the parent of an icon,
title, caption, and badge. `parentId` is actual React Flow membership, not a
visual overlap: moving the parent moves every nested child. Child `position`
is explicitly **relative to the parent's top-left**. Parents can be ordinary
shapes or grouping frames. Missing parents and cycles are rejected. Replacement
accepts any node order; an incremental batch must add a parent before its children.

```json
{
  "name": "Identity and access",
  "diagramType": "architecture",
  "nodes": [
    {
      "id": "access",
      "type": "round-rect",
      "label": "",
      "position": { "x": 320, "y": 160 },
      "width": 460,
      "height": 108,
      "fillColor": "#FFF5DA",
      "strokeColor": "#D8C27A",
      "borderRadius": 12
    },
    {
      "id": "shield",
      "type": "icon",
      "iconName": "lucide:shield-check",
      "iconColor": "#071B4C",
      "label": "",
      "parentId": "access",
      "position": { "x": 26, "y": 26 },
      "width": 56,
      "height": 56
    },
    {
      "id": "title",
      "type": "text",
      "label": "Identity & Access",
      "parentId": "access",
      "position": { "x": 108, "y": 22 },
      "width": 330,
      "height": 36,
      "fontSize": 28,
      "fontWeight": "700",
      "textAlign": "left",
      "textColor": "#071B4C"
    },
    {
      "id": "caption",
      "type": "text",
      "label": "authenticate • authorize • scope",
      "parentId": "access",
      "position": { "x": 108, "y": 65 },
      "width": 330,
      "height": 24,
      "fontSize": 18,
      "fontWeight": "400",
      "textAlign": "left"
    }
  ],
  "beats": [{ "title": "Establish authority", "nodeIds": ["access"] }]
}
```

All node creation and update paths expose `fontSize`, `fontWeight`, `fontFamily`,
`fontStyle`, `textDecoration`, `textAlign`, `lineHeight`, `textAutoResize`,
`strokeWidth`, `opacity`, `borderRadius`, `headerColor`, and `zIndex` alongside
the existing colors. Text-specific fields apply to text elements; structured
elements keep their own layout. Explicit text sizes default `textAutoResize`
to false. Rounded rectangle `borderRadius` uses canvas pixels. Empty group
labels hide the default tab, allowing a custom child heading.

`updateNode` also accepts `width`, `height`, and `parentId`. Reparenting without
`position` preserves the element's absolute location. With `position`, the
coordinates are relative to the new parent. Set `parentId: null` to detach a
child. Changes are applied as one undoable batch. Deleting a parent cascades to
its descendants and their edges; detach children first to keep them.

Connectors use absolute coordinates for nested endpoints and can pass through
their enclosing frames. Tidy operates on root compositions without rearranging
their children; use `scope: "connectors"` to preserve an intentional reference
layout. Story steps targeting a parent highlight all descendants, including
its icons and captions. Explicit connector targets still limit the step to
exactly those connectors.

Check the rendered canvas against the reference as well as running semantic
validation. Icons, typography, alignment, line wrapping, and connector paths
determine fidelity; a successful build receipt alone does not.

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
  crossings. Cycles retain a forward backbone with separately routed feedback edges.
- **`bpmn`, `uml`, `entity-relationship`, `database-model`** also use size-aware layers.
- **`use-case`** separates actors from goals; **`general`** uses a size-aware grid.

Automatic placement then pushes any node whose position was omitted clear of
the nodes that have explicit coordinates, and `drawcms_tidy_diagram` re-runs the
whole pass over a diagram that already exists.

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

An incremental edit inherits the notation the diagram was authored in, so
refining a diagram does not degrade it:

- A node added without a `position` is placed in free space rather than on a
  fixed coordinate, and two positionless additions in the same batch never land
  on each other.
- `addNode` accepts `rows` and `entityAttributes`, and reserves height for the
  fields exactly as a full rebuild does.
- `addEdge` accepts `notation`, `sourceCardinality`, and `targetCardinality`,
  and defaults to the same orthogonal routing and structural association the
  diagram's other connectors already use — not a directed curve.
- `updateEdge` accepts those three too. Multiplicity is rendered _into_ the
  label text, so restate `sourceCardinality` and `targetCardinality` whenever
  you change the label of a relationship that had them; a bare `label` patch
  replaces the composed text and `drawcms_validate_diagram` will then report
  `MISSING_CARDINALITY`.
- New connectors are routed around the shapes already on the canvas.
- Moving a node discards the stored routes of the connectors attached to it, so
  they redraw cleanly instead of tracing coordinates that no longer exist.

## Tidying an existing layout

`drawcms_tidy_diagram` re-runs layout and routing over the diagram that is
already on the canvas and applies the result as one undoable batch. Unlike
`drawcms_replace_diagram` it preserves undo history, so a person can revert the
tidy with a single <kbd>Cmd</kbd>+<kbd>Z</kbd> and get their arrangement back.

Use it after a series of incremental edits, or to recover from a
`STALE_AUTOMATIC_ROUTE` warning once someone has dragged elements around.
`scope` controls what is re-derived:

| `scope`      | Effect                                                            |
| ------------ | ----------------------------------------------------------------- |
| `all`        | Default. Re-derives positions and connector geometry.             |
| `positions`  | Moves elements only; leaves stored routes alone.                  |
| `connectors` | Re-routes only, keeping a deliberate human arrangement untouched. |

It accepts the same optional `diagramType` and `direction` as a build, so a
diagram can be re-laid out top-to-bottom without rebuilding it. Tidying an
already tidy diagram moves nothing. Sequence diagrams are left in place —
their lifelines are positioned from message rows rather than by graph layout —
and the result says so in a `note`.

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
correct and retry — never a partially applied change. Replacement, incremental
edits, and tidying go through the same versioned document, undo history, and
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

## Readable flow, use-case, BPMN, and database diagrams

`drawcms_replace_diagram` accepts an explicit `diagramType` and `direction`
(`LR`, the default, or `TB`). Flow diagrams use `flowchart`; UML actors and
user goals use `use-case`; conceptual ERDs use `entity-relationship`; physical
schemas use `database-model`. Omit positions to use automatic placement.

- Layout uses actual requested dimensions and estimates label/content space.
  BPMN and cyclic flows retain forward ranks, with feedback connectors routed
  separately. Use-case actors occupy a separate column from goals.
- Tables accept `rows: [{ id, name, type }]`; ER entities accept
  `entityAttributes: [{ id, name, isKey }]`; UML classes and objects accept
  `attributes` and `methods` as `[{ id, text }]` compartment lines written the
  way UML writes them (`- total: Money`, `+ addLine(item): void`). Their layout
  reserves space for every field. Compartments an agent does not supply stay
  **empty** — a tool-built class never invents `- id: int` placeholder members,
  because a reader cannot tell invented fields from authored ones. (Dragging the
  same element off the palette still seeds sample content to edit.) Mark
  physical PK/FK columns in their names and name FK mappings on connectors.
  Supply real fields instead of relying on sample defaults.
- Shapes are sized for the space their text can actually occupy, not their
  bounding box. A diamond's inscribed area is about half its box on each axis
  and an ellipse's about 70%, so a decision or a use case is grown enough for
  its label to sit inside the drawn outline rather than spilling over it.
- Semantic diagrams default to orthogonal connectors. The router chooses face
  anchors and clear channels, penalizes shared paths, and places wrapped labels
  beside segments away from nodes, connectors, and earlier labels.
- `notation` supports `directed`, `association`, `include`, `extend`, and
  `message-flow`. Associations are undirected. Include/extend are dashed and
  point toward the included/base use case. BPMN message flows are dashed with
  open arrowheads; model participant ownership explicitly.
- `sourceCardinality` and `targetCardinality` accept `0..1`, `1`, `0..*`, and
  `1..*`. They appear as endpoint-qualified text in the relationship label;
  these are **not crow's-foot glyphs**.
- Structural models stay static by default; flowcharts and BPMN use solid control-flow lines unless motion is explicitly requested or supplied through a beat.
- The notation is recorded on the document as `meta.diagramType`, so later
  validation and tidying use the notation you authored rather than re-guessing
  it from shapes.
- Every build returns a `validation` report. Check warnings before presenting:
  overlapping elements, unlabeled decision branches, invalid BPMN event
  direction, gateway message flows, and unresolved routing/label collisions.
  Notation-specific conventions are checked too — a physical table with no
  primary key or no columns, an ER entity whose attributes name no key, a
  relationship that states no multiplicity, a use-case diagram with no actor,
  two actors associated directly, and `«include»`/`«extend»` used anywhere
  other than between two use cases.
- The element you choose is also checked against the label it carries, because
  an explicit `type` is otherwise only validated for existing. A service shape
  carrying a datastore name (`LABEL_DESCRIBES_DATASTORE`), a store shape
  carrying a service name (`DATASTORE_SEMANTIC_MISMATCH`), a bare role such as
  "Customer" drawn as a system element (`LABEL_DESCRIBES_ACTOR`), a label ending
  in "?" that is not drawn as a decision (`LABEL_ASKS_A_QUESTION`), and an
  element belonging to a different notation (`ELEMENT_OUTSIDE_NOTATION`) each
  return a warning naming the element.
- Grouping frames — `data-stage` and the `boundary-*` family, plus the plain
  container shapes — are meant to enclose other elements. One that is wired
  between two steps with nothing inside it draws a large empty box with its
  title in a corner, and returns `CONTAINER_USED_AS_STEP`.

Example physical schema:

```json
{
  "name": "Customer orders",
  "diagramType": "database-model",
  "nodes": [
    {
      "id": "customers",
      "type": "table",
      "label": "customers",
      "rows": [{ "id": "id", "name": "id PK", "type": "uuid" }]
    },
    {
      "id": "orders",
      "type": "table",
      "label": "orders",
      "rows": [
        { "id": "id", "name": "id PK", "type": "uuid" },
        { "id": "customer_id", "name": "customer_id FK", "type": "uuid" }
      ]
    }
  ],
  "edges": [
    {
      "source": "customers",
      "target": "orders",
      "label": "orders.customer_id → customers.id",
      "sourceCardinality": "1",
      "targetCardinality": "0..*"
    }
  ]
}
```

Explicit positions remain fixed; omitted positions move out of their way.
Explicit straight/curve routes remain manual. Saved automatic routes fall back
to ordinary elbow geometry after their endpoint moves/resizes or their bend
is edited; call `drawcms_tidy_diagram` to recompute obstacle clearance without
rebuilding the diagram. Multiplicity is accepted in either convention — the
endpoint-qualified text a build composes, or a bare Chen marker such as `1` or
`N` against a relationship diamond. Layout is a bounded
heuristic, not a guarantee for arbitrary dense graphs or fixed overlaps. When
the router cannot find a clear path or label position it reports
`CONNECTOR_NODE_COLLISION` or `CONNECTOR_LABEL_COLLISION` rather than shipping
geometry it knows is wrong.
Pools, lanes, and system boundaries still need explicit grouping/ownership;
the tool does not infer business participants or claim full BPMN conformance.
