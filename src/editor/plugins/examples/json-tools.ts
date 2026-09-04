import { createElement } from "react";
import { deterministicStringify } from "../../document/serialize";
import { EDITOR_API_VERSION } from "../constants";
import { definePlugin, type SelectionSummary } from "../types";

function JsonToolsInspector({ selection }: { selection: SelectionSummary }) {
  const target = selection.nodeId ?? selection.edgeId;
  return createElement(
    "div",
    {
      style: {
        padding: "8px 12px",
        fontSize: 12,
        background: "rgba(255,255,255,0.85)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.6)",
      },
    },
    target ? `JSON tools: ${target} selected` : "JSON tools: nothing selected",
  );
}

/**
 * Reference plugin: contributes one importer, one exporter, and one
 * inspector without touching any editor-internal module. Fixtures only use
 * the package's public API surface.
 */
export const jsonToolsPlugin = definePlugin({
  id: "drawcms.example.json-tools",
  name: "JSON tools (example)",
  apiVersion: EDITOR_API_VERSION,
  importers: [
    {
      id: "json",
      label: "Import DrawCMS JSON",
      fileExtensions: [".json"],
      parse: (input: string) => JSON.parse(input) as unknown,
    },
  ],
  exporters: [
    {
      id: "json",
      label: "Export JSON",
      run: (document) => ({
        filename: `${document.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "diagram"}.drawcms.json`,
        mimeType: "application/json",
        content: deterministicStringify(document),
      }),
    },
  ],
  inspectors: [{ id: "json-summary", component: JsonToolsInspector }],
});
