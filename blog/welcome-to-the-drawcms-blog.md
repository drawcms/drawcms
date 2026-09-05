---
title: "Welcome to the DrawCMS blog"
date: 2026-09-05
description: "The DrawCMS docs and blog are now live at drawcms.com/docs and drawcms.com/blog, with all content maintained as plain Markdown in the open-source repository."
excerpt: "Docs and blog are now live at drawcms.com/docs and drawcms.com/blog — plain Markdown, open source, and open to contributions."
tags:
  - announcements
  - open-source
authors:
  - name: "Dimas Nashiruddin Al Faruq"
    title: "@dimasna"
    picture: "https://github.com/dimasna.png?size=96"
    url: "https://github.com/dimasna"
cover:
  alt: "DrawCMS documents beside the words Plain Markdown, open to read, open to improve"
  image: ./welcome-to-the-drawcms-blog-cover.svg
featured: true
---

DrawCMS now has a proper documentation home at [docs.drawcms.com](https://docs.drawcms.com/), and this is its first blog post.

## What is DrawCMS?

DrawCMS is an open-source editor for **animated technical diagrams**. You import an existing diagram — draw.io, Excalidraw, or the native `.drawcms` format — and then explain how it changes over time: architecture shifts, sequence steps, data flows. The result exports to PNG, SVG, PDF, animated GIF, or WebM/MP4, or embeds anywhere with a shareable player.

Everything runs local-first in the browser. No account, no server, no tracking.

## Where the content lives

Both the documentation and this blog are plain Markdown files in the [open-source repository](https://github.com/drawcms/drawcms):

- `docs/` — the documentation site (served at [drawcms.com/docs](https://drawcms.com/docs))
- `blog/` — these posts (served at [drawcms.com/blog](https://drawcms.com/blog))

The docs site is built with [Astro Starlight](https://starlight.astro.build/) and [Starlight Blog](https://github.com/HiDeoo/starlight-blog). Because the content is just Markdown in a public repository, anyone can fix a typo, improve a guide, or propose a tutorial with a pull request.

## What to expect here

Posts on this blog will cover:

- **Release notes** for the editor package and the self-hosted web app
- **Tutorials** — from importing your first diagram to recording a full motion sequence
- **Engineering notes** on the plugin API, document format, and persistence adapters
- **Project news** for the cloud service

## Get started

If you are new here, the best place to start is the [five-minute quick start](../docs/quick-start.md). Then join the conversation in the [GitHub discussions](https://github.com/drawcms/drawcms/discussions).

Happy diagramming.
