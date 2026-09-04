export interface CloudIconDef {
  id: string;
  title: string;
  keywords: string[];
  iconPath: string;
}

import { AWS_ICONS } from "./aws-icons";
import { GCP_ICONS } from "./gcp-icons";
import { AZURE_ICONS } from "./azure-icons";
import { INFRA_ICONS } from "./infra-icons";

export const ALL_CLOUD_ICONS: CloudIconDef[] = [
  ...AWS_ICONS,
  ...GCP_ICONS,
  ...AZURE_ICONS,
  ...INFRA_ICONS,
];

const CLOUD_ICON_REGISTRY = new Map<string, CloudIconDef>();
for (const icon of ALL_CLOUD_ICONS) {
  CLOUD_ICON_REGISTRY.set(icon.id, icon);
}

export function isCloudIconType(type: string): boolean {
  return (
    type.startsWith("aws-") ||
    type.startsWith("gcp-") ||
    type.startsWith("azure-") ||
    type.startsWith("infra-")
  );
}

export function getCloudIcon(type: string): CloudIconDef | undefined {
  return CLOUD_ICON_REGISTRY.get(type);
}

export { AWS_ICONS } from "./aws-icons";
export { GCP_ICONS } from "./gcp-icons";
export { AZURE_ICONS } from "./azure-icons";
export { INFRA_ICONS } from "./infra-icons";
