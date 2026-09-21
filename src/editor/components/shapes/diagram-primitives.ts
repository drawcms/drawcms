import type { SemanticShapeCategory } from "./semantic-elements";

/** Native diagram symbols. IDs remain stable in saved documents. */
export const DIAGRAM_PRIMITIVE_GROUPS: SemanticShapeCategory[] = [
  {
    id: "planning",
    title: "Mind Map, Org Chart & Timeline",
    representativeShapeId: "mind-topic",
    shapes: [
      {
        id: "mind-topic",
        title: "Central Topic",
        defaultLabel: "Project",
        keywords: ["mind map", "idea", "root"],
      },
      {
        id: "mind-branch",
        title: "Branch Topic",
        defaultLabel: "Idea",
        keywords: ["mind map", "subtopic"],
      },
      {
        id: "org-role",
        title: "Org Role",
        defaultLabel: "Team",
        keywords: ["org chart", "person", "department", "hierarchy"],
      },
      {
        id: "timeline-axis",
        title: "Timeline Axis",
        defaultLabel: "",
        keywords: ["timeline", "time", "roadmap"],
      },
      {
        id: "timeline-milestone",
        title: "Milestone",
        defaultLabel: "Milestone",
        keywords: ["timeline", "date", "launch"],
      },
    ],
  },
  {
    id: "activity",
    title: "State & Activity",
    representativeShapeId: "activity-final",
    shapes: [
      {
        id: "activity-initial",
        title: "Initial State",
        defaultLabel: "",
        keywords: ["start", "state", "activity"],
      },
      {
        id: "activity-final",
        title: "Final State",
        defaultLabel: "",
        keywords: ["end", "stop", "state", "activity"],
      },
      {
        id: "activity-fork",
        title: "Fork / Join",
        defaultLabel: "",
        keywords: ["parallel", "synchronization", "activity"],
      },
      {
        id: "activity-fork-v",
        title: "Vertical Fork / Join",
        defaultLabel: "",
        keywords: ["parallel", "synchronization", "activity"],
      },
      {
        id: "state-history",
        title: "History State",
        defaultLabel: "",
        keywords: ["state", "resume", "history"],
      },
    ],
  },
  {
    id: "deployment",
    title: "Deployment & Use Case",
    representativeShapeId: "deployment-node",
    shapes: [
      {
        id: "deployment-node",
        title: "Deployment Node",
        defaultLabel: "Server",
        keywords: ["device", "execution environment", "deployment", "host"],
      },
      {
        id: "system-boundary",
        title: "System Boundary",
        defaultLabel: "System",
        keywords: ["use case", "scope", "container"],
      },
    ],
  },
  {
    id: "network",
    title: "Network",
    representativeShapeId: "network-router",
    shapes: [
      { id: "network-router", title: "Router", keywords: ["network", "gateway", "routing"] },
      { id: "network-switch", title: "Switch", keywords: ["network", "ethernet", "ports"] },
      { id: "network-server", title: "Server", keywords: ["network", "host", "rack"] },
    ],
  },
  {
    id: "dfd",
    title: "Data Flow Notation",
    representativeShapeId: "dfd-store",
    shapes: [
      {
        id: "dfd-external",
        title: "External Entity",
        defaultLabel: "User",
        keywords: ["dfd", "data flow", "source", "destination"],
      },
      {
        id: "dfd-process",
        title: "DFD Process",
        defaultLabel: "Validate",
        keywords: ["dfd", "data flow", "transform"],
      },
      {
        id: "dfd-store",
        title: "Data Store",
        defaultLabel: "Records",
        keywords: ["dfd", "data flow", "storage"],
      },
    ],
  },
];

export const DIAGRAM_PRIMITIVE_SIZES: Record<string, { width: number; height: number }> = {
  "mind-topic": { width: 180, height: 100 },
  "mind-branch": { width: 140, height: 72 },
  "org-role": { width: 180, height: 80 },
  "timeline-axis": { width: 360, height: 40 },
  "timeline-milestone": { width: 100, height: 90 },
  "activity-initial": { width: 40, height: 40 },
  "activity-final": { width: 40, height: 40 },
  "activity-fork": { width: 180, height: 16 },
  "activity-fork-v": { width: 16, height: 180 },
  "state-history": { width: 48, height: 48 },
  "deployment-node": { width: 320, height: 240 },
  "system-boundary": { width: 320, height: 240 },
  "network-router": { width: 140, height: 110 },
  "network-switch": { width: 160, height: 100 },
  "network-server": { width: 100, height: 142 },
  "dfd-external": { width: 140, height: 80 },
  "dfd-process": { width: 120, height: 120 },
  "dfd-store": { width: 160, height: 80 },
};
