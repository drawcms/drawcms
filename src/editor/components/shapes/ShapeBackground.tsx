import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from "react";
import { renderSemanticShape } from "./SemanticShapeBackground";

export interface ShapeBackgroundProps {
  type: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
  borderRadius?: number;
  onClick?: SVGProps<SVGElement>["onClick"];
  onDoubleClick?: SVGProps<SVGElement>["onDoubleClick"];
}

type ShapeInteractionProps = Pick<SVGProps<SVGElement>, "onClick" | "onDoubleClick">;

function addShapeInteraction(artwork: ReactNode, interaction: ShapeInteractionProps): ReactNode {
  if (!isValidElement<SVGProps<SVGElement>>(artwork)) return artwork;

  const clone = (element: ReactElement<SVGProps<SVGElement>>) => cloneElement(element, interaction);
  if (artwork.type !== Fragment) return clone(artwork);

  const children = (artwork.props as { children?: ReactNode }).children;
  return Children.map(children, (child) =>
    isValidElement<SVGProps<SVGElement>>(child) ? clone(child) : child,
  );
}

export function ShapeBackground({
  type,
  fill = "white",
  stroke = "#4b5563",
  strokeWidth = "2",
  borderRadius,
  onClick,
  onDoubleClick,
}: ShapeBackgroundProps) {
  const vectorEffect = "non-scaling-stroke" as const;

  const artwork = (() => {
    const semanticArtwork = renderSemanticShape({ type, fill, stroke, strokeWidth });
    if (semanticArtwork !== undefined) return semanticArtwork;

    switch (type) {
      case "rect":
      case "process":
        return (
          <rect
            width="100"
            height="100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "round-rect":
        return (
          <rect
            width="100"
            height="100"
            rx="15"
            ry="30"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "circle":
      case "use-case":
        return (
          <ellipse
            cx="50"
            cy="50"
            rx="50"
            ry="50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "diamond":
      case "decision":
        return (
          <polygon
            points="50,0 100,50 50,100 0,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "triangle":
        return (
          <polygon
            points="50,0 100,100 0,100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "hexagon":
        return (
          <polygon
            points="25,0 75,0 100,50 75,100 25,100 0,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "octagon":
        return (
          <polygon
            points="30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "data":
        return (
          <polygon
            points="20,100 100,100 80,0 0,0"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "document":
        return (
          <path
            d="M0,0 H100 V80 Q75,100 50,80 T0,80 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "terminator":
        return (
          <rect
            width="100"
            height="100"
            rx="50"
            ry="50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "predefined":
        return (
          <>
            <rect
              width="100"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="15"
              y1="0"
              x2="15"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="85"
              y1="0"
              x2="85"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "internal-storage":
        return (
          <>
            <rect
              width="100"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="20"
              x2="100"
              y2="20"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="20"
              y1="0"
              x2="20"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "delay":
        return (
          <path
            d="M0,0 H50 A50,50 0 0,1 50,100 H0 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "manual-input":
        return (
          <polygon
            points="0,20 100,0 100,100 0,100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "manual-operation":
        return (
          <polygon
            points="20,0 100,0 80,100 0,100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "display":
        return (
          <path
            d="M20,0 H80 A20,50 0 0,1 80,100 H20 L0,50 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "preparation":
        return (
          <polygon
            points="20,0 80,0 100,50 80,100 20,100 0,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "loop-limit":
        return (
          <path
            d="M0,20 L20,0 H80 L100,20 V100 H0 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "database":
      case "cylinder":
        return (
          <>
            <path
              d="M0,15 A50,15 0 0,0 100,15 V85 A50,15 0 0,1 0,85 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <ellipse
              cx="50"
              cy="15"
              rx="50"
              ry="15"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "cloud":
        return (
          <path
            d="M 20,60 A 20,20 0 0,1 40,40 A 20,20 0 0,1 70,40 A 20,20 0 0,1 90,60 A 20,20 0 0,1 70,90 H 30 A 20,20 0 0,1 20,60 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "star":
        return (
          <polygon
            points="50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "image":
        return (
          <>
            <rect
              width="100"
              height="100"
              rx="8"
              ry="8"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <circle
              cx="30"
              cy="35"
              r="10"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <polyline
              points="10,80 35,55 55,70 70,50 90,75"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "group":
        return (
          <rect
            width="100"
            height="100"
            rx={borderRadius ?? 8}
            ry={borderRadius ?? 8}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "folder":
        return (
          <>
            <path
              d="M0,15 H40 L50,5 H100 V100 H0 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="25"
              x2="100"
              y2="25"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "actor":
        return (
          <>
            <circle
              cx="50"
              cy="20"
              r="15"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="50"
              y1="35"
              x2="50"
              y2="70"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="20"
              y1="50"
              x2="80"
              y2="50"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="50"
              y1="70"
              x2="25"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="50"
              y1="70"
              x2="75"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "swimlane-h":
        return (
          <>
            <rect
              width="100"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="20"
              y1="0"
              x2="20"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "swimlane-v":
        return (
          <>
            <rect
              width="100"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="20"
              x2="100"
              y2="20"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="50"
              y1="0"
              x2="50"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "dashed-box":
        return (
          <rect
            width="100"
            height="100"
            rx={borderRadius ?? 6}
            ry={borderRadius ?? 6}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray="8 4"
            vectorEffect={vectorEffect}
          />
        );
      case "table":
        return (
          <>
            <rect
              width="100"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <rect
              width="100"
              height="25"
              fill="#e5e7eb"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke={stroke}
              strokeWidth="1"
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="75"
              x2="100"
              y2="75"
              stroke={stroke}
              strokeWidth="1"
              vectorEffect={vectorEffect}
            />
            <line
              x1="40"
              y1="25"
              x2="40"
              y2="100"
              stroke={stroke}
              strokeWidth="1"
              vectorEffect={vectorEffect}
            />
          </>
        );
      // ── General / Misc shapes ──
      case "pentagon":
        return (
          <polygon
            points="50,0 100,38 82,100 18,100 0,38"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "parallelogram":
        return (
          <polygon
            points="25,0 100,0 75,100 0,100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "trapezoid":
        return (
          <polygon
            points="20,0 80,0 100,100 0,100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "cross":
        return (
          <polygon
            points="35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "callout":
        return (
          <path
            d="M0,0 H100 V70 H40 L20,100 L30,70 H0 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "note":
        return (
          <>
            <path
              d="M0,0 H75 L100,25 V100 H0 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <path
              d="M75,0 V25 H100"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "card":
        return (
          <path
            d="M25,0 H100 V100 H0 V25 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "tape":
        return (
          <path
            d="M0,20 Q25,0 50,20 T100,20 V80 Q75,100 50,80 T0,80 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "step":
        return (
          <polygon
            points="0,0 80,0 100,50 80,100 0,100 20,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "banner":
        return (
          <path
            d="M10,10 H90 V70 L50,90 L10,70 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );

      // ── Arrow shapes ──
      case "arrow-right":
        return (
          <polygon
            points="0,25 65,25 65,0 100,50 65,100 65,75 0,75"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "arrow-left":
        return (
          <polygon
            points="100,25 35,25 35,0 0,50 35,100 35,75 100,75"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "arrow-up":
        return (
          <polygon
            points="25,100 25,35 0,35 50,0 100,35 75,35 75,100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "arrow-down":
        return (
          <polygon
            points="25,0 25,65 0,65 50,100 100,65 75,65 75,0"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "arrow-double-h":
        return (
          <polygon
            points="0,50 25,0 25,30 75,30 75,0 100,50 75,100 75,70 25,70 25,100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "arrow-double-v":
        return (
          <polygon
            points="50,0 100,25 70,25 70,75 100,75 50,100 0,75 30,75 30,25 0,25"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "chevron":
        return (
          <polygon
            points="0,0 75,0 100,50 75,100 0,100 25,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "notched-arrow":
        return (
          <polygon
            points="0,25 70,25 70,0 100,50 70,100 70,75 0,75 15,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );

      // ── UML shapes ──
      case "uml-class":
        return (
          <>
            <rect
              width="100"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="30"
              x2="100"
              y2="30"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="65"
              x2="100"
              y2="65"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "uml-component":
        return (
          <>
            <rect
              x="10"
              y="0"
              width="90"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <rect
              x="0"
              y="15"
              width="20"
              height="12"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <rect
              x="0"
              y="45"
              width="20"
              height="12"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "uml-interface":
        return (
          <>
            <circle
              cx="50"
              cy="30"
              r="20"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "uml-package":
        return (
          <>
            <rect
              x="0"
              y="0"
              width="40"
              height="15"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <rect
              x="0"
              y="15"
              width="100"
              height="85"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "uml-state":
        return (
          <rect
            width="100"
            height="100"
            rx="20"
            ry="20"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "uml-object":
        return (
          <>
            <rect
              width="100"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="0"
              y1="35"
              x2="100"
              y2="35"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "uml-note":
        return (
          <>
            <path
              d="M0,0 H75 L100,25 V100 H0 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <path
              d="M75,0 V25 H100"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "uml-artifact":
        return (
          <>
            <path
              d="M0,0 H70 L100,30 V100 H0 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <path
              d="M70,0 V30 H100"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <circle cx="30" cy="60" r="3" fill={stroke} stroke="none" />
            <circle cx="30" cy="75" r="3" fill={stroke} stroke="none" />
          </>
        );

      // ── BPMN shapes ──
      case "bpmn-start":
        return (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "bpmn-end":
        return (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill={fill}
            stroke={stroke}
            strokeWidth={String(Number(strokeWidth) * 2)}
            vectorEffect={vectorEffect}
          />
        );
      case "bpmn-intermediate":
        return (
          <>
            <circle
              cx="50"
              cy="50"
              r="45"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "bpmn-task":
        return (
          <rect
            width="100"
            height="100"
            rx="12"
            ry="12"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "bpmn-gateway-exclusive":
        return (
          <>
            <polygon
              points="50,0 100,50 50,100 0,50"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="35"
              y1="35"
              x2="65"
              y2="65"
              stroke={stroke}
              strokeWidth={String(Number(strokeWidth) * 1.5)}
              vectorEffect={vectorEffect}
            />
            <line
              x1="65"
              y1="35"
              x2="35"
              y2="65"
              stroke={stroke}
              strokeWidth={String(Number(strokeWidth) * 1.5)}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "bpmn-gateway-parallel":
        return (
          <>
            <polygon
              points="50,0 100,50 50,100 0,50"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="50"
              y1="25"
              x2="50"
              y2="75"
              stroke={stroke}
              strokeWidth={String(Number(strokeWidth) * 1.5)}
              vectorEffect={vectorEffect}
            />
            <line
              x1="25"
              y1="50"
              x2="75"
              y2="50"
              stroke={stroke}
              strokeWidth={String(Number(strokeWidth) * 1.5)}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "bpmn-gateway-inclusive":
        return (
          <>
            <polygon
              points="50,0 100,50 50,100 0,50"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <circle
              cx="50"
              cy="50"
              r="18"
              fill="none"
              stroke={stroke}
              strokeWidth={String(Number(strokeWidth) * 1.5)}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "bpmn-pool":
        return (
          <>
            <rect
              width="100"
              height="100"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="15"
              y1="0"
              x2="15"
              y2="100"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );

      // ── ER (Entity Relationship) shapes ──
      case "er-entity":
        return (
          <rect
            width="100"
            height="100"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "er-weak-entity":
        return (
          <>
            <rect
              x="5"
              y="5"
              width="90"
              height="90"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <rect
              width="100"
              height="100"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "er-relationship":
        return (
          <polygon
            points="50,5 95,50 50,95 5,50"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "er-weak-relationship":
        return (
          <>
            <polygon
              points="50,10 90,50 50,90 10,50"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <polygon
              points="50,5 95,50 50,95 5,50"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "er-attribute":
        return (
          <ellipse
            cx="50"
            cy="50"
            rx="48"
            ry="35"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
      case "er-key-attribute":
        return (
          <>
            <ellipse
              cx="50"
              cy="50"
              rx="48"
              ry="35"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <line
              x1="12"
              y1="60"
              x2="88"
              y2="60"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "er-multivalued":
        return (
          <>
            <ellipse
              cx="50"
              cy="50"
              rx="48"
              ry="35"
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
            <ellipse
              cx="50"
              cy="50"
              rx="40"
              ry="28"
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect={vectorEffect}
            />
          </>
        );
      case "er-derived":
        return (
          <ellipse
            cx="50"
            cy="50"
            rx="48"
            ry="35"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray="6 3"
            vectorEffect={vectorEffect}
          />
        );

      case "text":
        return null;
      default:
        return (
          <rect
            width="100"
            height="100"
            rx="15"
            ry="30"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect={vectorEffect}
          />
        );
    }
  })();

  return addShapeInteraction(artwork, { onClick, onDoubleClick });
}
