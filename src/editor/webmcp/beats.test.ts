import { describe, expect, it } from "vitest";
import { beatInputSchema, resolveBeatEdgeMotion, storyFromBeats } from "./beats";

describe("resolveBeatEdgeMotion", () => {
  it("derives a sequence-appropriate preset from an explicit kind", () => {
    const resolved = resolveBeatEdgeMotion("request", undefined, "sequence");
    expect(resolved).toMatchObject({ preset: "Sequence Flow", routing: "straight" });
    // Loop behavior is not derived from a beat: agent-built motion loops
    // continuously by default (tools.ts DEFAULT_MOTION_LOOP).
    expect(resolved).not.toHaveProperty("loop");
  });

  it("derives a data-flow preset for a data-flow beat outside sequence diagrams", () => {
    const resolved = resolveBeatEdgeMotion("data-flow", undefined, "architecture");
    expect(resolved).toMatchObject({ preset: "Data Flow", routing: "straight" });
  });

  it("falls back to inferring the kind from a label when no kind is given", () => {
    const resolved = resolveBeatEdgeMotion(undefined, "returns the cached response", "sequence");
    expect(resolved).toMatchObject({ preset: "Sequence Flow" });
  });

  it("derives Orbit with curved routing for a cycle beat", () => {
    const resolved = resolveBeatEdgeMotion("cycle", undefined, "architecture");
    expect(resolved).toMatchObject({ preset: "Orbit", routing: "curve" });
  });
});

describe("storyFromBeats", () => {
  it("builds one step per beat with node and edge targets", () => {
    const beats = [
      beatInputSchema.parse({
        title: "Submit the request",
        description: "The client sends a request to the API.",
        nodeIds: ["client", "api"],
        edgeIds: ["e1"],
        kind: "request" as const,
      }),
      beatInputSchema.parse({
        title: "Return the response",
        nodeIds: ["api", "client"],
        edgeIds: ["e2"],
        kind: "response" as const,
      }),
    ];

    const story = storyFromBeats(
      beats,
      "Request flow",
      new Set(["client", "api"]),
      new Set(["e1", "e2"]),
    );

    expect(story.scenes).toHaveLength(1);
    expect(story.scenes[0].title).toBe("Request flow");
    expect(story.scenes[0].steps).toHaveLength(2);
    expect(story.scenes[0].steps[0]).toMatchObject({
      title: "Submit the request",
      description: "The client sends a request to the API.",
      targets: [
        { targetId: "client", targetKind: "node" },
        { targetId: "api", targetKind: "node" },
        { targetId: "e1", targetKind: "edge" },
      ],
    });
    expect(story.scenes[0].steps[1].title).toBe("Return the response");
  });

  it("drops targets that do not exist on the built document rather than failing", () => {
    const beats = [
      beatInputSchema.parse({
        title: "Step",
        nodeIds: ["known", "missing"],
        edgeIds: [],
      }),
    ];
    const story = storyFromBeats(beats, "Scene", new Set(["known"]), new Set());
    expect(story.scenes[0].steps[0].targets).toEqual([{ targetId: "known", targetKind: "node" }]);
  });

  it("drops a beat entirely when none of its targets exist", () => {
    const beats = [
      beatInputSchema.parse({ title: "Ghost step", nodeIds: ["missing"], edgeIds: [] }),
      beatInputSchema.parse({ title: "Real step", nodeIds: ["known"], edgeIds: [] }),
    ];
    const story = storyFromBeats(beats, "Scene", new Set(["known"]), new Set());
    expect(story.scenes[0].steps).toHaveLength(1);
    expect(story.scenes[0].steps[0].title).toBe("Real step");
  });

  it("carries an explicit durationMs onto the story step", () => {
    const beats = [
      beatInputSchema.parse({ title: "Slow step", nodeIds: ["a"], edgeIds: [], durationMs: 8_000 }),
    ];
    const story = storyFromBeats(beats, "Scene", new Set(["a"]), new Set());
    expect(story.scenes[0].steps[0].durationMs).toBe(8_000);
  });

  it("rejects a beat with neither nodeIds nor edgeIds", () => {
    expect(() => beatInputSchema.parse({ title: "Empty beat" })).toThrow();
  });
});
