import type { ReactNode } from "react";

interface SemanticShapeBackgroundProps {
  type: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
}

type VectorEffect = "non-scaling-stroke";

function ArchitectureSigil({
  type,
  stroke,
  strokeWidth,
  vectorEffect,
}: {
  type: string;
  stroke: string;
  strokeWidth: string;
  vectorEffect: VectorEffect;
}) {
  const lineProps = {
    fill: "none",
    stroke,
    strokeWidth,
    vectorEffect,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "arch-frontend":
      return (
        <g {...lineProps}>
          <rect x="7" y="8" width="25" height="20" rx="3" />
          <line x1="7" y1="14" x2="32" y2="14" />
          <circle cx="11" cy="11" r="0.8" fill={stroke} stroke="none" />
          <circle cx="14" cy="11" r="0.8" fill={stroke} stroke="none" />
        </g>
      );
    case "arch-backend":
      return (
        <g {...lineProps}>
          <rect x="7" y="7" width="25" height="7" rx="2" />
          <rect x="7" y="17" width="25" height="7" rx="2" />
          <rect x="7" y="27" width="25" height="7" rx="2" />
          <circle cx="28" cy="10.5" r="1" fill={stroke} stroke="none" />
          <circle cx="28" cy="20.5" r="1" fill={stroke} stroke="none" />
          <circle cx="28" cy="30.5" r="1" fill={stroke} stroke="none" />
        </g>
      );
    case "arch-database":
      return (
        <g {...lineProps}>
          <path d="M8 12 C8 7 31 7 31 12 V29 C31 34 8 34 8 29 Z" />
          <ellipse cx="19.5" cy="12" rx="11.5" ry="4" />
          <path d="M8 20 C8 25 31 25 31 20" />
        </g>
      );
    case "arch-cloud":
      return (
        <path
          d="M8 27 C4 20 9 15 15 16 C17 8 28 8 30 17 C37 17 39 27 32 30 H13 C10 30 9 29 8 27 Z"
          {...lineProps}
        />
      );
    case "arch-security":
      return (
        <g {...lineProps}>
          <path d="M20 7 L32 12 V20 C32 28 27 33 20 36 C13 33 8 28 8 20 V12 Z" />
          <path d="M15 21 L19 25 L26 17" />
        </g>
      );
    case "arch-messagebus":
      return (
        <g {...lineProps}>
          <line x1="8" y1="20" x2="32" y2="20" />
          <circle cx="10" cy="20" r="4" fill="white" />
          <circle cx="20" cy="20" r="4" fill="white" />
          <circle cx="30" cy="20" r="4" fill="white" />
          <line x1="10" y1="24" x2="10" y2="31" />
          <line x1="20" y1="24" x2="20" y2="31" />
          <line x1="30" y1="24" x2="30" y2="31" />
        </g>
      );
    case "arch-external":
      return (
        <g {...lineProps}>
          <rect x="7" y="12" width="21" height="21" rx="3" />
          <path d="M20 8 H33 V21" />
          <path d="M33 8 L18 23" />
        </g>
      );
    default:
      return null;
  }
}

function renderArchitecture({ type, fill, stroke, strokeWidth }: SemanticShapeBackgroundProps) {
  const vectorEffect: VectorEffect = "non-scaling-stroke";
  return (
    <g data-semantic-shape={type}>
      <rect
        width="100"
        height="100"
        rx="12"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect={vectorEffect}
      />
      {/* The card intentionally stretches to a landscape aspect ratio. Keep
          its sigil in a nested square viewport so circles, clouds, and server
          racks retain their geometry instead of stretching with the card. */}
      <svg
        x="5"
        y="5"
        width="35"
        height="35"
        viewBox="0 0 40 40"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect width="40" height="40" rx="8" fill={stroke} fillOpacity="0.08" />
        <ArchitectureSigil
          type={type}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect={vectorEffect}
        />
      </svg>
      <path
        d="M8 86 H92"
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        strokeOpacity="0.28"
        vectorEffect={vectorEffect}
      />
    </g>
  );
}

function renderSequence({ type, fill, stroke, strokeWidth }: SemanticShapeBackgroundProps) {
  const vectorEffect: VectorEffect = "non-scaling-stroke";
  const lineProps = {
    fill: "none",
    stroke,
    strokeWidth,
    vectorEffect,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "sequence-frame":
      return (
        <g data-semantic-shape={type}>
          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            rx="4"
            fill={fill}
            fillOpacity="0.55"
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
          <path d="M2 2 H32 L38 8 L32 14 H2" {...lineProps} />
        </g>
      );
    case "sequence-actor":
      return (
        <g data-semantic-shape={type}>
          <svg
            x="23"
            y="2"
            width="54"
            height="28"
            viewBox="0 0 54 54"
            preserveAspectRatio="xMidYMid meet"
          >
            <g {...lineProps}>
              <circle cx="27" cy="11" r="8" fill={fill} />
              <path d="M27 19 V36 M14 25 H40 M27 36 L16 51 M27 36 L38 51" />
            </g>
          </svg>
          <line x1="50" y1="38" x2="50" y2="98" strokeDasharray="5 5" {...lineProps} />
        </g>
      );
    case "sequence-participant":
      return (
        <g data-semantic-shape={type}>
          <rect
            x="4"
            y="2"
            width="92"
            height="14"
            rx="3"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
          <line x1="50" y1="16" x2="50" y2="98" strokeDasharray="5 5" {...lineProps} />
        </g>
      );
    case "sequence-activation":
      return (
        <g data-semantic-shape={type}>
          <rect
            x="42"
            y="23"
            width="16"
            height="55"
            rx="2"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        </g>
      );
    case "sequence-message":
      return (
        <g data-semantic-shape={type}>
          <path d="M3 70 H91" {...lineProps} />
          <path d="M91 62 L98 70 L91 78 Z" fill={stroke} stroke="none" />
        </g>
      );
    case "sequence-message-async":
      return (
        <g data-semantic-shape={type}>
          <path d="M3 70 H97 M88 61 L97 70 L88 79" {...lineProps} />
        </g>
      );
    case "sequence-message-return":
      return (
        <g data-semantic-shape={type}>
          <path d="M97 70 H3 M12 61 L3 70 L12 79" strokeDasharray="7 4" {...lineProps} />
        </g>
      );
    case "sequence-message-self":
      return (
        <g data-semantic-shape={type}>
          <path d="M28 52 H82 V82 H38" {...lineProps} />
          <path d="M47 73 L38 82 L47 91" {...lineProps} />
        </g>
      );
    case "sequence-reference":
      return (
        <g data-semantic-shape={type}>
          <rect
            x="2"
            y="8"
            width="96"
            height="84"
            rx="4"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
          <path d="M2 8 H31 L39 20 L31 32 H2" {...lineProps} />
          <text x="17" y="23" fill={stroke} fontSize="11" fontWeight="700" textAnchor="middle">
            ref
          </text>
        </g>
      );
    case "sequence-note":
      return (
        <g data-semantic-shape={type}>
          <path d="M8 5 H78 L94 22 V95 H8 Z" {...lineProps} fill={fill} />
          <path d="M78 5 V22 H94" {...lineProps} />
        </g>
      );
    case "sequence-time":
      return (
        <g data-semantic-shape={type}>
          <circle
            cx="50"
            cy="50"
            r="38"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
          <path d="M50 28 V51 L65 61" {...lineProps} />
          <path d="M50 8 V15 M50 85 V92 M8 50 H15 M85 50 H92" {...lineProps} />
        </g>
      );
    case "sequence-destroy":
      return (
        <g data-semantic-shape={type}>
          <line x1="50" y1="2" x2="50" y2="55" strokeDasharray="5 5" {...lineProps} />
          <path d="M25 58 L75 88 M75 58 L25 88" {...lineProps} />
        </g>
      );
    default:
      return undefined;
  }
}

function renderBoundary({ type, fill, stroke, strokeWidth }: SemanticShapeBackgroundProps) {
  const vectorEffect: VectorEffect = "non-scaling-stroke";
  const dash =
    type === "boundary-security-group"
      ? "7 4"
      : type === "boundary-trust"
        ? "12 5"
        : type === "boundary-deployment"
          ? "2 4"
          : type === "boundary-data"
            ? "9 3 2 3"
            : undefined;
  return (
    <g data-semantic-shape={type}>
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="8"
        fill={fill}
        fillOpacity="0.55"
        stroke={stroke}
        strokeWidth={type === "boundary-trust" ? String(Number(strokeWidth) * 1.5) : strokeWidth}
        strokeDasharray={dash}
        vectorEffect={vectorEffect}
      />
      <rect x="8" y="8" width="30" height="12" rx="3" fill={stroke} fillOpacity="0.12" />
      {type === "boundary-data" && (
        <path
          d="M84 11 V8 A6 6 0 0 0 72 8 V11 M70 11 H86 V24 H70 Z"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect={vectorEffect}
        />
      )}
    </g>
  );
}

function renderLifecycle({ type, fill, stroke, strokeWidth }: SemanticShapeBackgroundProps) {
  const vectorEffect: VectorEffect = "non-scaling-stroke";
  const lineProps = {
    fill: "none",
    stroke,
    strokeWidth: String(Number(strokeWidth) * 1.35),
    vectorEffect,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const card = (icon: ReactNode, dashed = false) => (
    <g data-semantic-shape={type}>
      <rect
        x="5"
        y="12"
        width="90"
        height="76"
        rx="18"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? "7 4" : undefined}
        vectorEffect={vectorEffect}
      />
      {icon}
    </g>
  );

  switch (type) {
    case "lifecycle-start":
      return (
        <g data-semantic-shape={type}>
          <circle cx="50" cy="50" r="38" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
          <circle cx="50" cy="50" r="11" fill={stroke} />
        </g>
      );
    case "lifecycle-active":
      return card(<path d="M42 34 L68 50 L42 66 Z" fill={stroke} stroke="none" />);
    case "lifecycle-waiting":
      return card(
        <g {...lineProps}>
          <circle cx="50" cy="50" r="20" />
          <path d="M50 38 V51 L60 57" />
        </g>,
      );
    case "lifecycle-decision":
      return (
        <g data-semantic-shape={type}>
          <polygon
            points="50,4 96,50 50,96 4,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
          <path d="M50 29 C39 29 38 43 47 47 C52 49 53 53 53 58 M53 68 H53.1" {...lineProps} />
        </g>
      );
    case "lifecycle-success":
      return card(<path d="M32 51 L44 63 L69 37" {...lineProps} />);
    case "lifecycle-failure":
      return card(<path d="M34 34 L66 66 M66 34 L34 66" {...lineProps} />);
    case "lifecycle-neutral":
      return card(<path d="M34 50 H66" {...lineProps} />);
    case "lifecycle-external":
      return card(<path d="M36 64 L64 36 M48 36 H64 V52" {...lineProps} />, true);
    default:
      return undefined;
  }
}

function renderDataFlow({ type, fill, stroke, strokeWidth }: SemanticShapeBackgroundProps) {
  const vectorEffect: VectorEffect = "non-scaling-stroke";
  const lineProps = {
    fill: "none",
    stroke,
    strokeWidth,
    vectorEffect,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "data-stage":
      return (
        <g data-semantic-shape={type}>
          <rect x="2" y="2" width="96" height="96" rx="8" {...lineProps} fill={fill} />
          <path d="M2 24 H98" {...lineProps} />
          <circle cx="12" cy="13" r="3" fill={stroke} stroke="none" />
          <path d="M21 13 H48" strokeOpacity="0.65" {...lineProps} />
        </g>
      );
    case "data-source":
      return (
        <g data-semantic-shape={type}>
          <path d="M12 20 C12 8 88 8 88 20 V80 C88 92 12 92 12 80 Z" {...lineProps} fill={fill} />
          <ellipse cx="50" cy="20" rx="38" ry="11" {...lineProps} fill={fill} />
          <path d="M62 55 H92 M83 46 L92 55 L83 64" {...lineProps} />
        </g>
      );
    case "data-transform":
      return (
        <g data-semantic-shape={type}>
          <polygon points="25,8 75,8 96,50 75,92 25,92 4,50" {...lineProps} fill={fill} />
          <path
            d="M29 43 H61 M53 34 L62 43 L53 52 M71 57 H39 M47 48 L38 57 L47 66"
            {...lineProps}
          />
        </g>
      );
    case "data-store":
      return (
        <g data-semantic-shape={type}>
          <path d="M12 20 C12 8 88 8 88 20 V80 C88 92 12 92 12 80 Z" {...lineProps} fill={fill} />
          <ellipse cx="50" cy="20" rx="38" ry="11" {...lineProps} fill={fill} />
          <path d="M12 68 C12 80 88 80 88 68" {...lineProps} />
        </g>
      );
    case "data-stream":
      return (
        <g data-semantic-shape={type}>
          <rect x="8" y="16" width="84" height="68" rx="9" {...lineProps} fill={fill} />
          <path d="M22 35 H78 M22 50 H78 M22 65 H78" {...lineProps} />
          <path d="M70 29 L78 35 L70 41 M70 44 L78 50 L70 56 M70 59 L78 65 L70 71" {...lineProps} />
        </g>
      );
    case "data-sink":
      return (
        <g data-semantic-shape={type}>
          <path d="M10 15 H90 L62 53 V84 L38 92 V53 Z" {...lineProps} fill={fill} />
          <path d="M26 31 H74" {...lineProps} />
        </g>
      );
    case "data-protected":
      return (
        <g data-semantic-shape={type}>
          <rect x="14" y="35" width="72" height="55" rx="9" {...lineProps} fill={fill} />
          <path d="M29 35 V26 C29 14 39 7 50 7 C61 7 71 14 71 26 V35" {...lineProps} />
          <circle cx="50" cy="59" r="6" {...lineProps} />
          <path d="M50 65 V76" {...lineProps} />
        </g>
      );
    default:
      return undefined;
  }
}

function renderAnnotation({ type, fill, stroke, strokeWidth }: SemanticShapeBackgroundProps) {
  const vectorEffect: VectorEffect = "non-scaling-stroke";
  const lineProps = {
    fill: "none",
    stroke,
    strokeWidth,
    vectorEffect,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "annotation-owner":
      return (
        <g data-semantic-shape={type}>
          <rect x="3" y="8" width="94" height="84" rx="42" {...lineProps} fill={fill} />
          <svg
            x="7"
            y="20"
            width="28"
            height="60"
            viewBox="0 0 40 40"
            preserveAspectRatio="xMidYMid meet"
          >
            <circle cx="20" cy="20" r="18" {...lineProps} fill={stroke} fillOpacity="0.14" />
            <circle cx="20" cy="15" r="6" {...lineProps} />
            <path d="M9 32 C12 22 28 22 31 32" {...lineProps} />
          </svg>
        </g>
      );
    case "annotation-technology":
      return (
        <g data-semantic-shape={type}>
          <path d="M18 18 H82 L96 50 L82 82 H18 L4 50 Z" {...lineProps} fill={fill} />
          <svg
            x="7"
            y="25"
            width="27"
            height="50"
            viewBox="0 0 40 40"
            preserveAspectRatio="xMidYMid meet"
          >
            <path d="M14 10 L4 20 L14 30 M26 10 L36 20 L26 30 M24 4 L16 36" {...lineProps} />
          </svg>
        </g>
      );
    case "annotation-legend":
      return (
        <g data-semantic-shape={type}>
          <rect x="6" y="6" width="88" height="88" rx="8" {...lineProps} fill={fill} />
          <circle cx="23" cy="43" r="6" {...lineProps} fill={stroke} fillOpacity="0.18" />
          <rect
            x="17"
            y="60"
            width="12"
            height="12"
            rx="2"
            {...lineProps}
            fill={stroke}
            fillOpacity="0.18"
          />
          <path d="M17 84 H29" {...lineProps} />
          <path d="M38 43 H78 M38 66 H78 M38 84 H78" strokeOpacity="0.7" {...lineProps} />
        </g>
      );
    case "annotation-source":
      return (
        <g data-semantic-shape={type}>
          <path d="M18 5 H68 L86 23 V95 H18 Z" {...lineProps} fill={fill} />
          <path d="M68 5 V23 H86" {...lineProps} />
          <path d="M42 55 L31 65 L42 75 M62 55 L73 65 L62 75 M57 47 L47 83" {...lineProps} />
        </g>
      );
    case "annotation-summary":
      return (
        <g data-semantic-shape={type}>
          <rect x="5" y="5" width="90" height="90" rx="8" {...lineProps} fill={fill} />
          <rect x="5" y="5" width="90" height="22" rx="8" fill={stroke} fillOpacity="0.12" />
          <path d="M18 47 H82 M18 62 H72 M18 77 H79" strokeOpacity="0.7" {...lineProps} />
          <circle cx="13" cy="47" r="1.5" fill={stroke} stroke="none" />
          <circle cx="13" cy="62" r="1.5" fill={stroke} stroke="none" />
          <circle cx="13" cy="77" r="1.5" fill={stroke} stroke="none" />
        </g>
      );
    case "annotation-callout":
      return (
        <g data-semantic-shape={type}>
          <path d="M5 10 H95 V72 H45 L24 94 L30 72 H5 Z" {...lineProps} fill={fill} />
          <circle cx="22" cy="50" r="3" fill={stroke} stroke="none" />
          <path d="M33 50 H78 M22 62 H70" {...lineProps} />
        </g>
      );
    default:
      return undefined;
  }
}

export function renderSemanticShape(props: SemanticShapeBackgroundProps): ReactNode | undefined {
  if (props.type.startsWith("arch-")) return renderArchitecture(props);
  if (props.type.startsWith("sequence-")) return renderSequence(props);
  if (props.type.startsWith("boundary-")) return renderBoundary(props);
  if (props.type.startsWith("lifecycle-")) return renderLifecycle(props);
  if (props.type.startsWith("data-")) return renderDataFlow(props);
  if (props.type.startsWith("annotation-")) return renderAnnotation(props);
  return undefined;
}
