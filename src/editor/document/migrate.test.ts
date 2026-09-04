import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentMigrationError, detectDocumentVersion, migrateDocument } from "./migrate";
import { deterministicStringify } from "./serialize";
import { DOCUMENT_SCHEMA_VERSION, safeParseDocument } from "./schema";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixturePath = join(FIXTURES, "legacy-v0.json");
const legacyFixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

describe("detectDocumentVersion", () => {
  it("recognizes the legacy unversioned {nodes, edges} shape", () => {
    expect(detectDocumentVersion(legacyFixture)).toBe(0);
  });

  it("recognizes a current document", () => {
    expect(detectDocumentVersion(migrateDocument(legacyFixture))).toBe(DOCUMENT_SCHEMA_VERSION);
  });

  it("rejects non-document values and future versions", () => {
    expect(detectDocumentVersion(null)).toBe("unknown");
    expect(detectDocumentVersion([1, 2])).toBe("unknown");
    expect(detectDocumentVersion({ schemaVersion: 99, nodes: [], edges: [] })).toBe("unknown");
  });
});

describe("migrateDocument", () => {
  it("upgrades the checked-in legacy v0 fixture to the current schema", () => {
    const doc = migrateDocument(legacyFixture);

    expect(doc.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(doc.meta.name).toBe("Legacy onboarding flow");
    expect(doc.nodes).toHaveLength(4);
    expect(doc.edges).toHaveLength(1);

    // Hierarchy and element presets survive the upgrade (presets live on
    // node/edge data, not the document-level motion section).
    const child = doc.nodes.find((n) => n.id === "3");
    expect(child?.parentId).toBe("g1");
    expect(child?.type).toBe("customShape");
    const start = doc.nodes.find((n) => n.id === "1");
    expect(start?.data.preset).toBe("Bounce");
    expect(doc.edges[0].data?.motionLoop).toBe(false);

    // Assets are derived from image nodes on migration.
    expect(doc.assets).toEqual([
      {
        id: "asset-2",
        kind: "image",
        source: "embedded",
        uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=",
      },
    ]);

    // motion now carries only the narrative story.
    expect(doc.motion).toHaveProperty("story");
    expect(doc.motion).not.toHaveProperty("scenes");

    // The migrated document validates and round-trips deterministically.
    expect(safeParseDocument(doc).success).toBe(true);
    const restored = migrateDocument(JSON.parse(deterministicStringify(doc)));
    expect(restored).toEqual(doc);
  });

  it("is idempotent for documents that are already current", () => {
    const doc = migrateDocument(legacyFixture);
    expect(migrateDocument(doc)).toEqual(doc);
  });

  it("migrating a v0 payload twice yields identical output", () => {
    expect(migrateDocument(legacyFixture)).toEqual(migrateDocument(legacyFixture));
  });

  it("names nameless legacy payloads safely", () => {
    const withoutName = { ...legacyFixture };
    delete withoutName.name;
    expect(migrateDocument(withoutName).meta.name).toBe("Untitled diagram");
  });

  it("fails safe instead of guessing on unknown shapes and future versions", () => {
    expect(() => migrateDocument({ schemaVersion: 99, nodes: [], edges: [] })).toThrow(
      DocumentMigrationError,
    );
    expect(() => migrateDocument("not a document")).toThrow(DocumentMigrationError);
    expect(() => migrateDocument({ nodes: "broken", edges: [] })).toThrow(DocumentMigrationError);
  });

  it("migrates v1 presets deterministically without inventing a timeline", () => {
    const v1 = JSON.parse(readFileSync(join(FIXTURES, "v1-with-presets.json"), "utf8"));
    const first = migrateDocument(v1);
    const second = migrateDocument(v1);

    expect(first.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    // Deterministic migration: same input, identical output (no random ids).
    expect(first).toEqual(second);

    // Legacy element presets stay exactly where they were authored.
    expect(first.nodes[0].data.preset).toBe("Pulse Node");
    expect(first.nodes[1].data.preset).toBe("Bounce");
    expect(first.edges[0].data?.preset).toBe("Data Flow");
    expect(first.edges[0].data?.motionLoop).toBe(false);

    // A v1 document never had narrative steps, so migration produces an
    // empty story rather than inventing "Step 1..N" placeholders.
    expect(first.motion).toEqual({
      story: {
        scenes: [{ id: "story-scene-1", title: "Scene 1", steps: [] }],
        activeSceneId: "story-scene-1",
      },
    });

    // Round trip: parse, re-serialize, migrate again — identical.
    const restored = migrateDocument(JSON.parse(deterministicStringify(first)));
    expect(restored).toEqual(first);
  });

  it("migrates preset-free v1 documents to an empty story", () => {
    const doc = migrateDocument({
      ...JSON.parse(readFileSync(join(FIXTURES, "v1-with-presets.json"), "utf8")),
      nodes: [],
      edges: [],
    });
    expect(doc.motion.story?.scenes[0].steps).toEqual([]);
  });

  it("upgrades a v2 timed-motion document into a derived narrative story", () => {
    const base = migrateDocument(
      JSON.parse(readFileSync(join(FIXTURES, "v1-with-presets.json"), "utf8")),
    );
    // Hand-built v2 payload: the legacy scene/track/step timeline this
    // build no longer plays back, but must still migrate a story out of.
    const v2 = {
      ...base,
      schemaVersion: 2,
      motion: {
        scenes: [
          {
            id: "scene-1",
            name: "Scene 1",
            tracks: [
              {
                id: "track-1",
                targetId: "n1",
                targetKind: "node",
                steps: [{ id: "step-1", label: "Pulse the server", at: 0 }],
              },
            ],
          },
        ],
        activeSceneId: "scene-1",
      },
    };

    const upgraded = migrateDocument(v2);
    expect(upgraded.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(upgraded.motion).not.toHaveProperty("scenes");
    expect(upgraded.motion.story?.scenes[0].steps[0].title).toBe("Pulse the server");
    expect(upgraded.motion.story?.scenes[0].steps[0].targets).toEqual([
      { targetId: "n1", targetKind: "node" },
    ]);
  });

  it("keeps an authored v3+ story untouched rather than re-deriving it", () => {
    const base = migrateDocument(
      JSON.parse(readFileSync(join(FIXTURES, "v1-with-presets.json"), "utf8")),
    );
    const v3 = {
      ...base,
      schemaVersion: 3,
      motion: {
        scenes: [],
        story: {
          scenes: [
            {
              id: "story-1",
              title: "Authored scene",
              steps: [
                {
                  id: "step-1",
                  title: "Authored step",
                  description: "Written by a human, not derived.",
                  targets: [{ targetId: "n1", targetKind: "node" }],
                },
              ],
            },
          ],
          activeSceneId: "story-1",
        },
      },
    };

    const upgraded = migrateDocument(v3);
    expect(upgraded.motion.story?.scenes[0].title).toBe("Authored scene");
    expect(upgraded.motion.story?.scenes[0].steps[0].title).toBe("Authored step");
    expect(upgraded.motion.story?.scenes[0].steps[0].description).toBe(
      "Written by a human, not derived.",
    );
  });

  it("upgrades v3 sequence message nodes into attached edges and retargets the story", () => {
    const current = migrateDocument(legacyFixture);
    const v3 = {
      ...current,
      schemaVersion: 3,
      nodes: [
        {
          id: "client",
          type: "customShape",
          position: { x: 100, y: 40 },
          data: { label: "Client", type: "sequence-actor" },
          style: { width: 112, height: 300 },
        },
        {
          id: "api",
          type: "customShape",
          position: { x: 360, y: 40 },
          data: { label: "API", type: "sequence-participant" },
          style: { width: 140, height: 300 },
        },
        {
          id: "request",
          type: "customShape",
          position: { x: 156, y: 150 },
          data: { label: "request()", type: "sequence-message" },
          style: { width: 274, height: 64 },
        },
      ],
      edges: [],
      motion: {
        scenes: [],
        story: {
          scenes: [
            {
              id: "story",
              title: "Story",
              steps: [
                {
                  id: "story-step",
                  title: "Request",
                  targets: [{ targetId: "request", targetKind: "node" }],
                },
              ],
            },
          ],
          activeSceneId: "story",
        },
      },
    };

    const upgraded = migrateDocument(v3);
    expect(upgraded.nodes.map((node) => node.id)).not.toContain("request");
    expect(upgraded.edges).toContainEqual(
      expect.objectContaining({
        id: "request",
        source: "client",
        target: "api",
        sourceHandle: "sequence-row-1",
        targetHandle: "sequence-row-1",
        data: expect.objectContaining({ sequenceType: "sequence-message" }),
      }),
    );
    expect(upgraded.motion).not.toHaveProperty("scenes");
    expect(upgraded.motion.story?.scenes[0].steps[0].targets[0].targetKind).toBe("edge");
  });
});
