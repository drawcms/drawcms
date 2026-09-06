---
title: "Importer support and limitations"
---

Importers are plugins that convert foreign formats into DrawCMS documents.
Malformed files and unsupported file versions stop with a readable error.
Unsupported elements inside a valid file are skipped or approximated and
listed in a non-blocking import report.

Both importers are covered by fixtures under
`src/editor/io/{drawio,excalidraw}/fixtures` (see
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
- Images with an HTTP, HTTPS, or data URL

**Not supported (reported, skipped)**

- Waypoints/routing points and orthogonal edge styles (connectors are rerouted)
- Image stencils without an accessible URL (shown as rectangles)
- Embedded diagrams
- Layers and multi-page diagrams (first page only)
- Text formatting runs (bold/color per span) — plain text only
- Constraint-based relative positioning

## Excalidraw (`.excalidraw`, `.excalidrawlib`)

**Supported**

- Rectangles, ellipses, diamonds → shapes
- Text elements (bound text keeps its container relationship)
- Arrows → connectors when both endpoints resolve to shapes
- Images → image nodes (embedded data URLs)
- Frames → DrawCMS groups with child elements
- Fill color, stroke color, opacity, stroke width, and text size

**Not supported (reported, skipped)**

- Freehand strokes and standalone lines
- Excalidraw element groups (flattened; frame nesting is preserved)
- Arrows without two resolvable shape endpoints
- Images without embedded file data
- Library item metadata
- Roughness, sloppiness, and other hand-drawn rendering details

## After import

Shapes become real DrawCMS nodes, so motion presets, exports, and
persistence work exactly as on a hand-built diagram. Imported ids are re-keyed
to avoid collisions with existing content.
