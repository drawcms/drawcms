import type { CloudIconDef } from "./types";

export const INFRA_ICONS: CloudIconDef[] = [
  {
    id: "infra-kubernetes",
    title: "Kubernetes",
    keywords: ["k8s", "container", "orchestration", "cluster"],
    iconPath: "/cloud-icons/infra/kubernetes.png",
  },
  {
    id: "infra-docker",
    title: "Docker",
    keywords: ["container", "image", "dockerfile", "compose"],
    iconPath: "/cloud-icons/infra/docker.png",
  },
  {
    id: "infra-terraform",
    title: "Terraform",
    keywords: ["iac", "infrastructure", "provision", "hashicorp"],
    iconPath: "/cloud-icons/infra/terraform.png",
  },
  {
    id: "infra-nginx",
    title: "Nginx",
    keywords: ["proxy", "web server", "reverse proxy", "load balancer"],
    iconPath: "/cloud-icons/infra/nginx.png",
  },
  {
    id: "infra-redis",
    title: "Redis",
    keywords: ["cache", "in-memory", "key-value", "database"],
    iconPath: "/cloud-icons/infra/redis.png",
  },
  {
    id: "infra-postgresql",
    title: "PostgreSQL",
    keywords: ["database", "sql", "relational", "postgres"],
    iconPath: "/cloud-icons/infra/postgresql.png",
  },
  {
    id: "infra-mongodb",
    title: "MongoDB",
    keywords: ["nosql", "document", "database", "mongo"],
    iconPath: "/cloud-icons/infra/mongodb.png",
  },
  {
    id: "infra-elasticsearch",
    title: "Elasticsearch",
    keywords: ["search", "analytics", "logging", "elk"],
    iconPath: "/cloud-icons/infra/elasticsearch.png",
  },
  {
    id: "infra-rabbitmq",
    title: "RabbitMQ",
    keywords: ["queue", "messaging", "amqp", "broker"],
    iconPath: "/cloud-icons/infra/rabbitmq.png",
  },
  {
    id: "infra-grafana",
    title: "Grafana",
    keywords: ["monitoring", "dashboard", "metrics", "visualization"],
    iconPath: "/cloud-icons/infra/grafana.png",
  },
];
