---
title: "Browser support and known limitations"
---

## Supported browsers

| Browser          | Editing, motion, GIF | Video export (MP4)                                     |
| ---------------- | -------------------- | ------------------------------------------------------ |
| Chrome/Edge 120+ | Full                 | Full when an H.264 WebCodecs encoder is available      |
| Safari 17+       | Full                 | Unavailable when an H.264 WebCodecs encoder is missing |
| Firefox 120+     | Full                 | Unavailable when an H.264 WebCodecs encoder is missing |

The GIF and PNG export paths work in the self-hosted editor. SVG and MP4 are
not enabled by that host; `NEXT_PUBLIC_CLOUD_URL` only configures the upgrade
destination. DrawCMS Cloud enables them according to the account's plan.
Cloud MP4 is still encoded by the browser with WebCodecs and then uploaded to
managed storage, so the Export menu disables it when an H.264 encoder is
unavailable.

WebMCP agent authoring is a separate progressive enhancement. It currently
requires Chrome's WebMCP origin trial (Chrome 149+) or the local
`chrome://flags/#enable-webmcp-testing` flag. Browsers without
`document.modelContext` retain the full human-operated editor with no polyfill
or compatibility penalty. See [WebMCP agent authoring](webmcp.md).

## Known limitations

- **Rendering canvas memory** — very large documents (500+ nodes) make
  client-side animation exports memory-heavy; the Export menu warns. Cloud
  adds quota checks and managed storage, but encoding still happens in the
  browser.
- **MP4 muxing** — H.264 via `mp4-muxer` depends on browser encoder support;
  the editor falls back to Baseline profile or readable errors.
- **Mobile** — the editor is a desktop-class tool; small screens can view
  shared/presentation links but authoring on a phone layout is not supported.
- **E2E automation coverage** — quality gates are unit/model-level tests plus
  the release checklist; browser-level E2E is manual for this release.
- **Reduced motion** — honored for all editor chrome and onboarding autoplay;
  explicit preset playback stays user-triggered per WCAG 2.3.3.
- **WebMCP** — experimental and subject to API changes; it requires a secure,
  origin-isolated page and its `tools` Permissions Policy defaults to `self`.
