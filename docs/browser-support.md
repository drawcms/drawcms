---
title: "Browser support and known limitations"
---

## Supported browsers

| Browser          | Editing, motion, GIF | Video export (WebM/MP4)                                         |
| ---------------- | -------------------- | --------------------------------------------------------------- |
| Chrome/Edge 120+ | Full                 | Full (WebCodecs)                                                |
| Safari 17+       | Full                 | GIF only — WebCodecs unavailable; use GIF or the Cloud renderer |
| Firefox 120+     | Full                 | GIF only — WebCodecs unavailable; use GIF or the Cloud renderer |

The GIF and PNG export paths work everywhere in the self-hosted editor. SVG
and MP4 export are DrawCMS Cloud features; where they are enabled, video
export still degrades at runtime — the Export menu disables MP4 where
WebCodecs is missing.

WebMCP agent authoring is a separate progressive enhancement. It currently
requires Chrome's WebMCP origin trial (Chrome 149+) or the local
`chrome://flags/#enable-webmcp-testing` flag. Browsers without
`document.modelContext` retain the full human-operated editor with no polyfill
or compatibility penalty. See [WebMCP agent authoring](webmcp.md).

## Known limitations

- **Rendering canvas memory** — very large documents (500+ nodes) make
  client-side animation exports memory-heavy; the Export menu warns. Managed
  cloud renders avoid this.
- **MP4 muxing** — H.264 via `mp4-muxer` depends on browser encoder support;
  the editor falls back to Baseline profile or readable errors.
- **Mobile** — the editor is a desktop-class tool; small screens can view
  shared/presentation links but authoring on a phone layout is not supported.
- **E2E automation coverage** — quality gates are unit/model-level plus pgTAP
  (cloud); browser-level E2E is manual for this release (see the cloud
  release plan).
- **Reduced motion** — honored for all editor chrome and onboarding autoplay;
  explicit preset playback stays user-triggered per WCAG 2.3.3.
- **WebMCP** — experimental and subject to API changes; it requires a secure,
  origin-isolated page and its `tools` Permissions Policy defaults to `self`.
