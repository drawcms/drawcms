---
title: "Core concepts"
description: "Understand the canvas, motion, story steps, and files that make up a DrawCMS diagram."
---

DrawCMS turns a technical diagram into a guided explanation. The diagram remains useful as a
static artifact, while motion and story steps add the order, focus, and context a viewer needs.

## Canvas items

The canvas contains **nodes** and **connectors**. Nodes can represent services, databases,
containers, sequence participants, annotations, and other diagram elements. Connectors describe
relationships or flow between them.

Select an item to edit its text, appearance, routing, or motion. Multi-select items when a story
step should focus on a group.

## Motion

Motion belongs to an individual node or connector. Open the selected item's **Motion** tab to pick
a preset and configure its speed or looping behavior.

Use motion to communicate what an item does: a connector can show flow, an element can enter when
it becomes relevant, and a service can pulse to draw attention. Motion settings stay attached to
the item when you reorder the story.

## Story scenes and steps

A **story** controls what the viewer reads and sees in sequence:

- A **scene** groups a part of the explanation, such as “Current architecture” or “Migration.”
- A **step** contains a title, optional description, references to one or more canvas items, and
  how long it holds before auto-advancing during playback.
- The **Steps** panel controls the order. Reordering steps does not change item motion.

To create a step, select one or more items, right-click, and choose **Add as step**. During preview,
DrawCMS highlights exactly the referenced items. When a step references only nodes, direct
connectors between those nodes join the highlight too. Select the connectors yourself when a step
should follow specific ones — a step that names any connector highlights only the ones it names.
Sequence steps normally want that, since several messages can share the same pair of lifelines.

## Preview and presentation

**Preview** plays the same read-only presentation used by shared pages and embeds. Viewers can move
around the canvas and change zoom, but they cannot edit the diagram.

Preview early. A clear presentation usually uses short step titles, one idea per step, and only the
items needed to explain that idea.

## Documents and local-first storage

A `.drawcms` file contains the canvas, motion, story, metadata, and asset references in one
versioned JSON document. The self-hosted web app autosaves in the browser; use **File → Save** to
download a portable copy.

DrawCMS preserves fields written by newer compatible versions and migrates older supported
documents when they open. See the [document format](document-format.md) for the schema and migration
policy.

## Import and export

Importers translate supported parts of draw.io and Excalidraw diagrams into DrawCMS items and show
a report for anything they cannot represent. The original source file is not modified.

The self-hosted editor exports PNG stills and animated GIF locally, no account
required. It shows SVG, MP4, and Share as Cloud features. Setting
`NEXT_PUBLIC_CLOUD_URL` configures those upgrade links; it does not enable the
features in the open-source host. See [DrawCMS Cloud](cloud.md) for the hosted
storage, sharing, and export behavior.
Check [browser support](browser-support.md) before choosing a delivery format.

## A useful first workflow

1. Start from a template or import an existing diagram.
2. Clean up labels, layout, and connector routing.
3. Add motion only where it helps explain behavior.
4. Group the explanation into scenes and short steps.
5. Preview the full story, then export or share it.

Continue with the [five-minute quick start](quick-start.md), or learn how to
[self-host DrawCMS](self-hosting.md).
