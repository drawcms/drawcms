import { describe, expect, it } from "vitest";
import { createPluginHost } from "./registry";
import { EDITOR_API_VERSION } from "./constants";
import { PluginRegistrationError } from "./errors";
import { definePlugin } from "./types";
import { jsonToolsPlugin } from "./examples/json-tools";
import { createDocument } from "../document/serialize";
import { createMemoryAdapter } from "../persistence/memory";

const sampleDocument = createDocument({
  nodes: [
    {
      id: "a",
      position: { x: 1, y: 2 },
      data: { label: "A", type: "rect" },
      type: "customShape",
    },
  ],
  edges: [],
  meta: { name: "Fixture" },
});

describe("createPluginHost", () => {
  it("registers the example plugin's contributions through the public surface", () => {
    const host = createPluginHost([jsonToolsPlugin]);

    expect(host.listImporters().map((i) => i.id)).toEqual(["json"]);
    expect(host.listExporters().map((e) => e.id)).toEqual(["json"]);
    expect(host.visibleInspectors({ nodeId: null, edgeId: null })).toHaveLength(1);
    expect(host.visibleInspectors({ nodeId: null, edgeId: null })[0].id).toBe("json-summary");
    expect(host.persistence).toBeNull();
  });

  it("round-trips export -> import without editor internals", () => {
    const host = createPluginHost([jsonToolsPlugin]);

    const artifact = host.exportDocument("json", sampleDocument);
    expect(artifact.mimeType).toBe("application/json");
    expect(artifact.filename).toBe("fixture.drawcms.json");

    const { document: restored, issues } = host.importDocument("json", String(artifact.content));
    expect(issues).toEqual([]);
    expect(restored.nodes).toEqual(sampleDocument.nodes);
    expect(restored.meta.name).toBe("Fixture");
  });

  it("exposes a plugin's persistence adapter without the editor knowing the backend", () => {
    const persistencePlugin = definePlugin({
      id: "acme.persistence",
      apiVersion: EDITOR_API_VERSION,
      persistence: () => createMemoryAdapter(),
    });
    const host = createPluginHost([persistencePlugin]);
    expect(host.persistence?.id).toBe("memory");
  });

  it("merges custom node types from several plugins", () => {
    const markerA = () => null;
    const markerB = () => null;
    const a = definePlugin({
      id: "a",
      apiVersion: EDITOR_API_VERSION,
      nodeTypes: { "a-shape": markerA },
    });
    const b = definePlugin({
      id: "b",
      apiVersion: EDITOR_API_VERSION,
      nodeTypes: { "b-shape": markerB },
    });
    const host = createPluginHost([a, b]);
    expect(host.nodeTypes["a-shape"]).toBe(markerA);
    expect(host.nodeTypes["b-shape"]).toBe(markerB);
  });

  it("refuses duplicate plugin ids", () => {
    expect(() => createPluginHost([jsonToolsPlugin, jsonToolsPlugin])).toThrowError(
      PluginRegistrationError,
    );
    expect(() => createPluginHost([jsonToolsPlugin, jsonToolsPlugin])).toThrowError(
      /registered twice/,
    );
  });

  it("refuses plugins built for another API version", () => {
    const future = definePlugin({ ...jsonToolsPlugin, id: "future", apiVersion: 999 });
    expect(() => createPluginHost([future])).toThrowError(/targets editor API v999/);
  });

  it("refuses colliding contribution ids across plugins", () => {
    const thief = definePlugin({
      id: "thief",
      apiVersion: EDITOR_API_VERSION,
      exporters: [
        {
          id: "json",
          label: "Echo",
          run: () => ({ filename: "x", mimeType: "text/plain", content: "" }),
        },
      ],
    });
    expect(() => createPluginHost([jsonToolsPlugin, thief])).toThrowError(/exporter:json/);
  });

  it("refuses a second persistence provider", () => {
    const first = definePlugin({
      id: "p1",
      apiVersion: EDITOR_API_VERSION,
      persistence: createMemoryAdapter(),
    });
    const second = definePlugin({
      id: "p2",
      apiVersion: EDITOR_API_VERSION,
      persistence: () => createMemoryAdapter(),
    });
    expect(() => createPluginHost([first, second])).toThrowError(/exactly one/);
  });

  it("reports unknown importers and exporters distinctly", () => {
    const host = createPluginHost([]);
    expect(() => host.importDocument("nope", "{}")).toThrowError(
      /No importer registered as "nope"/,
    );
    expect(() => host.exportDocument("nope", sampleDocument)).toThrowError(
      /No exporter registered as "nope"/,
    );
    try {
      host.importDocument("nope", "{}");
      expect.unreachable();
    } catch (error) {
      expect((error as PluginRegistrationError).code).toBe("CONTRIBUTION_NOT_FOUND");
    }
  });

  it("gates inspectors through their `when` predicate", () => {
    const gated = definePlugin({
      id: "gated",
      apiVersion: EDITOR_API_VERSION,
      inspectors: [
        {
          id: "nodes-only",
          component: () => null,
          when: (selection) => selection.nodeId !== null,
        },
      ],
    });
    const host = createPluginHost([gated]);
    expect(host.visibleInspectors({ nodeId: null, edgeId: "e" })).toEqual([]);
    expect(host.visibleInspectors({ nodeId: "n", edgeId: null })).toHaveLength(1);
  });
});
