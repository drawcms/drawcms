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
] as const;

export type TemplateCatalogEntry = (typeof TEMPLATE_CATALOG)[number];
export type TemplateId = TemplateCatalogEntry["id"];

/** The guided sample: shortest path to "oh, it moves" (DM-021). */
export const GUIDED_TEMPLATE_ID: TemplateId = "architecture-request-flow";
