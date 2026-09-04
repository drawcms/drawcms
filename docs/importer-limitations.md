---
title: "Importer support and limitations"
---

Importers are plugins: they convert foreign formats into DrawCMS documents
and never fail hard — unsupported content lands in a **non-blocking import
report** that also tells you exactly what was skipped.

Both importers are covered by fixtures under
`packages/editor/src/io/{drawio,excalidraw}/fixtures` (see
`unsupported-oddballs.drawio` for the negative cases).

## draw.io (`.drawio`, `.xml`)

**Supported**

- mxCell vertices: rectangles and their `rounded`, `ellipse`, `rhombus`,
  `triangle`, `cylinder`, `cloud`, `callout`, `note`, `process`-family
  variants
- Labels (HTML stripped to plain text), basic fill/stroke colors, stroke width
- Geometry (x/y/width/height)
- Nested parents → DrawCMS container reparenting (groups)
- Common connectors (edges) between vertices, plain edge labels

**Not supported (reported, skipped)**

- Waypoints/routing points and orthogonal edge styles (edges become straight)
- Image stencils and embedded diagrams
- Layers and multi-page diagrams (first page only)
- Text formatting runs (bold/color per span) — plain text only
- Constraint-based relative positioning

## Excalidraw (`.excalidraw`, `.excalidrawlib`)

**Supported**

- Rectangles, ellipses, diamonds → shapes
- Text elements (bound text keeps its container relationship)
- Arrows/lines → connectors with their bound start/end elements
- Images → image nodes (embedded data URLs)
- Groups
- Rough sketch color palettes → nearest editor styling

**Not supported (reported, skipped)**

- Freehand strokes (converted to bounding-box notes when possible, else skipped)
- Frames
- Library item metadata
- Per-stroke roughness and sloppiness (visual only)

## After import

Shapes become real DrawCMS nodes, so motion presets, exports, and
persistence work exactly as on a hand-built diagram. Imported ids are re-keyed
to avoid collisions with existing content.
