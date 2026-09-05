---
title: "DrawCMS document format v5"
---

Every saved or exchanged diagram is a versioned JSON document, defined by
`src/editor/document/schema.ts` (zod). The same schema runs in the browser
editor, in importers/exporters, in the cloud service, and in tests.

```jsonc
{
  "schemaVersion": 5,
  "meta": {
    "name": "Untitled diagram", // required, 1..120 chars
    "description": "…", // optional, <= 2000 chars
    "createdAt": "…", // optional ISO-8601
    "updatedAt": "…",
  },
  "canvas": {
    "viewport": { "x": 0, "y": 0, "zoom": 1 }, // optional
    "background": "dots", // optional
  },
  "nodes": [
    /* AppNode without ephemeral `selected`; per-element preset motion
       settings (preset, motionSpeed, motionLoop) live in data */
  ],
  "edges": [/* AppEdge; per-element preset settings live in data */],
  "assets": [
    // Derived from image nodes; never stores pixel data twice.
    { "id": "asset-<nodeId>", "kind": "image", "source": "embedded|remote", "uri": "…" },
  ],
  "motion": {
    // The only thing `motion` carries: narrative presentation order. Every
    // element's own animation (preset, speed, loop) lives on that element's
    // `data`, not here — see "A single motion model" below.
    "story": {
      "activeSceneId": "story-scene-1",
      "scenes": [
        {
          "id": "story-scene-1",
          "title": "Request flow",
          "description": "How a request reaches the API.",
          "steps": [
            {
              "id": "…",
              "title": "Validate request",
              "description": "The API checks the incoming payload.",
              "targets": [{ "targetId": "<node or edge id>", "targetKind": "node|edge" }],
              "durationMs": 4000, // optional, 500-30000ms; how long the step holds before auto-advancing
            },
          ],
        },
      ],
    },
  },
}
```

## A single motion model

Element animation and narrative presentation are two independent, but no
longer parallel, concepts:

- **Element motion** (`preset`, `motionSpeed`, `motionLoop`) lives directly on
  a node or edge's `data`. It answers "how does this element animate?" and is
  configured through that element's **Motion** tab.
- **Story** (`motion.story`) answers "in what order, and with what
  explanation, does a viewer see the diagram?" A step references existing
  node and edge ids; it does not carry its own animation actions or timing
  beyond `durationMs`, the pacing hold before auto-advancing to the next step.

Earlier document versions (through v4) also carried a separate scene/track/step
**timeline** in `motion.scenes`, meant to sequence element animation
independently of the story. Nothing in the shipped editor ever played that
timeline back, so v5 removes it from the runtime model entirely rather than
building a player for it. See
[ADR 003](decisions/003-single-motion-model.md) for the reasoning.
`migrateDocument` still reads and discards the old shape when opening a v1–v4
document (falling back to deriving a story from its step labels if the
document had no separate story of its own), so nothing narratively meaningful
is lost on open.

## Edge routing

Connector geometry is persisted in `edge.data` so editing, playback, export,
and every host render the same path:

- `routingMode`: `"straight"`, `"elbow"`, or `"curve"` (omitted means the
  legacy/default curve renderer).
- `bend`: `{ x, y }`, a canvas-space offset from the midpoint between the
  connector endpoints. Moving either endpoint keeps the bend relative to the
  connector instead of pinning it to a stale absolute coordinate.
- `curveOffset`: the older vertical-only bend field. It remains readable for
  compatibility; new edits write `bend`.
- `sourceOffset` / `targetOffset`: canvas-space visual offsets from the
  attached lifeline anchors. These let a sequence message point freely while
  its source and target identities remain stable.
- `sequenceType`: identifies an attached sequence message edge as synchronous,
  asynchronous, return, or self-referential. Ordered `sequence-row-*` source
  and target handles keep it attached to participant lifelines.
- `scale`: visual size of an attached sequence message from `0.5` to `2`. It
  scales line weight, arrowhead, label, and self-loop clearance.

Routing fields are optional. Documents created before editable paths therefore
open without migration and retain their existing connector geometry.

## Unknown-field policy: preserve

All object schemas are passthrough. Fields written by a newer editor survive a
round trip through an older one untouched. Known fields are still type-checked;
a payload whose **schemaVersion** the current build does not understand fails
safe (`DocumentMigrationError`) instead of guessing.

## Versions and migration

`migrateDocument(input)` is the single entry point for opening anything:

- **v5** documents are validated and returned as-is.
- **v4** documents drop the unplayed scene/track/step timeline. An authored
  story survives untouched; a document that only ever had the timeline (no
  separate story) gets one derived once from the timeline's step labels so
  nothing narratively meaningful disappears silently.
- **v3** sequence message nodes are upgraded to attached message edges, and
  their motion/story targets change from `node` to `edge`.
- **v2** timed motion copy is preserved and migrated into a separate
  `motion.story` narrative. Story steps reference items but do not carry
  animation actions or timing.
- **v1** documents gain a `motion` section. Per-element presets already live
  on `data.preset`/`motionSpeed`/`motionLoop` and are unaffected; the v1 → v2
  step itself only needs to add an empty motion shell now that v5 removed the
  timeline that used to be built from those presets.
- **v0** (legacy unversioned `{ nodes, edges }`, optionally with `name`) is
  wrapped in the envelope first, then migrated like a v1.
- Anything else throws rather than partially interpreting.

The default editor creates story steps from canvas selection and keeps ordering
in a dedicated right-side panel. Shared and embedded presentations use a compact
read-only bottom rail. Animation is configured independently on nodes and edges
through their Motion tab. Malformed motion or story references to deleted
targets degrade safely during normalization; they are dropped, never fatal.

## Determinism

`deterministicStringify(document)` emits object keys in sorted order at every
depth, so semantically identical documents always serialize to the same string.
Serializers never invent values (no fresh timestamps): hosts pass the metadata
they want recorded. Array order is document state and is preserved.
