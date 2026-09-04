/** draw.io `style` string parsing and the practical-subset shape mapping. */

export interface DrawioStyle {
  flags: Set<string>;
  values: Map<string, string>;
}

export function parseDrawioStyle(style: string): DrawioStyle {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (const token of style.split(";")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) flags.add(trimmed);
    else values.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return { flags, values };
}

/**
 * Map a draw.io style to the closest DrawCMS shape type. Unknown shapes
 * degrade to "rect" and the caller records a report entry.
 */
export function mapDrawioShapeType(style: DrawioStyle): { type: string; note?: string } {
  const { flags, values } = style;

  if (flags.has("swimlane")) return { type: "swimlane-container" };
  if (flags.has("ellipse")) return { type: "circle" };
  if (flags.has("rhombus")) return { type: "diamond" };
  if (flags.has("text")) return { type: "text" };

  const shape = values.get("shape") ?? "";
  switch (shape) {
    case "":
      return values.get("rounded") === "1" || flags.has("rounded")
        ? { type: "round-rect" }
        : { type: "rect" };
    case "cylinder":
    case "cylinder3":
      return { type: "cylinder" };
    case "cloud":
      return { type: "cloud" };
    case "actor":
      return { type: "actor" };
    case "parallelogram":
      return { type: "parallelogram" };
    case "hexagon":
      return { type: "hexagon" };
    case "triangle":
      return { type: "triangle" };
    case "star":
      return { type: "star" };
    case "note":
      return { type: "note" };
    case "process":
      return { type: "process" };
    case "hexagon-90":
      return { type: "data" };
    case "document":
      return { type: "document" };
    case "database":
      return { type: "database" };
    case "image":
      return { type: "image" };
    default:
      return { type: "rect", note: `shape "${shape}" approximated as a rectangle` };
  }
}

/** Convert exit/entry fractions (0..1) to DrawCMS handle ids. */
export function fractionToHandle(x: number | undefined, y: number | undefined): string | undefined {
  if (x === undefined && y === undefined) return undefined;
  if (x !== undefined && x >= 0.75) return "right";
  if (x !== undefined && x <= 0.25) return "left";
  if (y !== undefined && y <= 0.25) return "top";
  if (y !== undefined && y >= 0.75) return "bottom";
  return x !== undefined && x > 0.5 ? "right" : undefined;
}

export function styleNumber(style: DrawioStyle, key: string): number | undefined {
  const raw = style.values.get(key);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** draw.io opacity/alpha attributes are 0..100 percentages. */
export function stylePercent(style: DrawioStyle, key: string): number | undefined {
  const value = styleNumber(style, key);
  if (value === undefined) return undefined;
  return Math.min(100, Math.max(0, value)) / 100;
}

/** draw.io labels are entity-escaped HTML; keep the text, keep newlines. */
export function stripDrawioLabelMarkup(markup: string): string {
  return markup
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
