import type { ReactNode } from "react";

interface SequenceLifelineArtworkProps {
  type: "sequence-actor" | "sequence-participant";
  fill: string;
  stroke: string;
  strokeWidth: string;
  label: ReactNode;
}

/**
 * Lifelines have two different sizing jobs: their header stays legible while
 * the line below it stretches with the node. Keeping those layers in HTML/CSS
 * prevents non-uniform node resizing from deforming the actor or header text.
 */
export function SequenceLifelineArtwork({
  type,
  fill,
  stroke,
  strokeWidth,
  label,
}: SequenceLifelineArtworkProps) {
  const parsedStrokeWidth = Number.parseFloat(strokeWidth);
  const cssStrokeWidth = Number.isFinite(parsedStrokeWidth) ? Math.max(1, parsedStrokeWidth) : 1;
  const lineStyle = {
    borderColor: stroke,
    borderLeftWidth: cssStrokeWidth,
  };

  if (type === "sequence-actor") {
    return (
      <div className="dm-sequence-lifeline-artwork" data-sequence-lifeline="actor">
        <div className="dm-sequence-actor-header">
          <svg
            aria-hidden="true"
            className="dm-sequence-actor-symbol"
            viewBox="0 0 54 54"
            preserveAspectRatio="xMidYMid meet"
          >
            <g
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            >
              <circle cx="27" cy="11" r="8" fill={fill} />
              <path d="M27 19 V36 M14 25 H40 M27 36 L16 51 M27 36 L38 51" />
            </g>
          </svg>
          <div className="dm-sequence-actor-label">{label}</div>
        </div>
        <div aria-hidden="true" className="dm-sequence-lifeline-line" style={lineStyle} />
      </div>
    );
  }

  return (
    <div className="dm-sequence-lifeline-artwork" data-sequence-lifeline="participant">
      <div
        className="dm-sequence-participant-header"
        style={{
          backgroundColor: fill,
          borderColor: stroke,
          borderWidth: cssStrokeWidth,
        }}
      >
        {label}
      </div>
      <div
        aria-hidden="true"
        className="dm-sequence-lifeline-line dm-sequence-participant-line"
        style={lineStyle}
      />
    </div>
  );
}
