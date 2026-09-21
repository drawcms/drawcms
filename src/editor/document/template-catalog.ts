/** Lightweight template metadata for menus that must not bundle document builders. */
export const TEMPLATE_CATALOG = [
  {
    id: "architecture-request-flow",
    name: "Architecture request flow",
    description: "How a request travels from a user to your database.",
    thumbnail: "/template-thumbnails/architecture-request-flow.webp",
  },
  {
    id: "deployment-pipeline",
    name: "Deployment pipeline",
    description: "Push → build → stage → prod with animated motion presets.",
    thumbnail: "/template-thumbnails/deployment-pipeline.webp",
  },
  {
    id: "incident-timeline",
    name: "Incident timeline",
    description: "Detect, alert, respond, resolve — for postmortems and playbooks.",
    thumbnail: "/template-thumbnails/incident-timeline.webp",
  },
  {
    id: "sequence-diagram",
    name: "Secure sign-in sequence",
    description:
      "Lifelines, activations, calls, returns, an async event, and an interaction frame.",
    thumbnail: "/template-thumbnails/sequence-diagram.webp",
  },
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Input validation: one decision, two outcomes.",
    thumbnail: "/template-thumbnails/flowchart.webp",
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "One subject in the centre with its four main branches.",
    thumbnail: "/template-thumbnails/mind-map.webp",
  },
  {
    id: "org-chart",
    name: "Org chart",
    description: "Reporting lines, two levels deep.",
    thumbnail: "/template-thumbnails/org-chart.webp",
  },
  {
    id: "erd",
    name: "Entity relationship diagram",
    description: "Two entities, their keys, and the multiplicity between them.",
    thumbnail: "/template-thumbnails/erd.webp",
  },
  {
    id: "data-flow-diagram",
    name: "Data flow diagram",
    description: "Source, transform, store — the three roles of a data flow.",
    thumbnail: "/template-thumbnails/data-flow-diagram.webp",
  },
  {
    id: "timeline-diagram",
    name: "Timeline",
    description: "Three dated milestones in the order they happen.",
    thumbnail: "/template-thumbnails/timeline-diagram.webp",
  },
  {
    id: "class-diagram",
    name: "Class diagram",
    description: "Two classes with real members and their multiplicity.",
    thumbnail: "/template-thumbnails/class-diagram.webp",
  },
  {
    id: "state-diagram",
    name: "State diagram",
    description: "One state with two exits — the smallest useful state machine.",
    thumbnail: "/template-thumbnails/state-diagram.webp",
  },
  {
    id: "deployment-diagram",
    name: "Deployment diagram",
    description: "Which artifact runs on which machine, and how they talk.",
    thumbnail: "/template-thumbnails/deployment-diagram.webp",
  },
  {
    id: "component-diagram",
    name: "Component diagram",
    description: "One component and the two it depends on.",
    thumbnail: "/template-thumbnails/component-diagram.webp",
  },
  {
    id: "use-case-diagram",
    name: "Use case diagram",
    description: "An actor, a system boundary, and the goals inside it.",
    thumbnail: "/template-thumbnails/use-case-diagram.webp",
  },
  {
    id: "network-diagram",
    name: "Network diagram",
    description: "From the public internet down to the hosts that serve it.",
    thumbnail: "/template-thumbnails/network-diagram.webp",
  },
  {
    id: "activity-diagram",
    name: "Activity diagram",
    description: "A parallel fork and join around two concurrent steps.",
    thumbnail: "/template-thumbnails/activity-diagram.webp",
  },
  {
    id: "user-flow-diagram",
    name: "User flow diagram",
    description: "The path to checkout, including the sign-in detour.",
    thumbnail: "/template-thumbnails/user-flow-diagram.webp",
  },
] as const;

export type TemplateCatalogEntry = (typeof TEMPLATE_CATALOG)[number];
export type TemplateId = TemplateCatalogEntry["id"];

/** The guided sample: shortest path to "oh, it moves" (DM-021). */
export const GUIDED_TEMPLATE_ID: TemplateId = "architecture-request-flow";
