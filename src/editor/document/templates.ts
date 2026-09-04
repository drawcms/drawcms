import { createDocument } from "./serialize";
import type { DrawCMSDocument } from "./schema";
import type { MotionState } from "../motion/model";
import { getSemanticStyleDefaults } from "../components/shapes/semantic-elements";
import type { StoryTarget } from "../story/model";
import type { AppEdge, AppNode, AppNodeData, EdgeBend, EdgeRoutingMode } from "../types";
import type { SequenceEdgeType } from "../types";
import { createSequenceEdge, sequenceActivationBounds } from "../sequence-edges";
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
    shape("user", "actor", "User", 40, 200),
    shape("lb", "cloud", "Load Balancer", 260, 200),
    shape("api", "process", "API", 480, 200),
    shape("db", "cylinder", "Database", 700, 200),
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
    shape("git", "folder", "Repo", 40, 160),
    shape("ci", "process", "CI", 260, 160),
    shape("stage", "cloud", "Staging", 480, 160),
    shape("prod", "cloud", "Prod", 700, 160),
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

const TEMPLATE_BUILDERS: Record<TemplateId, () => DrawCMSDocument> = {
  "architecture-request-flow": architectureRequestFlow,
  "deployment-pipeline": deploymentPipeline,
  "incident-timeline": incidentTimeline,
  "sequence-diagram": sequenceDiagram,
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
