import type { ComponentType } from "react";
import type { EditorCommand } from "../commands/commands";
import type { DrawCMSDocument } from "../document/schema";
import type { DocumentPersistenceAdapter } from "../persistence/types";

/** What the editor tells plugin UI about the current selection. */
export interface SelectionSummary {
  nodeId: string | null;
  edgeId: string | null;
}

/** Extra UI contributed to the editor chrome. */
export interface ToolbarContribution {
  id: string;
  /** `left` renders beside the element palette, `right` beside the inspector. */
  slot: "left" | "right";
  component: ComponentType;
}

/** A panel that reacts to the current selection. */
export interface InspectorContribution {
  id: string;
  component: ComponentType<{ selection: SelectionSummary }>;
  /** Optional gate; without it the inspector always renders. */
  when?: (selection: SelectionSummary) => boolean;
}

/** Turn external text into something `migrateDocument` understands. */
export interface ImporterContribution {
  id: string;
  label: string;
  fileExtensions: string[];
  parse(input: string): unknown;
}

/** Turn a document into a downloadable artifact. */
export interface ExporterContribution {
  id: string;
  label: string;
  run(document: DrawCMSDocument): { filename: string; mimeType: string; content: string | Blob };
}

/**
 * A DrawCMS plugin. All contribution kinds are optional; a plugin that
 * only ships persistence (like a cloud sync feature) never touches editor
 * internals — it is handed to the host and consumed through this surface.
 */
export interface EditorPlugin {
  /** Unique stable identifier, e.g. "acme.uml-extras". Registration is refused on collisions. */
  id: string;
  name?: string;
  /** Must equal the host's EDITOR_API_VERSION. */
  apiVersion: number;
  /** Custom React Flow node renderers keyed by node type. */
  nodeTypes?: Record<string, ComponentType>;
  /** Custom React Flow edge renderers keyed by edge type. */
  edgeTypes?: Record<string, ComponentType>;
  /** Named command factories addressing `apply`-compatible commands. */
  commands?: Record<string, (payload: unknown) => EditorCommand>;
  toolbar?: ToolbarContribution[];
  inspectors?: InspectorContribution[];
  importers?: ImporterContribution[];
  exporters?: ExporterContribution[];
  /** At most one plugin may provide persistence for a host. */
  persistence?: DocumentPersistenceAdapter | (() => DocumentPersistenceAdapter);
}

/** Identity helper that keeps literal types for plugin authors. */
export function definePlugin<Plugin extends EditorPlugin>(plugin: Plugin): Plugin {
  return plugin;
}
