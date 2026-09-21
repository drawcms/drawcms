import type { ReactNode } from "react";
import type { ShapeBackgroundProps } from "./ShapeBackground";

/** Vector artwork shared by canvas nodes, thumbnails, and static exports. */
export function renderDiagramPrimitive({
  type,
  fill,
  stroke,
  strokeWidth,
}: ShapeBackgroundProps): ReactNode | undefined {
  const line = {
    stroke,
    strokeWidth,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinejoin: "round" as const,
  };
  let artwork: ReactNode;
  switch (type) {
    case "mind-topic":
    case "mind-branch":
    case "dfd-process":
      artwork = <ellipse cx="50" cy="50" rx="49" ry="49" fill={fill} {...line} />;
      break;
    case "org-role":
      artwork = (
        <>
          <rect width="100" height="100" rx="6" fill={fill} {...line} />
          <path d="M0 18 H100" {...line} opacity="0.35" />
        </>
      );
      break;
    case "activity-initial":
      artwork = <circle cx="50" cy="50" r="48" fill={stroke} {...line} />;
      break;
    case "activity-final":
      artwork = (
        <>
          <circle cx="50" cy="50" r="48" fill={fill} {...line} />
          <circle cx="50" cy="50" r="34" fill={stroke} />
        </>
      );
      break;
    case "state-history":
      artwork = (
        <>
          <circle cx="50" cy="50" r="48" fill={fill} {...line} />
          <path d="M34 28 V72 M66 28 V72 M34 50 H66" fill="none" {...line} />
        </>
      );
      break;
    case "activity-fork":
    case "activity-fork-v":
      artwork = <rect width="100" height="100" rx="2" fill={stroke} />;
      break;
    case "timeline-axis":
      artwork = (
        <>
          <path d="M0 50 H98 M96 30 L100 50 L96 70" fill="none" {...line} />
        </>
      );
      break;
    case "timeline-milestone":
      artwork = (
        <>
          <path d="M50 0 V100" {...line} />
          <circle cx="50" cy="50" r="12" fill={stroke} />
        </>
      );
      break;
    case "deployment-node":
      artwork = (
        <>
          <path d="M0 12 L12 0 H100 V88 L88 100 H0 Z" fill={fill} {...line} />
          <path d="M0 12 H88 V100 M88 12 L100 0" fill="none" {...line} />
          <path d="M88 12 L100 0 V88 L88 100 Z" fill={stroke} fillOpacity="0.1" />
        </>
      );
      break;
    case "system-boundary":
    case "dfd-external":
      artwork = <rect width="100" height="100" fill={fill} {...line} />;
      break;
    case "dfd-store":
      artwork = (
        <>
          <rect width="100" height="100" fill={fill} />
          <path d="M0 0 H100 M0 100 H100" fill="none" {...line} />
        </>
      );
      break;
    case "network-router":
      artwork = (
        <>
          <path d="M2 26 C2 0 98 0 98 26 V74 C98 100 2 100 2 74 Z" fill={fill} {...line} />
          <ellipse cx="50" cy="26" rx="48" ry="24" fill={fill} {...line} />
          <path d="M25 26 H75 M32 19 L25 26 L32 33 M68 19 L75 26 L68 33" fill="none" {...line} />
        </>
      );
      break;
    case "network-switch":
      artwork = (
        <>
          <rect x="0" y="12" width="100" height="76" rx="7" fill={fill} {...line} />
          <path d="M14 24 H86 M14 40 H86" fill="none" {...line} />
          {[14, 34, 54, 74].map((x) => (
            <rect key={x} x={x} y="56" width="12" height="16" fill={stroke} />
          ))}
        </>
      );
      break;
    case "network-server":
      artwork = (
        <>
          <rect width="100" height="100" rx="7" fill={fill} {...line} />
          {[10, 39, 68].map((y) => (
            <g key={y}>
              <rect x="10" y={y} width="80" height="22" rx="3" fill="none" {...line} />
              <path d={`M20 ${y + 11} H55`} {...line} />
              <circle cx="78" cy={y + 11} r="3" fill={stroke} />
            </g>
          ))}
        </>
      );
      break;
    default:
      return undefined;
  }
  return <g data-semantic-shape={type}>{artwork}</g>;
}
