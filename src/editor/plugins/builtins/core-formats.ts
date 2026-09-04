import { EDITOR_API_VERSION } from "../constants";
import { definePlugin, type EditorPlugin } from "../types";
import { importDrawio } from "../../io/drawio/parse";
import { importExcalidraw } from "../../io/excalidraw/parse";
import { toDrawcmsFile } from "../../io/files";

/**
 * Built-in formats every host gets by default: `.drawcms` open/save plus
 * the draw.io and Excalidraw importers. User plugins register after this and
 * refuse colliding ids.
 */
export const coreFormatsPlugin: EditorPlugin = definePlugin({
  id: "drawcms.core.formats",
  name: "DrawCMS formats",
  apiVersion: EDITOR_API_VERSION,
  importers: [
    {
      id: "drawcms-json",
      label: "DrawCMS document (.drawcms)",
      fileExtensions: [".drawcms", ".json"],
      parse: (input: string) => JSON.parse(input) as unknown,
    },
    {
      id: "drawio",
      label: "draw.io diagram (.drawio, .xml)",
      fileExtensions: [".drawio", ".xml"],
      parse: importDrawio,
    },
    {
      id: "excalidraw",
      label: "Excalidraw scene (.excalidraw)",
      fileExtensions: [".excalidraw", ".excalidrawlib"],
      parse: importExcalidraw,
    },
  ],
  exporters: [
    {
      id: "drawcms-file",
      label: "DrawCMS document (.drawcms)",
      run: (document) => ({ ...toDrawcmsFile(document), mimeType: "application/json" }),
    },
  ],
});
