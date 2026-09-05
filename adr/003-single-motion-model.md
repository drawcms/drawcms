---
title: "ADR 003: Single motion model"
---

# 003 — Single motion model: remove the unplayed timeline instead of wiring it up

## Status

Accepted.

## Context

Through document schema v4, `motion` carried two independent structures:

- **Timed motion** (`motion.scenes` → `tracks` → `steps`): a scene/track/step
  timeline keyed by target id, with each step carrying an `at` offset and
  optional `delay`, apparently meant to sequence element animation
  independently of anything else.
- **Story** (`motion.story` → `scenes` → `steps`): a narrative presentation
  model added later (DM-019), where a step references one or more existing
  node/edge ids and drives the presentation dock, shared pages, and embeds.

No runtime code ever read or played back the timed-motion timeline. Element
animation (`preset`, `motionSpeed`, `motionLoop`) has always lived directly on
node/edge `data` and plays through GSAP on the canvas, independent of either
timeline. The scene/track/step structure was validated by the document
schema, carried through every migration step, and exposed in the public
document type — but had no editor UI, no player, and no WebMCP tool that
built or read it meaningfully. It was dead weight that only risked confusing
future contributors and integrators (including AI agents) about which of two
"motion" concepts actually did anything, especially as WebMCP tooling started
needing to reason precisely about "what happens when."

Two paths were available for the WebMCP enhancement work that surfaced this:

1. **Wire up a player** for the timed-motion timeline, giving it the runtime
   behavior its shape implied.
2. **Remove it** from the runtime model, keeping the narrative story as the
   only sequencing concept alongside per-element motion presets.

## Decision

Remove the timed-motion timeline from the runtime model rather than building
a player for it.

- `MotionState` (`motion/model.ts`) now carries only `story`. The
  `scenes`/`tracks`/`steps` shape is gone from `motion/model.ts` and
  `motion/ops.ts`; `motion/player.ts`, `motion/state.ts`, `motion/presets.ts`,
  and `components/sequence-helpers.ts` are deleted along with their tests.
- `DOCUMENT_SCHEMA_VERSION` moves 4 → 5. The v5 schema's `motion` field is
  `motionStateSchema` (story-only). `documentV4Schema` is kept specifically so
  `migrateDocument` can still read and discard the old shape from v1–v4
  documents; a legacy-only `legacyMotionStateSchema` in `document/schema.ts`
  documents that this shape is migration-input-only, never runtime state.
- `upgradeV4toV5` (`document/migrate.ts`) drops `motion.scenes` unconditionally
  and keeps an existing `motion.story` untouched. If a v4 document had no
  separate story at all (uncommon — the v2 → v3 step always backfills one,
  but a hand-crafted v4 payload might omit it), one is derived once from the
  timeline's step labels via `storyFromLegacyMotion`, so no authored copy is
  silently lost on open.
- `EDITOR_API_VERSION` moves 1 → 2, since `DrawCMSDocument`'s public shape
  changed and any code reading `document.motion.scenes` directly would break.
  See [public-api-versioning.md](../public-api-versioning.md) for the
  migration note.
- WebMCP's `drawcms_set_motion_preview` tool (ambient preset loop only) was
  replaced by `drawcms_preview`, which drove step-by-step story playback in
  addition to the ambient loop. Both tools have since been removed: playback
  is human-driven only, and the WebMCP surface stays limited to authoring
  structure, motion, and narration. The single-motion-model decision itself is
  unaffected — the story remains the only sequencing concept.

## Alternatives considered

- **Wire the player.** Rejected: nothing in the product ever needed a
  timeline independent of the story, and building playback, editor UI, and
  WebMCP tooling for a second sequencing concept would have doubled the
  surface area agents and human authors both need to reason about, for a
  feature no one was using.
  > "we use legacy preset, no timeline editor/player (remove this, can make
  > ambiguity)"
- **Dual-author (keep both, wire neither).** Rejected as the status quo that
  motivated this decision: an unplayed field in the public document schema
  and type is itself a source of ambiguity for integrators and agents, even
  if the editor UI never surfaces it.

## Consequences

- Any document written before this change (v1–v4) still opens correctly;
  `migrateDocument` absorbs the shape difference. New documents cannot
  represent it at all going forward.
- Any external plugin, host, or import/export tool that read
  `document.motion.scenes`/`tracks` directly (rather than through the
  narrative story) must update for `EDITOR_API_VERSION` 2 — see the migration
  note in [public-api-versioning.md](../public-api-versioning.md).
- There is now exactly one place that answers "what does this diagram do
  over time": the story. Per-element motion presets remain independent of it,
  answering "how does this one element animate."
