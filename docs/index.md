---
title: "Documentation"
description: "Documentation and guides for DrawCMS — the open-source editor for animated technical diagrams."
template: splash
hero:
  title: "Make technical systems easier to follow."
  tagline: "DrawCMS turns the diagrams you already have into clear, motion-led explanations. Start with the editor, then go deeper into formats, plugins, and self-hosting."
  actions:
    - text: "Start the quick guide"
      link: "/docs/quick-start"
      icon: "right-arrow"
      variant: "primary"
    - text: "Understand the model"
      link: "/docs/core-concepts"
      variant: "secondary"
  image:
    html: '<div class="dm-docs-hero-diagram" aria-hidden="true"><span>One visual workflow</span><div class="dm-docs-flow"><b>Import</b><i>→</i><b>Animate</b><i>→</i><b>Explain</b></div><p>Bring a diagram in, direct meaningful change, and publish a story people can follow.</p></div>'
---

## Start here

- [Quick start](quick-start.md) — five minutes to an animated diagram
- [Core concepts](core-concepts.md) — canvas items, motion, stories, and documents
- [Self-hosting](self-hosting.md) — run the DrawCMS web app on your own infrastructure
- [Blog](https://drawcms.com/blog) — release notes, tutorials, and project news

## Build and extend

- [Plugin & host API](plugin-api.md) — extend the editor through its versioned contract
- [WebMCP agent authoring](webmcp.md) — let browser agents build animated diagrams
- [Design system](design-system.md) — theme a host with stable CSS tokens
- [Document format](document-format.md) — understand the portable `.drawcms` schema
- [Importer support](importer-limitations.md) — plan around draw.io and Excalidraw fidelity

## Ship with confidence

- [Upgrading](upgrading.md) — move between releases without losing documents
- [Browser support](browser-support.md) — choose compatible editing and export targets
- [Accessibility](accessibility.md) — review keyboard, focus, and reduced-motion behavior
- [Performance budgets](performance.md) — see the editor's enforced responsiveness targets

## About

DrawCMS is open-source software licensed under [GNU AGPL v3.0 only](https://github.com/drawcms/drawcms/blob/main/LICENSE). Read [ADR 001](decisions/001-licensing-and-repository-boundary.md) for the OSS and Cloud boundary, or visit the [source repository](https://github.com/drawcms/drawcms) to contribute.
