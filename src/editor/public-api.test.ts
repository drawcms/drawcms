import { describe, expect, it } from "vitest";

/**
 * DM-013 acceptance: host features (documents, commands, plugins, persistence)
 * are reachable through the package's public exports only — no editor-internal
 * module imports required. If an export regresses, this file fails to compile.
 */
describe("public API surface", () => {
  it("exposes a runtime-agnostic document entrypoint", async () => {
    const documentApi = await import("./document");

    expect(documentApi.DOCUMENT_SCHEMA_VERSION).toBe(5);
    expect(typeof documentApi.migrateDocument).toBe("function");
    expect(typeof documentApi.parseDocument).toBe("function");
    expect(typeof documentApi.createDocument).toBe("function");
    expect(typeof documentApi.deterministicStringify).toBe("function");
  });

  it("exposes document, command, plugin, and persistence building blocks", async () => {
    const api = await import("./index");

    // DM-011 documents
    expect(api.DOCUMENT_SCHEMA_VERSION).toBe(5);
    expect(typeof api.migrateDocument).toBe("function");
    expect(typeof api.parseDocument).toBe("function");
    expect(typeof api.createDocument).toBe("function");
    expect(typeof api.deterministicStringify).toBe("function");

    // DM-012 commands
    expect(typeof api.addNodeCommand).toBe("function");
    expect(typeof api.deleteSelectionCommand).toBe("function");
    expect(typeof api.pasteCommand).toBe("function");
    expect(typeof api.reparentOnDragStop).toBe("function");
    expect(typeof api.CommandHistory).toBe("function");

    // DM-013 plugin/host API
    expect(api.EDITOR_API_VERSION).toBe(2);
    expect(typeof api.createPluginHost).toBe("function");
    expect(typeof api.definePlugin).toBe("function");
    expect(api.jsonToolsPlugin.id).toBe("drawcms.example.json-tools");

    // DM-014 persistence
    expect(typeof api.createMemoryAdapter).toBe("function");
    expect(typeof api.createLocalStorageAdapter).toBe("function");
    expect(typeof api.createPersistenceController).toBe("function");
    expect(typeof api.useDocumentPersistence).toBe("function");

    // DM-019 motion model: story-only since DM-034 (see
    // content/docs/decisions/003-single-motion-model.md); element presets are
    // authored directly on node/edge data, not through this API.
    expect(typeof api.createEmptyMotion).toBe("function");
    expect(typeof api.reconcileMotionTargets).toBe("function");
    expect(typeof api.normalizeMotion).toBe("function");

    // v3 narrative steps are independent from animation timing.
    expect(typeof api.createEmptyStory).toBe("function");
    expect(typeof api.addStoryStep).toBe("function");
    expect(typeof api.moveStoryStep).toBe("function");
    expect(typeof api.flattenStoryPlayback).toBe("function");
    expect(typeof api.findStoryPlaybackEntryIndex).toBe("function");

    // DM-032 accessibility helpers for hosts
    expect(typeof api.useReducedMotion).toBe("function");
    expect(typeof api.prefersReducedMotion).toBe("function");
    expect(typeof api.useMenuBehavior).toBe("function");

    // Progressive browser-native agent authoring.
    expect(typeof api.createDrawCMSWebMCPTools).toBe("function");
    expect(typeof api.registerDrawCMSWebMCPTools).toBe("function");
    expect(typeof api.useDrawCMSWebMCP).toBe("function");
    expect(api.VISUAL_ELEMENT_REGISTRY.length).toBeGreaterThan(0);
    expect(api.VISUAL_MOTION_REGISTRY.length).toBeGreaterThan(0);
    expect(typeof api.recommendVisualGrammar).toBe("function");
    expect(typeof api.validateDiagramVisualGrammar).toBe("function");
  });

  it("keeps the editor core free of backend SDKs (cloud boundary)", async () => {
    // A host feature built only from public exports: persistence via adapter.
    const { createMemoryAdapter, createPluginHost, definePlugin, EDITOR_API_VERSION } =
      await import("./index");
    const host = createPluginHost([
      definePlugin({
        id: "test.host",
        apiVersion: EDITOR_API_VERSION,
        persistence: createMemoryAdapter(),
      }),
    ]);
    expect(host.persistence?.id).toBe("memory");
  });
});
