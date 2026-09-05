---
title: "Plugin & host API"
---

The editor is extended through a versioned plugin contract
(`EDITOR_API_VERSION`, currently `2`; see [public-api-versioning.md](public-api-versioning.md)).
Hosts never import editor internals — everything comes from the editor's
public exports (`src/editor/index.ts`).

## What a plugin can contribute

| Slot        | Contribution type | Purpose                                                     |
| ----------- | ----------------- | ----------------------------------------------------------- |
| Commands    | `commands`        | Custom undoable mutations on the command stack              |
| Persistence | `persistence`     | Save/load targets (files, HTTP, OPFS…)                      |
| Importers   | `importers`       | Parse foreign formats into documents (menu: File → Import)  |
| Exporters   | `exporters`       | Serialize documents to artifacts (menu: Export → Documents) |
| Toolbar     | `toolbar`         | Buttons in the left/right floating rails                    |
| Inspectors  | `inspectors`      | Panels for the current selection                            |
| Node types  | `nodeTypes`       | Custom React Flow node renderers                            |
| Edge types  | `edgeTypes`       | Custom edge renderers                                       |

## Minimal example

The editor ships `jsonToolsPlugin` —
[`src/editor/plugins/examples/json-tools.ts`](https://github.com/drawcms/drawcms/blob/main/src/editor/plugins/examples/json-tools.ts) —
an importer/exporter pair covered by integration tests. The shape of a plugin:

```ts
// Hosts importing from inside this repository use the editor's public entry.
import { definePlugin, EDITOR_API_VERSION } from "@/editor";

export const myPlugin = definePlugin({
  id: "acme.drawcms.my-plugin", // unique; registration rejects collisions
  apiVersion: EDITOR_API_VERSION, // mismatch fails loudly at registration
  exporters: [
    {
      id: "acme-json",
      label: "Export as Acme JSON",
      run: (document) => ({
        filename: `${document.meta.name}.acme.json`,
        mimeType: "application/json",
        content: JSON.stringify(document, null, 2),
      }),
    },
  ],
});
```

Register at render:

```tsx
<DrawCMSEditor plugins={[myPlugin]} />
```

## Persistence adapters

Implement `DocumentPersistenceAdapter` and drive it with
`createPersistenceController` (or the `useDocumentPersistence` React helper):

```ts
import { createPersistenceController, type DocumentPersistenceAdapter } from "@/editor";

const adapter: DocumentPersistenceAdapter = {
  id: "my-backend",
  load: () => fetchDocumentFromMyApi(), // → DrawCMSDocument | null
  save: async (document) => {
    await putDocumentToMyApi(document);
    return { revision: String(document.schemaVersion), savedAt: new Date().toISOString() };
  },
};
```

Saving an unchanged document must not create new revisions; throw
`PersistenceError(code, message, recoverable)` to drive the host's retry and
conflict UI correctly.

Call `schedule(document)` for debounced autosave and `await flush()` for a
manual save or before navigation. `flush()` serializes concurrent work and
does not resolve until edits queued during an in-flight save have also been
persisted. Hosts can render `idle`, `dirty`, `saving`, `saved`, and `error`
from the controller status.

`createMemoryAdapter` and `createLocalStorageAdapter` are ready-made
references (tests and the OSS app respectively).

## Rules that keep the contract stable

- Plugins see only public exports (`src/editor/index.ts`); importing editor
  internals is unsupported and will break without notice.
- Contribution id collisions across plugins fail registration with
  `PluginRegistrationError`.
- The host (not the plugin) owns the document lifecycle: open, migrate,
  save scheduling.
