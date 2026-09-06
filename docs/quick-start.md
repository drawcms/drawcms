---
title: "Quick start — five minutes to an animated diagram"
---

## Try it without installing anything

Run the app locally with `npm run dev` (see [Run it locally](#run-it-locally))
or self-host it — see [self-hosting](self-hosting.md). No account needed.

1. Open the app. First launch offers four starting points — pick
   **See motion in action**.
2. The guided architecture sample loads with a narrated story. Use **Steps**
   beside **Fit all elements** to review scenes and arrange their order.
3. Select one or more shapes or connectors, right-click the selection, then
   choose **Add as step**. Give the step a title and description.
   The collapsed element rail includes dedicated **Sequence**,
   **Architecture**, **Boundaries**, **Lifecycle**, **Data Flow**, and
   **Annotations** pickers; click a group tool to choose its active element or
   drag that active element onto the canvas.
   Sequence lifelines inserted by click form a horizontal row. Synchronous,
   asynchronous, and return messages automatically span the first two
   lifelines and stack in time order; activations and end markers align to the
   selected lifeline. Select a message to drag either endpoint freely, bend its
   route, or move the complete message between ordered lifeline rows.
4. Open **Steps** to move steps earlier or later, edit their copy, organize
   them into scenes, or open **Preview**. The preview is the same read-only
   player used by public share pages and embedded widgets. It highlights every
   referenced node, adds direct connectors between them when the step names no
   connector of its own, and animates an orange flow packet while playing. The
   panel also offers **Add selected items** for touch and keyboard users.
5. Configure animation separately in the selected item's **Motion** tab. Story
   steps never change motion presets, speed, or looping.
6. `File → Save` downloads a `.drawcms` document; `Export` offers PNG and GIF
   locally. SVG and MP4 are shown locked with a link to DrawCMS Cloud, which
   also adds sharing (view-only links and embeds) — the self-hosted editor
   has no built-in sharing.

Shared and embedded presentations keep the common read-only player at the
bottom. Viewers can pan and zoom, but cannot select, edit, connect, resize, or
drag diagram items.

## Try the embedded player

Public viewer links and embeds render the same read-only presentation surface
you see in **Preview**. Embedding is a DrawCMS Cloud feature: publish a
diagram, create a viewer link, and embed it with a real iframe in Markdown
systems that allow HTML, including the DrawCMS docs and blog:

````markdown
```html
<iframe
  src="https://your-drawcms-host.example/embed/your-viewer-token"
  title="Interactive system diagram"
  width="960"
  height="600"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
  allow="fullscreen"
  referrerpolicy="strict-origin-when-cross-origin"
  style="width: 100%; aspect-ratio: 16 / 10; border: 0;"
></iframe>
```
````

GitHub README files do not render iframes. Export the diagram as a GIF, commit
the GIF beside the README, and link it to the public share page instead:

```markdown
[![Open interactive system diagram in DrawCMS](./system-diagram.gif)](https://your-drawcms-host.example/share/your-viewer-token)
```

````markdown
```html
<iframe
  src="https://your-drawcms-host.example/embed/your-viewer-token"
  title="Interactive system diagram"
  width="960"
  height="600"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
  allow="fullscreen"
  referrerpolicy="strict-origin-when-cross-origin"
  style="width: 100%; aspect-ratio: 16 / 10; border: 0;"
></iframe>
```
````

GitHub README files do not render iframes. Export the diagram as a GIF, commit
the GIF beside the README, and link it to the public share page instead:

```markdown
[![Open interactive system diagram in DrawCMS](./system-diagram.gif)](https://your-drawcms-host.example/share/your-viewer-token)
```

The guide can be reopened anytime with `File → Show guide`.

## Run it locally

```bash
git clone https://github.com/drawcms/drawcms.git
cd drawcms
npm install
npm run dev
```

Open <http://localhost:3002> — the landing links into the editor at `/editor`.
Documents autosave to the browser; nothing leaves the machine.

## Embed the editor in your app

The editor engine is part of this repository (`src/editor/`, AGPL-3.0). The
simplest integration is to self-host the app and link or iframe `/editor` —
see [self-hosting](self-hosting.md). For agent-driven authoring inside your
own page, enable [WebMCP](webmcp.md) on the hosted editor.

> The legacy npm package `@drawcms/editor@0.12.4` is frozen and no longer
> receives updates; the current editor is developed in this repository.

Next: [plugin API](plugin-api.md) · [self-hosting](self-hosting.md) ·
[document format](document-format.md) · [importer limitations](importer-limitations.md)
