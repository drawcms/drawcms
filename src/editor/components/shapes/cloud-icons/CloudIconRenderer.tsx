/* eslint-disable @next/next/no-img-element */
import { getCloudIcon } from "./types";

export function CloudIconRenderer({ type }: { type: string }) {
  const icon = getCloudIcon(type);
  if (!icon) return null;
  return (
    <img
      src={icon.iconPath}
      alt={icon.title}
      draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}
