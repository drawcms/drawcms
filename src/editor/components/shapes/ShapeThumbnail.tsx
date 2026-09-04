import { ShapeBackground } from "./ShapeBackground";
import { isCloudIconType, getCloudIcon } from "./cloud-icons";
/* eslint-disable @next/next/no-img-element */

interface ShapeThumbnailProps {
  type: string;
  size?: number;
}

export function ShapeThumbnail({ type, size = 36 }: ShapeThumbnailProps) {
  if (type === "text") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="pointer-events-none">
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontSize="52"
          fill="#6b7280"
          fontFamily="sans-serif"
          fontWeight="bold"
        >
          T
        </text>
      </svg>
    );
  }

  if (type === "icon") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6b7280"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none"
      >
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
      </svg>
    );
  }

  if (isCloudIconType(type)) {
    const icon = getCloudIcon(type);
    if (icon) {
      return (
        <img
          src={icon.iconPath}
          alt={icon.title}
          width={size}
          height={size}
          draggable={false}
          className="pointer-events-none object-contain"
        />
      );
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="-4 -4 108 108"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none"
    >
      <ShapeBackground type={type} fill="white" stroke="#6b7280" strokeWidth="2.5" />
    </svg>
  );
}
