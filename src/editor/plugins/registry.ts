import type { ComponentType } from "react";
import type { EditorCommand } from "../commands/commands";
import { migrateDocument } from "../document/migrate";
import type { DrawCMSDocument } from "../document/schema";
import { isImportOutcome, type ImportIssue } from "../io/types";
import type { DocumentPersistenceAdapter } from "../persistence/types";
import { EDITOR_API_VERSION } from "./constants";
import { PluginRegistrationError } from "./errors";
import type {
  EditorPlugin,
  ExporterContribution,
  ImporterContribution,
  InspectorContribution,
  ToolbarContribution,
} from "./types";

export interface ImportResult {
  document: DrawCMSDocument;
  /** Non-blocking report of approximated or skipped content (empty when lossless). */
  issues: ImportIssue[];
}

export interface PluginHost {
  readonly plugins: readonly EditorPlugin[];
  /** Plugin-provided node renderers, keyed by React Flow node type. */
  readonly nodeTypes: Record<string, ComponentType>;
  /** Plugin-provided edge renderers, keyed by React Flow edge type. */
  readonly edgeTypes: Record<string, ComponentType>;
  toolbarFor(slot: "left" | "right"): ToolbarContribution[];
  visibleInspectors(selection: {
    nodeId: string | null;
    edgeId: string | null;
  }): InspectorContribution[];
  getCommand(type: string): ((payload: unknown) => EditorCommand) | undefined;
  getImporter(id: string): ImporterContribution | undefined;
  getExporter(id: string): ExporterContribution | undefined;
  listImporters(): ImporterContribution[];
  listExporters(): ExporterContribution[];
  /** Import text through a registered importer and migrate to a current document. */
  importDocument(importerId: string, input: string): ImportResult;
  /** Export a document through a registered exporter. */
  exportDocument(
    exporterId: string,
    document: DrawCMSDocument,
  ): { filename: string; mimeType: string; content: string | Blob };
  /** The single persistence provider, if any plugin supplies one. */
  readonly persistence: DocumentPersistenceAdapter | null;
}

/**
 * Build the host surface from a set of plugins. All collision and
 * compatibility rules fail here, at registration time:
 * - duplicate plugin ids are refused;
 * - plugins must target the host's EDITOR_API_VERSION exactly;
 * - contribution ids (commands, importers, exporters, toolbar, inspectors)
 *   must not collide with a plugin already registered;
 * - at most one plugin may provide persistence.
 */
export function createPluginHost(plugins: readonly EditorPlugin[] = []): PluginHost {
  const seenPluginIds = new Set<string>();
  const nodeTypes: Record<string, ComponentType> = {};
  const edgeTypes: Record<string, ComponentType> = {};
  const toolbar: ToolbarContribution[] = [];
  const inspectors: InspectorContribution[] = [];
  const commands = new Map<string, (payload: unknown) => EditorCommand>();
  const importers = new Map<string, ImporterContribution>();
  const exporters = new Map<string, ExporterContribution>();
  let persistence: DocumentPersistenceAdapter | null = null;
  const claimedContributions = new Set<string>();

  const claimContribution = (kind: string, id: string, pluginId: string) => {
    const marker = `${kind}:${id}`;
    if (claimedContributions.has(marker)) {
      throw new PluginRegistrationError(
        "DUPLICATE_CONTRIBUTION",
        `Contribution ${marker} is registered by more than one plugin.`,
        pluginId,
      );
    }
    claimedContributions.add(marker);
  };

  for (const plugin of plugins) {
    if (plugin.apiVersion !== EDITOR_API_VERSION) {
      throw new PluginRegistrationError(
        "API_VERSION_MISMATCH",
        `Plugin "${plugin.id}" targets editor API v${plugin.apiVersion}; this host speaks v${EDITOR_API_VERSION}.`,
        plugin.id,
      );
    }
    if (seenPluginIds.has(plugin.id)) {
      throw new PluginRegistrationError(
        "DUPLICATE_PLUGIN_ID",
        `Plugin id "${plugin.id}" is registered twice.`,
        plugin.id,
      );
    }
    seenPluginIds.add(plugin.id);

    for (const [type, component] of Object.entries(plugin.nodeTypes ?? {})) {
      claimContribution("nodeType", type, plugin.id);
      nodeTypes[type] = component;
    }
    for (const [type, component] of Object.entries(plugin.edgeTypes ?? {})) {
      claimContribution("edgeType", type, plugin.id);
      edgeTypes[type] = component;
    }
    for (const [type, factory] of Object.entries(plugin.commands ?? {})) {
      claimContribution("command", type, plugin.id);
      commands.set(type, factory);
    }
    for (const contribution of plugin.toolbar ?? []) {
      claimContribution(`toolbar:${contribution.slot}`, contribution.id, plugin.id);
      toolbar.push(contribution);
    }
    for (const contribution of plugin.inspectors ?? []) {
      claimContribution("inspector", contribution.id, plugin.id);
      inspectors.push(contribution);
    }
    for (const contribution of plugin.importers ?? []) {
      claimContribution("importer", contribution.id, plugin.id);
      importers.set(contribution.id, contribution);
    }
    for (const contribution of plugin.exporters ?? []) {
      claimContribution("exporter", contribution.id, plugin.id);
      exporters.set(contribution.id, contribution);
    }
    if (plugin.persistence) {
      if (persistence) {
        throw new PluginRegistrationError(
          "DUPLICATE_CONTRIBUTION",
          `Both "${plugin.id}" and another plugin provide persistence; a host accepts exactly one.`,
          plugin.id,
        );
      }
      persistence =
        typeof plugin.persistence === "function" ? plugin.persistence() : plugin.persistence;
    }
  }

  return {
    plugins: Object.freeze([...plugins]),
    nodeTypes,
    edgeTypes,
    toolbarFor: (slot) => toolbar.filter((contribution) => contribution.slot === slot),
    visibleInspectors: (selection) =>
      inspectors.filter((contribution) => !contribution.when || contribution.when(selection)),
    getCommand: (type) => commands.get(type),
    getImporter: (id) => importers.get(id),
    getExporter: (id) => exporters.get(id),
    listImporters: () => [...importers.values()],
    listExporters: () => [...exporters.values()],
    importDocument: (importerId, input) => {
      const importer = importers.get(importerId);
      if (!importer)
        throw new PluginRegistrationError(
          "CONTRIBUTION_NOT_FOUND",
          `No importer registered as "${importerId}".`,
        );
      const outcome = importer.parse(input);
      if (isImportOutcome(outcome)) {
        return { document: migrateDocument(outcome.document), issues: outcome.issues ?? [] };
      }
      return { document: migrateDocument(outcome), issues: [] };
    },
    exportDocument: (exporterId, document) => {
      const exporter = exporters.get(exporterId);
      if (!exporter)
        throw new PluginRegistrationError(
          "CONTRIBUTION_NOT_FOUND",
          `No exporter registered as "${exporterId}".`,
        );
      return exporter.run(document);
    },
    persistence,
  };
}
