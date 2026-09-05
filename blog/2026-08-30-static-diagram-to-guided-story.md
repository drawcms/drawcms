---
title: "Turn a static architecture diagram into a guided story"
date: 2026-09-05
description: "A practical DrawCMS workflow for adding focus, motion, and narrative steps to an existing technical diagram."
excerpt: "Use a simple three-pass workflow to turn an existing architecture diagram into a presentation people can follow."
tags:
  - tutorials
  - architecture
  - motion
authors:
  - name: "Dimas Nashiruddin Al Faruq"
    title: "@dimasna"
    picture: "https://github.com/dimasna.png?size=96"
    url: "https://github.com/dimasna"
cover:
  alt: "A DrawCMS story path connecting the Orient, Focus, and Explain stages of a technical diagram"
  image: ./2026-08-30-static-diagram-to-guided-story-cover.svg
featured: true
---

A large architecture diagram can be accurate and still be difficult to explain. The viewer sees
every service, boundary, and connector at once, but not the order in which the system behaves.

DrawCMS adds that missing sequence without forcing you to redraw the system. This tutorial uses
three passes: establish the diagram, add meaningful motion, then write the story.

## Follow the finished story

The embedded player below is read-only. Move through its steps to see how a single diagram can
reveal the request path without showing every detail at once.

<figure class="dm-diagram-embed">
  <div class="dm-diagram-embed-frame">
    <iframe
      src="https://your-drawcms-host.example/embed/sample"
      title="Interactive architecture request flow"
      loading="lazy"
      sandbox="allow-scripts allow-same-origin"
      allow="fullscreen"
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
  </div>
  <figcaption>
    A three-step request story embedded directly in this Markdown article.
    <a href="https://your-drawcms-host.example/embed/sample" target="_blank" rel="noreferrer">Open the diagram in a new tab<span class="sr-only"> (opens in a new tab)</span></a>.
  </figcaption>
</figure>

## Pass 1: make the static diagram readable

Start from a template, an empty canvas, or an imported draw.io or Excalidraw file. Before adding
animation, make sure the still image works:

1. Give nodes short, specific labels.
2. Arrange the main flow in one consistent direction.
3. Use containers or boundaries to show ownership and trust zones.
4. Route connectors so crossings are easy to distinguish.
5. Remove details that do not support this explanation.

If an import cannot reproduce an element exactly, DrawCMS keeps working and reports what it skipped.
Review the [importer support notes](../docs/importer-limitations.md) before polishing a large import.

## Pass 2: use motion as meaning

Select a node or connector and open its **Motion** tab. Pick a preset that reinforces what the item
does rather than animating every object for decoration.

A useful starting rule is:

- show flow on the connector currently carrying a request or event;
- emphasize the service making the important decision;
- introduce a new component when the story first needs it;
- leave background context still.

Motion belongs to the canvas item. You can reorder the narrative later without recreating the
animation settings.

## Pass 3: write the viewer's path

Now turn the diagram into a story:

1. Select the items involved in the first idea.
2. Right-click and choose **Add as step**.
3. Write a short title that states what happens.
4. Add one or two sentences explaining why it matters.
5. Repeat, then arrange the steps in the **Steps** panel.

Use scenes to separate larger chapters. For a migration diagram, for example, you might create
“Before,” “Cutover,” and “After” scenes. Each step should advance one idea.

When a step targets two connected nodes, preview also includes their direct connector. This makes a
request path easier to follow without manually selecting every edge.

## Preview like a first-time viewer

Open **Preview** and watch the complete presentation without editing as you go. Look for three
things:

- **Orientation:** can a viewer tell where to look at the start of each step?
- **Pacing:** is there enough time to read the text and understand the highlighted items?
- **Continuity:** does each step follow naturally from the previous one?

The preview is the same read-only player used for shared pages and embeds, so it is the best place
to catch presentation problems.

## Save a portable source

Use **File → Save** to download the `.drawcms` document. Keep that file as the editable source, then
choose a static or animated export for the audience you need to reach.

For a tour of the editor controls, continue with the
[five-minute quick start](../docs/quick-start.md). To understand how canvas items, motion, and story
steps fit together, read [core concepts](../docs/core-concepts.md).
