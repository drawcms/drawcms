import { describe, expect, it, vi } from "vitest";
import {
  WEBMCP_EDGE_TYPES,
  createDrawCMSWebMCPTools,
  registerDrawCMSWebMCPTools,
  resolveWebMCPModelContext,
  type DrawCMSWebMCPAdapter,
  type WebMCPModelContext,
} from "./tools";
import { applyGraphEditOperations } from "../commands/commands";
import type { DrawCMSDocument } from "../document/schema";
import { VISUAL_ELEMENT_REGISTRY, VISUAL_MOTION_REGISTRY } from "./visual-grammar";

function adapter() {
  let current: DrawCMSDocument | undefined;
  const replaceDocument = vi.fn((document: DrawCMSDocument) => {
    current = document;
  });
  const setElementMotion = vi.fn(
    (patches: Parameters<DrawCMSWebMCPAdapter["setElementMotion"]>[0]) => {
      if (!current) return;
      const patchesById = new Map(
        patches.map((patch) => [`${patch.targetKind}:${patch.targetId}`, patch]),
      );
      current = {
        ...current,
        nodes: current.nodes.map((node) => {
          const patch = patchesById.get(`node:${node.id}`);
          if (!patch) return node;
          const data = { ...node.data };
          if (patch.preset === null) delete data.preset;
          else if (patch.preset !== undefined) data.preset = patch.preset;
          if (patch.speed !== undefined) data.motionSpeed = patch.speed;
          if (patch.loop !== undefined) data.motionLoop = patch.loop;
          return { ...node, data };
        }),
        edges: current.edges.map((edge) => {
          const patch = patchesById.get(`edge:${edge.id}`);
          if (!patch) return edge;
          const data = { ...edge.data };
          if (patch.preset === null) delete data.preset;
          else if (patch.preset !== undefined) data.preset = patch.preset;
          if (patch.speed !== undefined) data.motionSpeed = patch.speed;
          if (patch.loop !== undefined) data.motionLoop = patch.loop;
          return { ...edge, data };
        }),
      };
    },
  );
  const replaceStory = vi.fn((story: Parameters<DrawCMSWebMCPAdapter["replaceStory"]>[0]) => {
    if (!current) return;
    current = { ...current, motion: { ...current.motion, story } };
  });
  const applyGraphEdit = vi.fn(
    (operations: Parameters<DrawCMSWebMCPAdapter["applyGraphEdit"]>[0]) => {
      if (!current) return;
      const next = applyGraphEditOperations(
        { nodes: current.nodes as never, edges: current.edges as never },
        operations,
      );
      current = { ...current, nodes: next.nodes as never, edges: next.edges as never };
    },
  );
  const value: DrawCMSWebMCPAdapter = {
    getDocument: () => {
      if (!current) throw new Error("No document yet");
      return current;
    },
    replaceDocument,
    setElementMotion,
    replaceStory,
    applyGraphEdit,
  };
  return {
    value,
    replaceDocument,
    setElementMotion,
    replaceStory,
    applyGraphEdit,
    get current() {
      return current;
    },
  };
}

describe("DrawCMS WebMCP tools", () => {
  it("builds a validated diagram with automatic layout and motion presets", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");

    // Some WebMCP clients omit execution options even though the draft API
    // defines a signal. Tool behavior must remain interoperable in that case.
    const result = await replace?.execute(
      {
        name: "Request flow",
        nodes: [
          {
            id: "client",
            label: "Client",
            type: "round-rect",
            fillColor: "#dbeafe",
            motion: { preset: "Pulse Node", speed: 0.5, loop: true },
          },
          { id: "api", label: "API", type: "process" },
        ],
        edges: [
          {
            source: "client",
            target: "api",
            label: "HTTPS",
            motion: { preset: "Data Flow", speed: 0.75, loop: true },
          },
        ],
      },
      {},
    );

    expect(result).toMatchObject({
      ok: true,
      documentName: "Request flow",
      nodeCount: 2,
      edgeCount: 1,
      animatedNodeCount: 1,
      animatedEdgeCount: 1,
    });
    expect(target.replaceDocument).toHaveBeenCalledOnce();
    expect(target.current?.nodes[0]).toMatchObject({
      id: "client",
      position: { x: 120, y: 100 },
      data: {
        fillColor: "#dbeafe",
        preset: "Pulse Node",
        motionSpeed: 0.5,
        motionLoop: true,
      },
    });
    expect(target.current?.edges[0]).toMatchObject({
      source: "client",
      target: "api",
      sourceHandle: "right",
      targetHandle: "left",
      data: { preset: "Data Flow", routingMode: "curve" },
    });
    expect(target.current?.motion).not.toHaveProperty("scenes");
  });

  it("returns a retryable validation error without replacing the canvas", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    const result = await replace?.execute({
      nodes: [{ id: "known", label: "Known" }],
      edges: [{ source: "known", target: "missing" }],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_DIAGRAM",
        message: "Edge 1 has unknown target: missing",
      },
    });
    expect(target.replaceDocument).not.toHaveBeenCalled();
  });

  it("builds native sequence elements and connector semantics", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    const result = await replace?.execute({
      name: "Native sequence",
      nodes: [
        { id: "user", label: "User", type: "sequence-actor" },
        { id: "browser", label: "Browser", type: "sequence-participant" },
        { id: "active", label: "", type: "sequence-activation" },
      ],
      edges: [
        {
          id: "request",
          source: "user",
          target: "browser",
          type: "sequence-message",
          label: "Enter URL",
          motion: { preset: "Sequence Flow", loop: false },
        },
        {
          id: "return",
          source: "browser",
          target: "user",
          type: "sequence-message-return",
          label: "Rendered page",
        },
      ],
    });

    expect(result).toMatchObject({ ok: true, nodeCount: 3, edgeCount: 2 });
    expect(target.current?.nodes[0]).toMatchObject({
      type: "customShape",
      data: { type: "sequence-actor" },
    });
    expect(target.current?.nodes[2]).toMatchObject({
      data: { label: "", type: "sequence-activation" },
      zIndex: 1,
    });
    expect(target.current?.edges[0]).toMatchObject({
      data: {
        sequenceType: "sequence-message",
        routingMode: "straight",
        preset: "Sequence Flow",
        motionLoop: false,
      },
    });
    expect(target.current?.edges[1].data?.sequenceType).toBe("sequence-message-return");
    expect(WEBMCP_EDGE_TYPES).toContain("sequence-message-self");
  });

  it("assigns ascending lifeline rows to sequence messages in array order", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    await replace?.execute({
      nodes: [
        { id: "user", label: "User", type: "sequence-actor" },
        { id: "api", label: "API", type: "sequence-participant" },
        { id: "db", label: "DB", type: "sequence-participant" },
      ],
      edges: [
        { id: "m1", source: "user", target: "api", type: "sequence-message", label: "request()" },
        { id: "m2", source: "api", target: "db", type: "sequence-message", label: "query()" },
        {
          id: "m3",
          source: "db",
          target: "api",
          type: "sequence-message-return",
          label: "rows",
        },
      ],
    });

    const edgesById = new Map(target.current!.edges.map((edge) => [edge.id, edge]));
    expect(edgesById.get("m1")).toMatchObject({
      sourceHandle: "sequence-row-1",
      targetHandle: "sequence-row-1",
    });
    expect(edgesById.get("m2")).toMatchObject({
      sourceHandle: "sequence-row-2",
      targetHandle: "sequence-row-2",
    });
    expect(edgesById.get("m3")).toMatchObject({
      sourceHandle: "sequence-row-3",
      targetHandle: "sequence-row-3",
    });
    // Lifelines land in columns ordered by first appearance, left to right.
    const userX = target.current!.nodes.find((n) => n.id === "user")!.position.x;
    const apiX = target.current!.nodes.find((n) => n.id === "api")!.position.x;
    const dbX = target.current!.nodes.find((n) => n.id === "db")!.position.x;
    expect(userX).toBeLessThan(apiX);
    expect(apiX).toBeLessThan(dbX);
  });

  it("gives a self-message two consecutive rows with elbow routing and a bend", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    await replace?.execute({
      nodes: [
        { id: "api", label: "API", type: "sequence-participant" },
        { id: "next", label: "Next", type: "sequence-participant" },
      ],
      edges: [
        {
          id: "verify",
          source: "api",
          target: "api",
          type: "sequence-message-self",
          label: "verify()",
        },
        { id: "after", source: "api", target: "next", type: "sequence-message", label: "go" },
      ],
    });

    const edgesById = new Map(target.current!.edges.map((edge) => [edge.id, edge]));
    expect(edgesById.get("verify")).toMatchObject({
      sourceHandle: "sequence-row-1",
      targetHandle: "sequence-row-2",
      data: { routingMode: "elbow", bend: { x: 64, y: 0 } },
    });
    // The self-message consumed rows 1-2, so the next message starts at row 3.
    expect(edgesById.get("after")).toMatchObject({
      sourceHandle: "sequence-row-3",
      targetHandle: "sequence-row-3",
    });
  });

  it("returns a retryable error when a sequence diagram exceeds the row budget", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    const nodes = [
      { id: "a", label: "A", type: "sequence-actor" },
      { id: "b", label: "B", type: "sequence-participant" },
    ];
    const edges = Array.from({ length: 13 }, (_, index) => ({
      id: `m${index + 1}`,
      source: "a",
      target: "b",
      type: "sequence-message" as const,
      label: `step ${index + 1}`,
    }));

    const result = await replace?.execute({ nodes, edges });
    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_DIAGRAM" } });
    expect(target.replaceDocument).not.toHaveBeenCalled();
  });

  it("positions a sequence-activation from the message rows of its participant", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    await replace?.execute({
      nodes: [
        { id: "user", label: "User", type: "sequence-actor" },
        { id: "api", label: "API", type: "sequence-participant" },
        { id: "api-active", label: "", type: "sequence-activation", participantId: "api" },
      ],
      edges: [
        { id: "m1", source: "user", target: "api", type: "sequence-message", label: "request()" },
        {
          id: "m2",
          source: "api",
          target: "user",
          type: "sequence-message-return",
          label: "response",
        },
      ],
    });

    const activation = target.current!.nodes.find((n) => n.id === "api-active")!;
    const api = target.current!.nodes.find((n) => n.id === "api")!;
    const activationCenter = activation.position.x + Number(activation.style?.width) / 2;
    const apiCenter = api.position.x + Number(api.style?.width) / 2;
    expect(activationCenter).toBeCloseTo(apiCenter, 5);
    expect(Number(activation.style?.height)).toBeGreaterThan(0);
    expect(activation.position.y).toBeGreaterThan(api.position.y);
  });

  it("builds a narrated, animated diagram from beats in one call", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    const result = await replace?.execute({
      name: "Request flow",
      nodes: [
        { id: "client", label: "Client", type: "arch-frontend" },
        { id: "api", label: "API", type: "arch-backend" },
      ],
      edges: [{ id: "e1", source: "client", target: "api", label: "HTTPS request" }],
      beats: [
        {
          title: "Client sends the request",
          description: "The browser issues an HTTPS request to the API.",
          nodeIds: ["client", "api"],
          edgeIds: ["e1"],
          kind: "request",
        },
      ],
    });

    expect(result).toMatchObject({ ok: true, nodeCount: 2, edgeCount: 1 });
    // No explicit edge.motion was given, so the beat's "request" kind
    // resolves a preset from the visual grammar registry, and that preset
    // loops continuously like every other agent-built motion.
    expect(target.current?.edges[0].data).toMatchObject({
      preset: "Sequence Flow",
      motionSpeed: 0.5,
      motionLoop: true,
    });
    const story = target.current?.motion.story;
    expect(story?.scenes[0].title).toBe("Request flow");
    expect(story?.scenes[0].steps).toHaveLength(1);
    expect(story?.scenes[0].steps[0]).toMatchObject({
      title: "Client sends the request",
      description: "The browser issues an HTTPS request to the API.",
      targets: [
        { targetId: "client", targetKind: "node" },
        { targetId: "api", targetKind: "node" },
        { targetId: "e1", targetKind: "edge" },
      ],
    });
  });

  it("lets an explicit edge motion override a beat-derived preset", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    await replace?.execute({
      nodes: [
        { id: "a", label: "A", type: "arch-backend" },
        { id: "b", label: "B", type: "arch-backend" },
      ],
      edges: [
        {
          id: "e1",
          source: "a",
          target: "b",
          motion: { preset: "Fade Path", speed: 1, loop: false },
        },
      ],
      beats: [{ title: "Step", nodeIds: ["a", "b"], edgeIds: ["e1"], kind: "request" }],
    });

    expect(target.current?.edges[0].data).toMatchObject({
      preset: "Fade Path",
      motionSpeed: 1,
      motionLoop: false,
    });
  });

  it("loops motion continuously when a build omits loop, on both nodes and connectors", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    await replace?.execute({
      nodes: [
        { id: "a", label: "A", type: "arch-frontend", motion: { preset: "Pulse Node" } },
        { id: "b", label: "B", type: "arch-backend" },
      ],
      edges: [{ id: "e1", source: "a", target: "b", motion: { preset: "Data Flow" } }],
    });

    expect(target.current?.nodes[0].data).toMatchObject({
      preset: "Pulse Node",
      motionLoop: true,
    });
    expect(target.current?.edges[0].data).toMatchObject({
      preset: "Data Flow",
      motionLoop: true,
    });
  });

  it("loops a sequence message built from beats, and still honors an explicit opt-out", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    await replace?.execute({
      nodes: [
        { id: "user", label: "User", type: "sequence-actor" },
        { id: "api", label: "API", type: "sequence-participant" },
      ],
      edges: [
        { id: "m1", source: "user", target: "api", type: "sequence-message", label: "request()" },
        {
          id: "m2",
          source: "api",
          target: "user",
          type: "sequence-message-return",
          label: "rows",
          motion: { preset: "Sequence Flow", loop: false },
        },
      ],
      beats: [
        { title: "Ask", nodeIds: ["user", "api"], edgeIds: ["m1"], kind: "request" },
        { title: "Answer", nodeIds: ["api", "user"], edgeIds: ["m2"], kind: "response" },
      ],
    });

    const edgesById = new Map(target.current!.edges.map((edge) => [edge.id, edge]));
    expect(edgesById.get("m1")?.data).toMatchObject({ motionLoop: true });
    expect(edgesById.get("m2")?.data).toMatchObject({ motionLoop: false });
  });

  it("uses a fully explicit story instead of beats when both are given", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    await replace?.execute({
      nodes: [{ id: "a", label: "A", type: "arch-backend" }],
      edges: [],
      beats: [{ title: "Ignored beat", nodeIds: ["a"], edgeIds: [] }],
      story: {
        scenes: [
          {
            id: "custom-scene",
            title: "Custom",
            steps: [
              {
                id: "custom-step",
                title: "Authored by the agent directly",
                targets: [{ targetId: "a", targetKind: "node" }],
              },
            ],
          },
        ],
        activeSceneId: "custom-scene",
      },
    });

    expect(target.current?.motion.story?.scenes[0].title).toBe("Custom");
    expect(target.current?.motion.story?.scenes[0].steps[0].title).toBe(
      "Authored by the agent directly",
    );
  });

  it("builds an unnarrated diagram with an empty story when neither beats nor story are given", async () => {
    const target = adapter();
    const replace = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_replace_diagram",
    );

    await replace?.execute({
      nodes: [{ id: "a", label: "A", type: "round-rect" }],
      edges: [],
    });

    expect(target.current?.motion.story?.scenes[0].steps).toEqual([]);
  });

  it("queries the complete visual grammar", async () => {
    const target = adapter();
    const grammar = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_get_visual_grammar",
    );

    const summary = await grammar?.execute({ scope: "summary" });
    const entries = await grammar?.execute({
      scope: "elements",
      ids: ["sequence-participant", "database", "aws-ec2", "icon"],
    });

    expect(summary).toMatchObject({
      ok: true,
      summary: {
        elementCount: VISUAL_ELEMENT_REGISTRY.length,
        motionPresetCount: VISUAL_MOTION_REGISTRY.length,
      },
    });
    expect(entries).toMatchObject({ ok: true, totalMatches: 4 });
  });

  it("recommends semantic notation before mutation", async () => {
    const target = adapter();
    const recommend = createDrawCMSWebMCPTools(target.value).find(
      (tool) => tool.name === "drawcms_recommend_visuals",
    );

    const result = await recommend?.execute({
      diagramType: "sequence",
      entities: [
        { id: "user", label: "User", role: "actor" },
        { id: "server", label: "Server", role: "service" },
      ],
      relationships: [
        { source: "user", target: "server", kind: "request" },
        { source: "server", target: "user", kind: "response" },
      ],
      animationGoal: "explain-flow",
    });

    expect(result).toMatchObject({
      ok: true,
      elements: [{ elementId: "sequence-actor" }, { elementId: "sequence-participant" }],
      relationships: [
        { connectorType: "sequence-message", loop: false, order: 1 },
        { connectorType: "sequence-message-return", loop: false, order: 2 },
      ],
    });
    expect(target.replaceDocument).not.toHaveBeenCalled();
  });

  it("validates the current diagram against visual semantics", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const validate = tools.find((tool) => tool.name === "drawcms_validate_diagram");
    await replace?.execute({
      nodes: [
        { id: "browser", label: "Browser", type: "card" },
        { id: "dns", label: "DNS Resolver", type: "database" },
      ],
      edges: [{ source: "browser", target: "dns", label: "Request" }],
    });

    const result = await validate?.execute({ diagramType: "sequence" });

    expect(result).toMatchObject({ ok: true, diagramType: "sequence" });
    expect(result).toHaveProperty("issues");
    expect(JSON.stringify(result)).toContain("DATASTORE_SEMANTIC_MISMATCH");
  });

  it("registers every tool with one AbortSignal and aborts on cleanup", () => {
    const target = adapter();
    const signals: AbortSignal[] = [];
    const modelContext: WebMCPModelContext = {
      registerTool: vi.fn(async (_tool, options) => {
        if (options?.signal) signals.push(options.signal);
      }),
    };

    const dispose = registerDrawCMSWebMCPTools(modelContext, target.value);

    expect(modelContext.registerTool).toHaveBeenCalledTimes(8);
    expect(new Set(signals)).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);
    dispose();
    expect(signals[0].aborted).toBe(true);
  });

  it("retimes an existing element by id without touching structure or narration", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const setMotion = tools.find((tool) => tool.name === "drawcms_set_motion");

    await replace?.execute({
      nodes: [
        { id: "a", label: "A", type: "round-rect" },
        { id: "b", label: "B", type: "round-rect" },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }],
    });
    const beforePositions = target.current!.nodes.map((node) => node.position);

    const result = await setMotion?.execute({
      patches: [
        { targetId: "a", targetKind: "node", preset: "Pulse Node", speed: 1.5, loop: true },
        { targetId: "e1", targetKind: "edge", preset: "Data Flow", loop: false },
      ],
    });

    expect(result).toMatchObject({ ok: true, patchedCount: 2 });
    expect(target.setElementMotion).toHaveBeenCalledWith([
      { targetId: "a", targetKind: "node", preset: "Pulse Node", speed: 1.5, loop: true },
      { targetId: "e1", targetKind: "edge", preset: "Data Flow", loop: false },
    ]);
    expect(target.current?.nodes[0].data).toMatchObject({
      preset: "Pulse Node",
      motionSpeed: 1.5,
      motionLoop: true,
    });
    expect(target.current?.edges[0].data).toMatchObject({ preset: "Data Flow", motionLoop: false });
    // Structure is untouched.
    expect(target.current?.nodes.map((node) => node.position)).toEqual(beforePositions);
  });

  it("loops a preset set through drawcms_set_motion when the patch omits loop", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const setMotion = tools.find((tool) => tool.name === "drawcms_set_motion");

    await replace?.execute({
      nodes: [
        { id: "a", label: "A", type: "arch-frontend", motion: { preset: "Bounce", loop: false } },
        { id: "b", label: "B", type: "arch-backend" },
      ],
      edges: [{ id: "e1", source: "a", target: "b", motion: { preset: "Fade Path", loop: false } }],
    });

    await setMotion?.execute({
      patches: [
        { targetId: "a", targetKind: "node", preset: "Pulse Node" },
        { targetId: "e1", targetKind: "edge", preset: "Data Flow" },
      ],
    });

    expect(target.setElementMotion).toHaveBeenCalledWith([
      { targetId: "a", targetKind: "node", preset: "Pulse Node", loop: true },
      { targetId: "e1", targetKind: "edge", preset: "Data Flow", loop: true },
    ]);
    expect(target.current?.nodes[0].data).toMatchObject({
      preset: "Pulse Node",
      motionLoop: true,
    });
    expect(target.current?.edges[0].data).toMatchObject({ preset: "Data Flow", motionLoop: true });
  });

  it("leaves loop alone when drawcms_set_motion only retimes an element", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const setMotion = tools.find((tool) => tool.name === "drawcms_set_motion");

    await replace?.execute({
      nodes: [
        { id: "a", label: "A", type: "arch-frontend", motion: { preset: "Bounce", loop: false } },
      ],
    });

    await setMotion?.execute({ patches: [{ targetId: "a", targetKind: "node", speed: 2 }] });

    expect(target.setElementMotion).toHaveBeenCalledWith([
      { targetId: "a", targetKind: "node", speed: 2 },
    ]);
    expect(target.current?.nodes[0].data).toMatchObject({ motionSpeed: 2, motionLoop: false });
  });

  it("clears a preset when patched with null", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const setMotion = tools.find((tool) => tool.name === "drawcms_set_motion");

    await replace?.execute({
      nodes: [{ id: "a", label: "A", type: "round-rect", motion: { preset: "Bounce" } }],
    });
    expect(target.current?.nodes[0].data.preset).toBe("Bounce");

    await setMotion?.execute({ patches: [{ targetId: "a", targetKind: "node", preset: null }] });
    expect(target.current?.nodes[0].data.preset).toBeUndefined();
  });

  it("returns a retryable error when drawcms_set_motion targets an unknown id", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const setMotion = tools.find((tool) => tool.name === "drawcms_set_motion");

    await replace?.execute({ nodes: [{ id: "a", label: "A", type: "round-rect" }] });
    const result = await setMotion?.execute({
      patches: [{ targetId: "missing", targetKind: "node", preset: "Bounce" }],
    });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_DIAGRAM" } });
    expect(target.setElementMotion).not.toHaveBeenCalled();
  });

  it("replaces the presentation story without touching structure or motion", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const setStory = tools.find((tool) => tool.name === "drawcms_set_story");

    await replace?.execute({
      nodes: [
        { id: "client", label: "Client", type: "arch-frontend", motion: { preset: "Pulse Node" } },
        { id: "api", label: "API", type: "arch-backend" },
      ],
      edges: [{ id: "e1", source: "client", target: "api" }],
    });

    const result = await setStory?.execute({
      scenes: [
        {
          title: "Request flow",
          steps: [
            {
              title: "Client calls the API",
              description: "The client sends a request over the connector.",
              targets: [
                { targetId: "client", targetKind: "node" },
                { targetId: "e1", targetKind: "edge" },
              ],
              durationMs: 6_000,
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({ ok: true, sceneCount: 1, stepCount: 1 });
    expect(target.replaceStory).toHaveBeenCalledOnce();
    const story = target.current?.motion.story;
    expect(story?.scenes[0].title).toBe("Request flow");
    expect(story?.scenes[0].steps[0]).toMatchObject({
      title: "Client calls the API",
      description: "The client sends a request over the connector.",
      durationMs: 6_000,
      targets: [
        { targetId: "client", targetKind: "node" },
        { targetId: "e1", targetKind: "edge" },
      ],
    });
    // Motion and structure are untouched.
    expect(target.current?.nodes[0].data.preset).toBe("Pulse Node");
    expect(target.current?.edges).toHaveLength(1);
  });

  it("returns a retryable error when drawcms_set_story targets an unknown id", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const setStory = tools.find((tool) => tool.name === "drawcms_set_story");

    await replace?.execute({ nodes: [{ id: "a", label: "A", type: "round-rect" }] });
    const result = await setStory?.execute({
      scenes: [
        {
          title: "Scene",
          steps: [{ title: "Step", targets: [{ targetId: "missing", targetKind: "node" }] }],
        },
      ],
    });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_DIAGRAM" } });
    expect(target.replaceStory).not.toHaveBeenCalled();
  });

  it("adds a node and connects it to an existing one in a single undoable batch", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const edit = tools.find((tool) => tool.name === "drawcms_edit_diagram");

    await replace?.execute({ nodes: [{ id: "api", label: "API", type: "arch-backend" }] });

    const result = await edit?.execute({
      operations: [
        {
          op: "addNode",
          id: "db",
          label: "Database",
          type: "arch-database",
          position: { x: 400, y: 100 },
        },
        {
          op: "addEdge",
          source: "api",
          target: "db",
          label: "query",
          motion: { preset: "Data Flow" },
        },
      ],
    });

    expect(result).toMatchObject({ ok: true, operationCount: 2, addNode: 1, addEdge: 1 });
    expect(target.applyGraphEdit).toHaveBeenCalledOnce();
    expect(target.current?.nodes).toHaveLength(2);
    expect(target.current?.nodes[1]).toMatchObject({
      id: "db",
      position: { x: 400, y: 100 },
      data: { label: "Database", type: "arch-database" },
    });
    expect(target.current?.edges[0]).toMatchObject({
      source: "api",
      target: "db",
      data: { label: "query", preset: "Data Flow", motionSpeed: 0.5 },
    });
  });

  it("updates and deletes existing elements without touching the rest of the diagram", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const edit = tools.find((tool) => tool.name === "drawcms_edit_diagram");

    await replace?.execute({
      nodes: [
        { id: "a", label: "A", type: "round-rect" },
        { id: "b", label: "B", type: "round-rect", motion: { preset: "Bounce" } },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }],
    });

    const result = await edit?.execute({
      operations: [
        { op: "updateNode", nodeId: "a", label: "Renamed A" },
        { op: "updateNode", nodeId: "b", motion: { preset: null } },
        { op: "deleteEdge", edgeId: "e1" },
      ],
    });

    expect(result).toMatchObject({ ok: true, operationCount: 3, updateNode: 2, deleteEdge: 1 });
    expect(target.current?.nodes[0].data.label).toBe("Renamed A");
    expect(target.current?.nodes[1].data.preset).toBeUndefined();
    expect(target.current?.edges).toHaveLength(0);
  });

  it("adds a native sequence message that lands on the next available lifeline row", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const edit = tools.find((tool) => tool.name === "drawcms_edit_diagram");

    await replace?.execute({
      name: "Sign-in",
      nodes: [
        { id: "user", label: "User", type: "sequence-actor" },
        { id: "api", label: "API", type: "sequence-participant" },
      ],
      edges: [
        { id: "m1", source: "user", target: "api", type: "sequence-message", label: "signIn()" },
      ],
    });

    const result = await edit?.execute({
      operations: [
        {
          op: "addEdge",
          id: "m2",
          source: "api",
          target: "user",
          type: "sequence-message-return",
          label: "token",
        },
      ],
    });

    expect(result).toMatchObject({ ok: true, addEdge: 1 });
    expect(target.current?.edges[1]).toMatchObject({
      id: "m2",
      sourceHandle: "sequence-row-2",
      targetHandle: "sequence-row-2",
      data: { sequenceType: "sequence-message-return" },
    });
  });

  it("returns a retryable error and applies nothing when an operation references an unknown id", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const edit = tools.find((tool) => tool.name === "drawcms_edit_diagram");

    await replace?.execute({ nodes: [{ id: "a", label: "A", type: "round-rect" }] });

    const result = await edit?.execute({
      operations: [
        { op: "updateNode", nodeId: "a", label: "Renamed" },
        { op: "deleteNode", nodeId: "missing" },
      ],
    });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_DIAGRAM" } });
    expect(target.applyGraphEdit).not.toHaveBeenCalled();
    // Nothing partially applied — the first operation's rename never landed.
    expect(target.current?.nodes[0].data.label).toBe("A");
  });

  it("rejects a duplicate node id within the same batch", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const edit = tools.find((tool) => tool.name === "drawcms_edit_diagram");

    await replace?.execute({ nodes: [{ id: "a", label: "A", type: "round-rect" }] });

    const result = await edit?.execute({
      operations: [{ op: "addNode", id: "a", label: "Duplicate", type: "round-rect" }],
    });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_DIAGRAM" } });
    expect(target.applyGraphEdit).not.toHaveBeenCalled();
  });

  it("loops a preset applied by an edit, without inheriting an earlier loop opt-out", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const edit = tools.find((tool) => tool.name === "drawcms_edit_diagram");

    await replace?.execute({
      nodes: [
        { id: "a", label: "A", type: "arch-frontend", motion: { preset: "Bounce", loop: false } },
        { id: "b", label: "B", type: "arch-backend" },
      ],
      edges: [{ id: "e1", source: "a", target: "b", motion: { preset: "Fade Path", loop: false } }],
    });

    await edit?.execute({
      operations: [
        { op: "updateNode", nodeId: "a", motion: { preset: "Pulse Node" } },
        { op: "updateEdge", edgeId: "e1", motion: { preset: "Data Flow" } },
        // Adding a node in the same batch follows the same default.
        {
          op: "addNode",
          id: "c",
          label: "C",
          type: "arch-backend",
          motion: { preset: "Pulse Node" },
        },
      ],
    });

    expect(target.current?.nodes[0].data).toMatchObject({
      preset: "Pulse Node",
      motionLoop: true,
    });
    expect(target.current?.edges[0].data).toMatchObject({ preset: "Data Flow", motionLoop: true });
    expect(target.current?.nodes[2].data).toMatchObject({
      preset: "Pulse Node",
      motionLoop: true,
    });
  });

  it("leaves loop alone when an edit only retimes or clears motion", async () => {
    const target = adapter();
    const tools = createDrawCMSWebMCPTools(target.value);
    const replace = tools.find((tool) => tool.name === "drawcms_replace_diagram");
    const edit = tools.find((tool) => tool.name === "drawcms_edit_diagram");

    await replace?.execute({
      nodes: [
        { id: "a", label: "A", type: "arch-frontend", motion: { preset: "Bounce", loop: false } },
      ],
    });

    await edit?.execute({
      operations: [{ op: "updateNode", nodeId: "a", motion: { speed: 2 } }],
    });

    expect(target.current?.nodes[0].data).toMatchObject({ motionSpeed: 2, motionLoop: false });
  });

  it("prefers document.modelContext and supports the legacy preview location", () => {
    const current = { registerTool: vi.fn(async () => {}) };
    const legacy = { registerTool: vi.fn(async () => {}) };
    const ownerDocument = {
      modelContext: current,
      defaultView: { navigator: { modelContext: legacy } },
    } as unknown as Document;

    expect(resolveWebMCPModelContext(ownerDocument)).toBe(current);
    expect(
      resolveWebMCPModelContext({
        defaultView: { navigator: { modelContext: legacy } },
      } as unknown as Document),
    ).toBe(legacy);
  });
});
