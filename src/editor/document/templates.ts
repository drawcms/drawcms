import { createDocument } from "./serialize";
import type { DrawCMSDocument } from "./schema";
import type { MotionState } from "../motion/model";
import { getSemanticStyleDefaults } from "../components/shapes/semantic-elements";
import type { StoryTarget } from "../story/model";
import type { AppEdge, AppNode, AppNodeData, EdgeBend, EdgeRoutingMode } from "../types";
import type { SequenceEdgeType } from "../types";
import { createSequenceEdge, sequenceActivationBounds } from "../sequence-edges";
import { defaultNodeData, nodeRendererType, nodeStyle, nodeZIndex } from "../node-factory";
import { GUIDED_TEMPLATE_ID, TEMPLATE_CATALOG, type TemplateId } from "./template-catalog";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  /** Build a fresh copy — the editor then owns and can mutate it freely. */
  build: () => DrawCMSDocument;
}

const shape = (
  id: string,
  type: string,
  label: string,
  x: number,
  y: number,
  extra?: Partial<AppNode>,
): AppNode => ({
  id,
  type: "customShape",
  position: { x, y },
  data: { label, type },
  style: { width: 120, height: 64 },
  ...extra,
});

const edge = (
  id: string,
  source: string,
  target: string,
  label?: string,
  routing: {
    sourceHandle?: string;
    targetHandle?: string;
    routingMode?: EdgeRoutingMode;
    bend?: EdgeBend;
  } = {},
): AppEdge => ({
  id,
  source,
  target,
  sourceHandle: routing.sourceHandle ?? "right",
  targetHandle: routing.targetHandle ?? "left",
  ...(label ? { label } : {}),
  data: {
    ...(label ? { label } : {}),
    preset: "Data Flow",
    motionSpeed: 0.5,
    motionLoop: true,
    ...(routing.routingMode ? { routingMode: routing.routingMode } : {}),
    ...(routing.bend ? { bend: routing.bend } : {}),
  },
});

const sequenceShape = (
  id: string,
  type: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Partial<AppNodeData> = {},
): AppNode => ({
  id,
  type: type === "sequence-frame" ? "containerShape" : "customShape",
  position: { x, y },
  data: {
    label,
    type,
    ...getSemanticStyleDefaults(type),
    strokeWidth: type === "sequence-frame" ? 1 : 1.5,
    fontSize: type === "sequence-note" ? 12 : 13,
    fontWeight: type === "sequence-actor" || type === "sequence-participant" ? "600" : "500",
    textColor: "#334155",
    ...data,
  },
  style: { width, height },
  ...(type === "sequence-frame"
    ? { zIndex: -1 }
    : type === "sequence-activation"
      ? { zIndex: 1 }
      : type === "sequence-note"
        ? { zIndex: 2 }
        : {}),
});

const nodeTarget = (targetId: string): StoryTarget => ({ targetId, targetKind: "node" });
const edgeTarget = (targetId: string): StoryTarget => ({ targetId, targetKind: "edge" });

/**
 * Build a template node through the shared node factory, so a template element
 * is indistinguishable from one dragged off the palette or built by an agent:
 * the factory owns the renderer key, semantic style defaults, structured
 * content (UML members, ER attributes, table rows), default sizing, and the
 * z-index that puts containers behind their contents. `placeholderContent` is
 * false because a template supplies its own real fields rather than shipping
 * sample rows a reader would mistake for authored content.
 */
const node = (
  id: string,
  type: string,
  label: string,
  x: number,
  y: number,
  options: { width?: number; height?: number; data?: Partial<AppNodeData> } = {},
): AppNode => {
  const zIndex = nodeZIndex(type);
  return {
    id,
    type: nodeRendererType(type),
    position: { x, y },
    data: {
      ...defaultNodeData(type, label, { placeholderContent: false }),
      ...options.data,
    },
    style: nodeStyle(type, options.width, options.height),
    ...(zIndex !== undefined ? { zIndex } : {}),
  };
};

/** Vertical connector handles, for top-down flows (org charts, flowcharts). */
const down = { sourceHandle: "bottom", targetHandle: "top" } as const;

interface TemplateBeat {
  id: string;
  title: string;
  description: string;
  targets: StoryTarget[];
}

/**
 * Templates open with a short explanation and a quiet, continuous connector
 * loop (each connector's own `data.preset` drives that motion). The
 * document-level motion section only carries the narrative story that walks
 * through the same beats.
 */
const templateMotion = (id: string, name: string, description: string, beats: TemplateBeat[]) => {
  const storySceneId = `story-${id}`;

  return {
    story: {
      scenes: [
        {
          id: storySceneId,
          title: name,
          description,
          steps: beats.map((beat) => ({
            id: `story-${beat.id}`,
            title: beat.title,
            description: beat.description,
            targets: beat.targets,
          })),
        },
      ],
      activeSceneId: storySceneId,
    },
  } satisfies MotionState;
};

const sequenceMessageEdge = (
  id: string,
  sequenceType: SequenceEdgeType,
  label: string,
  source: string,
  target: string,
  row: number,
) => {
  const message = createSequenceEdge({ id, sequenceType, label, source, target, row });
  return {
    ...message,
    data: {
      ...message.data,
      preset: "Sequence Flow",
      motionSpeed: 0.5,
      motionLoop: true,
    },
  };
};

function secureSignInMotion(): MotionState {
  const beats = [
    {
      id: "credentials",
      title: "Submit credentials",
      description: "The user submits their email and password through the web app.",
      targets: [nodeTarget("user"), nodeTarget("web-app"), edgeTarget("message-credentials")],
    },
    {
      id: "session-request",
      title: "Request a session",
      description: "The web app sends the credentials to the authentication service.",
      targets: [
        nodeTarget("web-app"),
        nodeTarget("auth-api"),
        edgeTarget("message-session-request"),
      ],
    },
    {
      id: "find-account",
      title: "Find the account",
      description: "The authentication service asks the user database for the account.",
      targets: [nodeTarget("auth-api"), nodeTarget("user-db"), edgeTarget("message-find-user")],
    },
    {
      id: "return-account",
      title: "Return the account",
      description: "The database returns the user record and stored password hash.",
      targets: [nodeTarget("user-db"), nodeTarget("auth-api"), edgeTarget("message-user-record")],
    },
    {
      id: "verify-password",
      title: "Verify the password",
      description: "The API verifies the submitted password against the stored hash.",
      targets: [nodeTarget("auth-api"), edgeTarget("message-verify-password")],
    },
    {
      id: "record-event",
      title: "Record the sign-in",
      description: "A successful sign-in emits an asynchronous audit event.",
      targets: [nodeTarget("auth-api"), nodeTarget("audit-log"), edgeTarget("message-audit-event")],
    },
    {
      id: "return-session",
      title: "Return the session",
      description: "The API returns a secure session cookie to the web app.",
      targets: [
        nodeTarget("auth-api"),
        nodeTarget("web-app"),
        edgeTarget("message-session-response"),
      ],
    },
  ] satisfies TemplateBeat[];

  return templateMotion(
    "secure-sign-in",
    "Secure sign-in",
    "Follow a successful session request from the user to the audit log.",
    beats,
  );
}

function architectureRequestFlow(): DrawCMSDocument {
  const nodes = [
    shape("user", "arch-external", "User", 40, 200),
    shape("lb", "arch-cloud", "Load Balancer", 260, 200),
    shape("api", "arch-backend", "API", 480, 200),
    shape("db", "arch-database", "Database", 700, 200),
  ];
  const edges = [
    edge("e1", "user", "lb", "https"),
    edge("e2", "lb", "api", "route"),
    edge("e3", "api", "db", "query"),
  ];
  const beats = [
    {
      id: "receive-request",
      title: "Receive the request",
      description: "The user sends an encrypted request to the load balancer.",
      targets: [nodeTarget("user"), nodeTarget("lb"), edgeTarget("e1")],
    },
    {
      id: "route-request",
      title: "Route to the API",
      description: "The load balancer forwards the request to the application API.",
      targets: [nodeTarget("lb"), nodeTarget("api"), edgeTarget("e2")],
    },
    {
      id: "read-data",
      title: "Read application data",
      description: "The API queries the database for the requested data.",
      targets: [nodeTarget("api"), nodeTarget("db"), edgeTarget("e3")],
    },
  ] satisfies TemplateBeat[];
  return createDocument({
    nodes,
    edges,
    meta: { name: "Architecture request flow" },
    motion: templateMotion(
      "architecture-request-flow",
      "Request flow",
      "Follow one request through the application stack.",
      beats,
    ),
  });
}

function deploymentPipeline(): DrawCMSDocument {
  const nodes = [
    shape("git", "terminator", "Repo", 40, 160),
    shape("ci", "process", "CI", 260, 160),
    shape("stage", "process", "Staging", 480, 160),
    shape("prod", "terminator", "Prod", 700, 160),
  ];
  const edges = [
    edge("d1", "git", "ci", "push"),
    edge("d2", "ci", "stage", "deploy"),
    edge("d3", "stage", "prod", "promote"),
  ];
  const beats = [
    {
      id: "push-change",
      title: "Push the change",
      description: "A source change starts the continuous integration workflow.",
      targets: [nodeTarget("git"), nodeTarget("ci"), edgeTarget("d1")],
    },
    {
      id: "deploy-staging",
      title: "Deploy to staging",
      description: "The verified build is deployed to the staging environment.",
      targets: [nodeTarget("ci"), nodeTarget("stage"), edgeTarget("d2")],
    },
    {
      id: "promote-production",
      title: "Promote to production",
      description: "The approved release is promoted to production.",
      targets: [nodeTarget("stage"), nodeTarget("prod"), edgeTarget("d3")],
    },
  ] satisfies TemplateBeat[];
  return createDocument({
    nodes,
    edges,
    meta: { name: "Deployment pipeline" },
    motion: templateMotion(
      "deployment-pipeline",
      "Deployment pipeline",
      "Follow one release from source control to production.",
      beats,
    ),
  });
}

function incidentTimeline(): DrawCMSDocument {
  const nodes = [
    shape("detect", "bpmn-start", "Detect", 60, 100),
    shape("alert", "diamond", "Alert", 280, 100),
    shape("respond", "actor", "On-call", 500, 100),
    shape("resolve", "bpmn-end", "Resolve", 720, 100),
  ];
  const edges = [
    edge("i1", "detect", "alert", "signal"),
    edge("i2", "alert", "respond", "page"),
    edge("i3", "respond", "resolve", "fix"),
  ];
  const beats = [
    {
      id: "raise-alert",
      title: "Raise the alert",
      description: "Monitoring detects the incident and raises an actionable alert.",
      targets: [nodeTarget("detect"), nodeTarget("alert"), edgeTarget("i1")],
    },
    {
      id: "page-on-call",
      title: "Page the on-call",
      description: "The alert reaches the engineer responsible for the service.",
      targets: [nodeTarget("alert"), nodeTarget("respond"), edgeTarget("i2")],
    },
    {
      id: "resolve-incident",
      title: "Resolve the incident",
      description: "The on-call engineer applies the fix and restores service.",
      targets: [nodeTarget("respond"), nodeTarget("resolve"), edgeTarget("i3")],
    },
  ] satisfies TemplateBeat[];
  return createDocument({
    nodes,
    edges,
    meta: { name: "Incident timeline" },
    motion: templateMotion(
      "incident-timeline",
      "Incident response",
      "Follow the incident from detection to service recovery.",
      beats,
    ),
  });
}

function sequenceDiagram(): DrawCMSDocument {
  const lifelineY = 40;
  const lifelineHeight = 620;
  const lifelines = {
    user: { x: 60, width: 112 },
    webApp: { x: 260, width: 160 },
    authApi: { x: 510, width: 160 },
    userDb: { x: 760, width: 160 },
    auditLog: { x: 1010, width: 160 },
  } as const;
  const lifelineCenter = ({ x, width }: { x: number; width: number }) => x + width / 2;
  const activation = (
    id: string,
    lifeline: { x: number; width: number },
    firstRow: number,
    lastRow: number,
  ) => {
    const bounds = sequenceActivationBounds(lifelineY, lifelineHeight, firstRow, lastRow);
    return sequenceShape(
      id,
      "sequence-activation",
      "",
      lifelineCenter(lifeline) - 45,
      Math.round(bounds.y * 10) / 10,
      90,
      Math.round(bounds.height * 10) / 10,
    );
  };

  const nodes = [
    // Scope server-side authentication after the browser submits credentials.
    // The frame stays behind every selectable lifeline, activation, and edge.
    sequenceShape("valid-credentials-frame", "sequence-frame", "opt [valid]", 220, 290, 950, 350, {
      fillColor: "#f8fafc",
      headerColor: "#e2e8f0",
    }),

    sequenceShape(
      "user",
      "sequence-actor",
      "User",
      lifelines.user.x,
      lifelineY,
      lifelines.user.width,
      lifelineHeight,
    ),
    sequenceShape(
      "web-app",
      "sequence-participant",
      "Web App",
      lifelines.webApp.x,
      lifelineY,
      lifelines.webApp.width,
      lifelineHeight,
    ),
    sequenceShape(
      "auth-api",
      "sequence-participant",
      "Auth Service",
      lifelines.authApi.x,
      lifelineY,
      lifelines.authApi.width,
      lifelineHeight,
    ),
    sequenceShape(
      "user-db",
      "sequence-participant",
      "User DB",
      lifelines.userDb.x,
      lifelineY,
      lifelines.userDb.width,
      lifelineHeight,
    ),
    sequenceShape(
      "audit-log",
      "sequence-participant",
      "Audit Log",
      lifelines.auditLog.x,
      lifelineY,
      lifelines.auditLog.width,
      lifelineHeight,
    ),

    activation("web-activation", lifelines.webApp, 1, 12),
    activation("auth-activation", lifelines.authApi, 3, 12),
    activation("db-activation", lifelines.userDb, 5, 7),
    activation("audit-activation", lifelines.auditLog, 10, 12),

    sequenceShape(
      "password-note",
      "sequence-note",
      "Password hashes stay inside the trusted service boundary.",
      880,
      156,
      170,
      96,
      { fillColor: "#fffbeb", strokeColor: "#a16207", textColor: "#713f12" },
    ),
  ];

  const edges = [
    sequenceMessageEdge(
      "message-credentials",
      "sequence-message",
      "signIn(email, password)",
      "user",
      "web-app",
      1,
    ),
    sequenceMessageEdge(
      "message-session-request",
      "sequence-message",
      "POST /sessions",
      "web-app",
      "auth-api",
      3,
    ),
    sequenceMessageEdge(
      "message-find-user",
      "sequence-message",
      "findUser(email)",
      "auth-api",
      "user-db",
      5,
    ),
    sequenceMessageEdge(
      "message-user-record",
      "sequence-message-return",
      "user + passwordHash",
      "user-db",
      "auth-api",
      7,
    ),
    sequenceMessageEdge(
      "message-verify-password",
      "sequence-message-self",
      "verifyPassword()",
      "auth-api",
      "auth-api",
      8,
    ),
    sequenceMessageEdge(
      "message-audit-event",
      "sequence-message-async",
      "session.created",
      "auth-api",
      "audit-log",
      10,
    ),
    sequenceMessageEdge(
      "message-session-response",
      "sequence-message-return",
      "201 Created + secure cookie",
      "auth-api",
      "web-app",
      12,
    ),
  ];

  return createDocument({
    nodes,
    edges,
    meta: {
      name: "Sequence: secure sign-in",
      description:
        "A complete authentication sequence with lifelines, activations, synchronous and asynchronous messages, returns, an interaction frame, and an engineering note.",
    },
    motion: secureSignInMotion(),
  });
}

/** Assemble a template document: real nodes/edges plus a narrated story. */
const templateDoc = (
  id: string,
  name: string,
  storyTitle: string,
  storyDescription: string,
  nodes: AppNode[],
  edges: AppEdge[],
  beats: TemplateBeat[],
): DrawCMSDocument =>
  createDocument({
    nodes,
    edges,
    meta: { name },
    motion: templateMotion(id, storyTitle, storyDescription, beats),
  });

function flowchart(): DrawCMSDocument {
  const nodes = [
    node("start", "terminator", "Start", 300, 40),
    node("check", "process", "Check input", 300, 150),
    node("valid", "decision", "Valid?", 300, 264, { width: 140, height: 96 }),
    node("error", "process", "Show error", 100, 420),
    node("continue", "process", "Continue", 500, 420),
  ];
  const edges = [
    edge("f1", "start", "check", undefined, down),
    edge("f2", "check", "valid", undefined, down),
    edge("f3", "valid", "error", "No", { sourceHandle: "left", targetHandle: "top" }),
    edge("f4", "valid", "continue", "Yes", { sourceHandle: "right", targetHandle: "top" }),
  ];
  const beats = [
    {
      id: "read-input",
      title: "Read the input",
      description: "The process starts and reads the input it was given.",
      targets: [nodeTarget("start"), nodeTarget("check"), edgeTarget("f1"), edgeTarget("f2")],
    },
    {
      id: "decide",
      title: "Decide if it is valid",
      description: "A single decision splits the flow into the two outcomes below.",
      targets: [nodeTarget("valid")],
    },
    {
      id: "reject",
      title: "Reject invalid input",
      description: "Invalid input takes the No branch and reports an error.",
      targets: [nodeTarget("error"), edgeTarget("f3")],
    },
    {
      id: "accept",
      title: "Continue on success",
      description: "Valid input takes the Yes branch and carries on.",
      targets: [nodeTarget("continue"), edgeTarget("f4")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "flowchart",
    "Flowchart",
    "Input validation",
    "One decision, two outcomes — the shape most processes start from.",
    nodes,
    edges,
    beats,
  );
}

function mindMap(): DrawCMSDocument {
  const nodes = [
    node("project", "mind-topic", "Project", 300, 210),
    node("goals", "mind-branch", "Goals", 60, 60),
    node("people", "mind-branch", "People", 560, 60),
    node("budget", "mind-branch", "Budget", 60, 380),
    node("tasks", "mind-branch", "Tasks", 560, 380),
  ];
  const edges = [
    edge("m1", "project", "goals", undefined, { sourceHandle: "left", targetHandle: "right" }),
    edge("m2", "project", "people", undefined, { sourceHandle: "right", targetHandle: "left" }),
    edge("m3", "project", "budget", undefined, { sourceHandle: "left", targetHandle: "right" }),
    edge("m4", "project", "tasks", undefined, { sourceHandle: "right", targetHandle: "left" }),
  ];
  const beats = [
    {
      id: "centre",
      title: "Start from the centre",
      description: "The subject sits in the middle; everything else hangs off it.",
      targets: [nodeTarget("project")],
    },
    {
      id: "outcomes",
      title: "Branch the outcomes",
      description: "Goals and people describe what you want and who is involved.",
      targets: [nodeTarget("goals"), nodeTarget("people"), edgeTarget("m1"), edgeTarget("m2")],
    },
    {
      id: "constraints",
      title: "Branch the constraints",
      description: "Budget and tasks describe what it costs and what must happen.",
      targets: [nodeTarget("budget"), nodeTarget("tasks"), edgeTarget("m3"), edgeTarget("m4")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "mind-map",
    "Mind map",
    "Project mind map",
    "One subject in the centre with its four main branches.",
    nodes,
    edges,
    beats,
  );
}

function orgChart(): DrawCMSDocument {
  const nodes = [
    node("director", "org-role", "Director", 320, 40),
    node("engineering", "org-role", "Engineering", 120, 200),
    node("sales", "org-role", "Sales", 520, 200),
    node("developers", "org-role", "Developers", 120, 360),
    node("sales-team", "org-role", "Sales team", 520, 360),
  ];
  const edges = [
    edge("o1", "director", "engineering", undefined, down),
    edge("o2", "director", "sales", undefined, down),
    edge("o3", "engineering", "developers", undefined, down),
    edge("o4", "sales", "sales-team", undefined, down),
  ];
  const beats = [
    {
      id: "lead",
      title: "Start at the top",
      description: "The director owns both departments below.",
      targets: [nodeTarget("director")],
    },
    {
      id: "departments",
      title: "Split by department",
      description: "Engineering and sales report to the director.",
      targets: [nodeTarget("engineering"), nodeTarget("sales"), edgeTarget("o1"), edgeTarget("o2")],
    },
    {
      id: "teams",
      title: "Show the teams",
      description: "Each department has the team that does the work.",
      targets: [
        nodeTarget("developers"),
        nodeTarget("sales-team"),
        edgeTarget("o3"),
        edgeTarget("o4"),
      ],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "org-chart",
    "Org chart",
    "Reporting lines",
    "Who reports to whom, two levels deep.",
    nodes,
    edges,
    beats,
  );
}

function erd(): DrawCMSDocument {
  const nodes = [
    node("user", "er-entity", "User", 80, 140, {
      width: 220,
      data: {
        entityAttributes: [
          { id: "user-id", name: "id", isKey: true },
          { id: "user-email", name: "email", isKey: false },
        ],
      },
    }),
    node("post", "er-entity", "Post", 500, 140, {
      width: 220,
      data: {
        entityAttributes: [
          { id: "post-id", name: "id", isKey: true },
          { id: "post-user", name: "user_id (FK)", isKey: false },
        ],
      },
    }),
  ];
  const edges = [edge("r1", "user", "post", "1 → many")];
  const beats = [
    {
      id: "entities",
      title: "Name the entities",
      description: "Each table becomes an entity with its own key.",
      targets: [nodeTarget("user"), nodeTarget("post")],
    },
    {
      id: "relationship",
      title: "State the relationship",
      description: "One user writes many posts; the foreign key lives on Post.",
      targets: [edgeTarget("r1")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "erd",
    "Entity relationship diagram",
    "Users and posts",
    "Two entities, their keys, and the multiplicity between them.",
    nodes,
    edges,
    beats,
  );
}

function dataFlowDiagram(): DrawCMSDocument {
  const nodes = [
    node("user", "dfd-external", "User", 60, 220),
    node("validate", "dfd-process", "Validate", 320, 200),
    node("records", "dfd-store", "Records", 580, 220),
  ];
  const edges = [
    edge("df1", "user", "validate", "Input"),
    edge("df2", "validate", "records", "Valid data"),
  ];
  const beats = [
    {
      id: "input",
      title: "Take the input",
      description: "Data arrives from an external source.",
      targets: [nodeTarget("user"), nodeTarget("validate"), edgeTarget("df1")],
    },
    {
      id: "store",
      title: "Store what passes",
      description: "Only validated data reaches the store.",
      targets: [nodeTarget("records"), edgeTarget("df2")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "data-flow-diagram",
    "Data flow diagram",
    "Validate then store",
    "Source, transform, store — the three roles every data flow has.",
    nodes,
    edges,
    beats,
  );
}

function timelineDiagram(): DrawCMSDocument {
  const nodes = [
    // The axis is the spine the milestones sit on; the milestones carry the story.
    node("axis", "timeline-axis", "", 90, 250, { width: 620 }),
    node("plan", "timeline-milestone", "Jan · Plan", 110, 205),
    node("build", "timeline-milestone", "Mar · Build", 350, 205),
    node("launch", "timeline-milestone", "Jun · Launch", 590, 205),
  ];
  const edges = [edge("t1", "plan", "build"), edge("t2", "build", "launch")];
  const beats = [
    {
      id: "plan",
      title: "Plan in January",
      description: "Scope the work before anything is built.",
      targets: [nodeTarget("plan")],
    },
    {
      id: "build",
      title: "Build through March",
      description: "The bulk of delivery happens here.",
      targets: [nodeTarget("build"), edgeTarget("t1")],
    },
    {
      id: "launch",
      title: "Launch in June",
      description: "The milestone the earlier work was for.",
      targets: [nodeTarget("launch"), edgeTarget("t2")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "timeline-diagram",
    "Timeline",
    "Project milestones",
    "Three dated milestones in the order they happen.",
    nodes,
    edges,
    beats,
  );
}

function classDiagram(): DrawCMSDocument {
  const nodes = [
    node("order", "uml-class", "Order", 80, 140, {
      width: 240,
      data: {
        attributes: [{ id: "order-id", text: "+ id: int" }],
        methods: [{ id: "order-total", text: "+ total(): decimal" }],
      },
    }),
    node("item", "uml-class", "Item", 520, 140, {
      width: 240,
      data: {
        attributes: [{ id: "item-qty", text: "+ qty: int" }],
        methods: [{ id: "item-subtotal", text: "+ subtotal(): decimal" }],
      },
    }),
  ];
  const edges = [edge("c1", "order", "item", "1 → 1..*")];
  const beats = [
    {
      id: "classes",
      title: "Describe the classes",
      description: "Each class lists the fields and operations it owns.",
      targets: [nodeTarget("order"), nodeTarget("item")],
    },
    {
      id: "association",
      title: "Relate them",
      description: "An order holds one or more items.",
      targets: [edgeTarget("c1")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "class-diagram",
    "Class diagram",
    "Order and item",
    "Two classes with real members and the multiplicity between them.",
    nodes,
    edges,
    beats,
  );
}

function stateDiagram(): DrawCMSDocument {
  const nodes = [
    node("begin", "activity-initial", "", 90, 232),
    node("pending", "uml-state", "Pending", 200, 200),
    node("paid", "uml-state", "Paid", 500, 200),
    node("cancelled", "uml-state", "Cancelled", 200, 380),
  ];
  const edges = [
    edge("s1", "begin", "pending"),
    edge("s2", "pending", "paid", "Pay"),
    edge("s3", "pending", "cancelled", "Cancel", down),
  ];
  const beats = [
    {
      id: "enter",
      title: "Enter the first state",
      description: "A new order starts as pending.",
      targets: [nodeTarget("begin"), nodeTarget("pending"), edgeTarget("s1")],
    },
    {
      id: "paid",
      title: "Pay to settle it",
      description: "Payment moves the order to its successful terminal state.",
      targets: [nodeTarget("paid"), edgeTarget("s2")],
    },
    {
      id: "cancelled",
      title: "Or cancel it",
      description: "Cancelling ends the order without payment.",
      targets: [nodeTarget("cancelled"), edgeTarget("s3")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "state-diagram",
    "State diagram",
    "Order states",
    "One state with two exits — the smallest useful state machine.",
    nodes,
    edges,
    beats,
  );
}

function deploymentDiagram(): DrawCMSDocument {
  const nodes = [
    node("app-server", "deployment-node", "App server", 60, 120),
    node("api", "arch-backend", "API", 150, 230),
    node("db-server", "deployment-node", "DB server", 480, 120),
    node("sql", "database", "SQL DB", 570, 225, { width: 130, height: 110 }),
  ];
  const edges = [edge("dp1", "api", "sql", "SQL")];
  const beats = [
    {
      id: "nodes",
      title: "Show the machines",
      description: "Two deployment nodes: the app server and the database server.",
      targets: [nodeTarget("app-server"), nodeTarget("db-server")],
    },
    {
      id: "artifacts",
      title: "Place what runs on them",
      description: "The API runs on the app server; the database runs on its own host.",
      targets: [nodeTarget("api"), nodeTarget("sql")],
    },
    {
      id: "link",
      title: "Connect them",
      description: "The API reaches the database over SQL.",
      targets: [edgeTarget("dp1")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "deployment-diagram",
    "Deployment diagram",
    "Where it runs",
    "Which artifact runs on which machine, and how they talk.",
    nodes,
    edges,
    beats,
  );
}

function componentDiagram(): DrawCMSDocument {
  const nodes = [
    node("checkout", "uml-component", "Checkout", 80, 220),
    node("payments", "uml-component", "Payments", 460, 120),
    node("inventory", "uml-component", "Inventory", 460, 320),
  ];
  const edges = [
    edge("cp1", "checkout", "payments", "«use»"),
    edge("cp2", "checkout", "inventory", "«use»"),
  ];
  const beats = [
    {
      id: "consumer",
      title: "Start with the consumer",
      description: "Checkout is the component that needs the others.",
      targets: [nodeTarget("checkout")],
    },
    {
      id: "dependencies",
      title: "Show what it depends on",
      description: "Checkout uses payments to charge and inventory to reserve stock.",
      targets: [
        nodeTarget("payments"),
        nodeTarget("inventory"),
        edgeTarget("cp1"),
        edgeTarget("cp2"),
      ],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "component-diagram",
    "Component diagram",
    "Checkout dependencies",
    "One component and the two it depends on.",
    nodes,
    edges,
    beats,
  );
}

function useCaseDiagram(): DrawCMSDocument {
  const nodes = [
    node("user", "actor", "User", 80, 240),
    node("shop", "system-boundary", "Shop", 280, 110, { width: 340, height: 300 }),
    node("browse", "use-case", "Browse", 340, 165, { width: 200, height: 90 }),
    node("buy", "use-case", "Buy", 340, 285, { width: 200, height: 90 }),
  ];
  const edges = [edge("u1", "user", "browse"), edge("u2", "user", "buy")];
  const beats = [
    {
      id: "actor",
      title: "Name the actor",
      description: "The user is outside the system boundary.",
      targets: [nodeTarget("user")],
    },
    {
      id: "system",
      title: "Draw the system",
      description: "The boundary holds everything the shop is responsible for.",
      targets: [nodeTarget("shop")],
    },
    {
      id: "goals",
      title: "List the goals",
      description: "Each use case is something the user wants to achieve.",
      targets: [nodeTarget("browse"), nodeTarget("buy"), edgeTarget("u1"), edgeTarget("u2")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "use-case-diagram",
    "Use case diagram",
    "What the user can do",
    "An actor, a system boundary, and the goals inside it.",
    nodes,
    edges,
    beats,
  );
}

function networkDiagram(): DrawCMSDocument {
  const nodes = [
    node("internet", "cloud", "Internet", 60, 230, { width: 150, height: 96 }),
    node("router", "network-router", "Router", 270, 225),
    node("switch", "network-switch", "Switch", 470, 230),
    node("server-a", "network-server", "Server A", 700, 110),
    node("server-b", "network-server", "Server B", 700, 330),
  ];
  const edges = [
    edge("n1", "internet", "router"),
    edge("n2", "router", "switch"),
    edge("n3", "switch", "server-a"),
    edge("n4", "switch", "server-b"),
  ];
  const beats = [
    {
      id: "edge",
      title: "Come in from outside",
      description: "Traffic arrives from the internet at the router.",
      targets: [nodeTarget("internet"), nodeTarget("router"), edgeTarget("n1")],
    },
    {
      id: "distribute",
      title: "Distribute internally",
      description: "The switch spreads traffic across the local network.",
      targets: [nodeTarget("switch"), edgeTarget("n2")],
    },
    {
      id: "hosts",
      title: "Reach the hosts",
      description: "Both servers sit behind the same switch.",
      targets: [nodeTarget("server-a"), nodeTarget("server-b"), edgeTarget("n3"), edgeTarget("n4")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "network-diagram",
    "Network diagram",
    "Traffic path",
    "From the public internet down to the hosts that serve it.",
    nodes,
    edges,
    beats,
  );
}

function activityDiagram(): DrawCMSDocument {
  const nodes = [
    node("begin", "activity-initial", "", 100, 250),
    node("accept", "uml-state", "Accept order", 190, 230),
    node("fork", "activity-fork", "", 400, 262),
    node("pack", "uml-state", "Pack items", 630, 120),
    node("bill", "uml-state", "Prepare bill", 630, 350),
    node("join", "activity-fork", "", 850, 262),
    node("dispatch", "uml-state", "Dispatch", 1080, 230),
    node("finish", "activity-final", "", 1290, 250),
  ];
  const edges = [
    edge("a1", "begin", "accept"),
    edge("a2", "accept", "fork"),
    edge("a3", "fork", "pack"),
    edge("a4", "fork", "bill"),
    edge("a5", "pack", "join"),
    edge("a6", "bill", "join"),
    edge("a7", "join", "dispatch"),
    edge("a8", "dispatch", "finish"),
  ];
  const beats = [
    {
      id: "accept",
      title: "Accept the order",
      description: "The activity starts when an order is accepted.",
      targets: [nodeTarget("begin"), nodeTarget("accept"), edgeTarget("a1")],
    },
    {
      id: "split",
      title: "Split the work",
      description: "Packing and billing happen in parallel after the fork.",
      targets: [
        nodeTarget("fork"),
        nodeTarget("pack"),
        nodeTarget("bill"),
        edgeTarget("a3"),
        edgeTarget("a4"),
      ],
    },
    {
      id: "rejoin",
      title: "Wait for both",
      description: "The join waits until packing and billing are finished.",
      targets: [nodeTarget("join"), edgeTarget("a5"), edgeTarget("a6")],
    },
    {
      id: "dispatch",
      title: "Dispatch and finish",
      description: "With both branches complete the order ships.",
      targets: [nodeTarget("dispatch"), nodeTarget("finish"), edgeTarget("a7"), edgeTarget("a8")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "activity-diagram",
    "Activity diagram",
    "Order fulfilment",
    "A parallel fork and join around two concurrent steps.",
    nodes,
    edges,
    beats,
  );
}

function userFlowDiagram(): DrawCMSDocument {
  const nodes = [
    node("home", "process", "Home", 60, 230),
    node("product", "process", "Product", 240, 230),
    node("cart", "process", "Cart", 420, 230),
    node("signed-in", "decision", "Signed in?", 600, 216, { width: 150, height: 104 }),
    node("checkout", "process", "Checkout", 830, 130),
    node("sign-in", "process", "Sign in", 830, 360),
  ];
  const edges = [
    edge("uf1", "home", "product"),
    edge("uf2", "product", "cart"),
    edge("uf3", "cart", "signed-in"),
    edge("uf4", "signed-in", "checkout", "Yes", {
      sourceHandle: "right",
      targetHandle: "left",
    }),
    edge("uf5", "signed-in", "sign-in", "No", { sourceHandle: "bottom", targetHandle: "left" }),
    edge("uf6", "sign-in", "checkout", undefined, {
      sourceHandle: "right",
      targetHandle: "bottom",
    }),
  ];
  const beats = [
    {
      id: "browse",
      title: "Browse to the cart",
      description: "The visitor moves from the home page to a filled cart.",
      targets: [
        nodeTarget("home"),
        nodeTarget("product"),
        nodeTarget("cart"),
        edgeTarget("uf1"),
        edgeTarget("uf2"),
      ],
    },
    {
      id: "gate",
      title: "Check for an account",
      description: "Checkout needs to know who the visitor is.",
      targets: [nodeTarget("signed-in"), edgeTarget("uf3")],
    },
    {
      id: "happy",
      title: "Signed in already",
      description: "A known visitor goes straight to checkout.",
      targets: [nodeTarget("checkout"), edgeTarget("uf4")],
    },
    {
      id: "detour",
      title: "Sign in first",
      description: "Everyone else signs in and rejoins the same checkout.",
      targets: [nodeTarget("sign-in"), edgeTarget("uf5"), edgeTarget("uf6")],
    },
  ] satisfies TemplateBeat[];
  return templateDoc(
    "user-flow-diagram",
    "User flow diagram",
    "Cart to checkout",
    "The path to checkout, including the sign-in detour.",
    nodes,
    edges,
    beats,
  );
}

const TEMPLATE_BUILDERS: Record<TemplateId, () => DrawCMSDocument> = {
  "architecture-request-flow": architectureRequestFlow,
  "deployment-pipeline": deploymentPipeline,
  "incident-timeline": incidentTimeline,
  "sequence-diagram": sequenceDiagram,
  flowchart,
  "mind-map": mindMap,
  "org-chart": orgChart,
  erd,
  "data-flow-diagram": dataFlowDiagram,
  "timeline-diagram": timelineDiagram,
  "class-diagram": classDiagram,
  "state-diagram": stateDiagram,
  "deployment-diagram": deploymentDiagram,
  "component-diagram": componentDiagram,
  "use-case-diagram": useCaseDiagram,
  "network-diagram": networkDiagram,
  "activity-diagram": activityDiagram,
  "user-flow-diagram": userFlowDiagram,
};

export const TEMPLATES: TemplateDefinition[] = TEMPLATE_CATALOG.map((template) => ({
  id: template.id,
  name: template.name,
  description: template.description,
  build: TEMPLATE_BUILDERS[template.id],
}));

export { GUIDED_TEMPLATE_ID };

export function findTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
