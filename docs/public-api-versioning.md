---
title: "Public API and plugin versioning policy"
---

The `@drawcms/editor` package has two version lines:

1. **Package version** (semver in `packages/editor/package.json`) — normal
   release hygiene for the npm artifact.
2. **Editor API version** (`EDITOR_API_VERSION`, currently `2`) — the contract
   plugins are written against. This changes rarely and deliberately.

## The plugin contract

A plugin declares `apiVersion`. `createPluginHost` refuses a plugin whose
`apiVersion` differs from the host's `EDITOR_API_VERSION` — loudly, at
registration (`PluginRegistrationError`, code `API_VERSION_MISMATCH`). It also
refuses:

- duplicate plugin ids (`DUPLICATE_PLUGIN_ID`),
- colliding contribution ids per kind — nodeTypes, edgeTypes, commands,
  toolbar slots, inspectors, importers, exporters (`DUPLICATE_CONTRIBUTION`),
- more than one persistence provider per host (`DUPLICATE_CONTRIBUTION`).

Unknown contribution lookups fail with `CONTRIBUTION_NOT_FOUND`.

## Rules for changing the public API

- **Additive changes** (new exports, new optional plugin fields, new optional
  document fields): allowed within the current API version; bump the package
  minor version. Unknown document fields are preserved by design
  (see docs/document-format.md).
- **Breaking changes** (renamed/removed exports, changed contribution shapes,
  stricter document fields, new required plugin fields): require a design
  issue, increment `EDITOR_API_VERSION`, give plugin authors a migration note
  in the release description, and keep the previous major committed for at
  least one minor release where technically possible.
- Plugins must consume only the package's public exports
  (`@drawcms/editor`), never deep paths such as
  `@drawcms/editor/dist/...` or workspace source files.

## Host rules

Hosts (the OSS app, the cloud app, or any embedding product) pass capabilities
_to_ the editor — plugins, a persistence adapter, initial documents. The
editor core must stay free of host-backend imports (Supabase, fetch clients);
features are built through the adapter and contribution surfaces.

## Migration notes

### 1 → 2

The unplayed scene/track/step motion timeline was removed from the runtime
model (see [ADR 003](decisions/003-single-motion-model.md)); `motion` now
carries only `story`. This did not change the plugin contribution shape
(`EditorPlugin` fields are unaffected), but it is a breaking change to the
document's `motion` section and to WebMCP's motion-preview tool, so
`EDITOR_API_VERSION` moved from `1` to `2` alongside `DOCUMENT_SCHEMA_VERSION`
moving from `4` to `5`. A plugin built against version `1` still registers
correctly — nothing about the plugin contribution slots changed — but any
plugin or host code reading `document.motion.scenes`/`tracks` directly (rather
than through the public API) needs to drop that read, since the field no
longer exists on `DrawCMSDocument`. `migrateDocument` handles this
automatically for documents opened through the normal load path.
