---
title: "ADR 002: Iconify icon palette"
---

# 002 — Iconify icon palette

## Status

Accepted.

## Context

The element palette ships a fixed catalogue of shape types plus curated cloud
vendor icons (AWS/GCP/Azure/Infra). Users kept asking for arbitrary icons
(devices, tools, brands) without a plugin.

Iconify offers a public API (`https://api.iconify.design`) with ~300k icons
across 200+ open-source sets, plus a search endpoint designed for pickers.

## Decision

The editor gains an **Icons** group in the element palette backed by the live
Iconify API:

- **Search on demand** via `GET /search?query&limit`. No icon sets are bundled
  into the package, so no third-party icon artwork enters the OSS build or the
  proprietary cloud build. Only the API client code (written here, AGPL) ships.
- **All open-source sets are searchable**, including attribution-required
  (CC BY) sets. The picker surfaces each icon's set and license on hover, and
  the node stores the full icon name (`prefix:name`), keeping the attribution
  chain traceable in documents.
- **Documents are self-contained.** When an icon is picked, its sanitized SVG
  body and `viewBox` are fetched once and stored in the node (`iconBody`,
  `iconViewBox`). Rendering, export, and reloads never hit the network again.
- **Sanitization at the boundary.** Fetched SVGs are parsed and stripped of
  scripts, event handlers, inline styles, animations, and non-internal
  references before storage. Bodies are capped at 64 KB; names and viewBoxes
  are validated by the document schema.
- **Self-hosting escape hatch.** The API host is a single exported constant
  (`ICONIFY_API_HOST`) so hosts can point the picker at their own Iconify API
  deployment later.

## Consequences

- The icon picker needs network access; a recoverable error state covers
  offline sessions. Existing documents and exports remain unaffected.
- Icons render as full-frame, monochrome (`currentColor`) artwork. Defs/id
  collisions between two icons from the same set are a known minor risk;
  most popular sets ship id-free icons.
