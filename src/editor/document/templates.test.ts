import { describe, expect, it } from "vitest";
import { findTemplate, GUIDED_TEMPLATE_ID, TEMPLATES } from "./templates";
import { parseDocument } from "./schema";
import { deterministicStringify } from "./serialize";
import { reconcileMotionTargets } from "../motion/model";

describe("onboarding templates", () => {
  it("offers the four promised templates", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(
      [
        "architecture-request-flow",
        "deployment-pipeline",
        "incident-timeline",
        "sequence-diagram",
      ].sort(),
    );
  });

  it("every template parses as a valid document with a narrated story", () => {
    const expectedStorySteps = new Map([
      ["architecture-request-flow", 3],
      ["deployment-pipeline", 3],
      ["incident-timeline", 3],
      ["sequence-diagram", 7],
    ]);

    for (const template of TEMPLATES) {
      const document = template.build();
      expect(() => parseDocument(document)).not.toThrow();
      expect(document.motion).not.toHaveProperty("scenes");

      const nodeIds = new Set(document.nodes.map((node) => node.id));
      const edgeIds = new Set(document.edges.map((edge) => edge.id));
      const storyTargets = document.motion.story?.scenes.flatMap((scene) =>
        scene.steps.flatMap((step) => step.targets),
      );
      expect(
        storyTargets?.every((target) =>
          target.targetKind === "node"
            ? nodeIds.has(target.targetId)
            : edgeIds.has(target.targetId),
        ),
      ).toBe(true);

      const expectedPreset = template.id === "sequence-diagram" ? "Sequence Flow" : "Data Flow";
      expect(document.edges.every((edge) => edge.data?.preset === expectedPreset)).toBe(true);
      expect(document.edges.every((edge) => edge.data?.motionLoop === true)).toBe(true);

      const story = document.motion.story!;
      expect(story.scenes).toHaveLength(1);
      expect(story.scenes[0].steps).toHaveLength(expectedStorySteps.get(template.id)!);
      expect(
        story.scenes[0].steps.every(
          (step) => step.title.length > 0 && step.description && step.targets.length > 0,
        ),
      ).toBe(true);
    }
  });

  it("guided sample opens with an immediately playable connector loop", () => {
    const sample = findTemplate(GUIDED_TEMPLATE_ID)!.build();
    expect(sample.nodes.every((node) => node.data.preset === undefined)).toBe(true);
    expect(sample.edges.every((edge) => edge.data?.preset === "Data Flow")).toBe(true);
    expect(sample.edges.every((edge) => edge.data?.motionLoop === true)).toBe(true);
    expect(sample.motion.story?.scenes[0].steps.map((step) => step.title)).toEqual([
      "Receive the request",
      "Route to the API",
      "Read application data",
    ]);
  });

  it("builds the sequence starter from native, properly aligned sequence primitives", () => {
    const sequence = findTemplate("sequence-diagram")!.build();

    expect(sequence.edges).toHaveLength(7);
    expect(sequence.nodes.every((node) => node.data.type.startsWith("sequence-"))).toBe(true);
    expect(sequence.nodes.map((node) => node.data.type)).toEqual(
      expect.arrayContaining([
        "sequence-actor",
        "sequence-participant",
        "sequence-activation",
        "sequence-frame",
        "sequence-note",
      ]),
    );

    const byId = new Map(sequence.nodes.map((node) => [node.id, node]));
    const edgesById = new Map(sequence.edges.map((edge) => [edge.id, edge]));
    const connects = (
      messageId: string,
      sourceId: string,
      targetId: string,
      sequenceType: string,
    ) => {
      expect(edgesById.get(messageId)).toMatchObject({
        source: sourceId,
        target: targetId,
        data: { sequenceType },
      });
    };

    connects("message-credentials", "user", "web-app", "sequence-message");
    connects("message-session-request", "web-app", "auth-api", "sequence-message");
    connects("message-find-user", "auth-api", "user-db", "sequence-message");
    connects("message-user-record", "user-db", "auth-api", "sequence-message-return");
    connects("message-verify-password", "auth-api", "auth-api", "sequence-message-self");
    connects("message-audit-event", "auth-api", "audit-log", "sequence-message-async");
    connects("message-session-response", "auth-api", "web-app", "sequence-message-return");

    expect(byId.get("valid-credentials-frame")).toMatchObject({
      type: "containerShape",
      zIndex: -1,
    });
    expect(
      sequence.nodes
        .filter((node) => node.data.type === "sequence-activation")
        .every((node) => node.zIndex === 1),
    ).toBe(true);
    expect(sequence.edges.every((edge) => edge.sourceHandle?.startsWith("sequence-row-"))).toBe(
      true,
    );
    expect(
      sequence.edges.every(
        (edge) => edge.data?.sourceOffset === undefined && edge.data?.targetOffset === undefined,
      ),
    ).toBe(true);

    const lifelines = sequence.nodes.filter(
      (node) => node.data.type === "sequence-actor" || node.data.type === "sequence-participant",
    );
    expect(lifelines).toHaveLength(5);
    expect(lifelines.every((node) => node.position.y === 40 && node.style?.height === 620)).toBe(
      true,
    );

    const participantForActivation = new Map([
      ["web-activation", "web-app"],
      ["auth-activation", "auth-api"],
      ["db-activation", "user-db"],
      ["audit-activation", "audit-log"],
    ]);
    for (const [activationId, participantId] of participantForActivation) {
      const activation = byId.get(activationId)!;
      const participant = byId.get(participantId)!;
      const activationCenter = activation.position.x + Number(activation.style?.width) / 2;
      const participantCenter = participant.position.x + Number(participant.style?.width) / 2;
      expect(activationCenter).toBe(participantCenter);
    }

    expect(edgesById.get("message-credentials")).toMatchObject({
      sourceHandle: "sequence-row-1",
      targetHandle: "sequence-row-1",
    });
    expect(edgesById.get("message-session-response")).toMatchObject({
      sourceHandle: "sequence-row-12",
      targetHandle: "sequence-row-12",
    });
    expect(edgesById.get("message-verify-password")).toMatchObject({
      sourceHandle: "sequence-row-8",
      targetHandle: "sequence-row-9",
    });
    expect(sequence.motion.story?.scenes[0].steps.map((step) => step.title)).toEqual([
      "Submit credentials",
      "Request a session",
      "Find the account",
      "Return the account",
      "Verify the password",
      "Record the sign-in",
      "Return the session",
    ]);
  });

  it("drops story targets when a sequence message is deleted", () => {
    const sequence = findTemplate("sequence-diagram")!.build();
    const deletedId = "message-find-user";
    const remainingEdges = sequence.edges.filter((edge) => edge.id !== deletedId);
    expect(
      reconcileMotionTargets(
        sequence.motion,
        new Set(sequence.nodes.map((node) => node.id)),
        new Set(sequence.edges.map((edge) => edge.id)),
      ),
    ).toBe(sequence.motion);
    const reconciled = reconcileMotionTargets(
      sequence.motion,
      new Set(sequence.nodes.map((node) => node.id)),
      new Set(remainingEdges.map((edge) => edge.id)),
    );

    expect(reconciled).not.toBe(sequence.motion);
    expect(
      reconciled.story?.scenes
        .flatMap((scene) => scene.steps)
        .flatMap((step) => step.targets)
        .map((target) => target.targetId),
    ).not.toContain(deletedId);
  });

  it("templates build fresh, round-trippable copies", () => {
    for (const template of TEMPLATES) {
      const once = template.build();
      const twice = template.build();
      expect(twice).toEqual(once); // deterministic, fixed ids
      const restored = parseDocument(JSON.parse(deterministicStringify(once)));
      expect(restored).toEqual(once);
    }
  });
});
