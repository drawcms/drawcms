export const ICONIFY_API_HOST = "https://api.iconify.design";

export const ICON_SEARCH_LIMIT = 32;

export const ICON_BODY_MAX_LENGTH = 64 * 1024;

const DEFAULT_ICON_VIEWBOX = "0 0 24 24";

const FORBIDDEN_ICON_TAGS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "style",
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
]);

export interface IconSearchResult {
  /** Full icon name including the set prefix, e.g. "lucide:home". */
  icon: string;
  prefix: string;
  name: string;
  setTitle: string;
  licenseTitle: string;
  licenseSpdx: string;
}

export interface IconArtwork {
  icon: string;
  /** Sanitized inner SVG markup, ready to inline into an <svg> element. */
  body: string;
  viewBox: string;
}

export class IconifyError extends Error {
  constructor(
    message: string,
    readonly recoveryHint: string,
  ) {
    super(message);
    this.name = "IconifyError";
  }
}

function splitIconName(icon: string): { prefix: string; name: string } | null {
  const separator = icon.indexOf(":");
  if (separator <= 0 || separator === icon.length - 1) return null;
  return { prefix: icon.slice(0, separator), name: icon.slice(separator + 1) };
}

function assertFetchResponse(response: Response, fallbackHint: string) {
  if (!response.ok) {
    throw new IconifyError("The icon service could not be reached.", fallbackHint);
  }
}

/** Search the public Iconify API for icons across all open-source sets. */
export async function searchIcons(
  query: string,
  options: { signal?: AbortSignal } = {},
): Promise<IconSearchResult[]> {
  const params = new URLSearchParams({
    query,
    limit: String(ICON_SEARCH_LIMIT),
  });
  let response: Response;
  try {
    response = await fetch(`${ICONIFY_API_HOST}/search?${params.toString()}`, {
      signal: options.signal,
    });
  } catch {
    throw new IconifyError(
      "The icon service could not be reached.",
      "Check your internet connection, then try searching again.",
    );
  }
  assertFetchResponse(
    response,
    "The icon service is temporarily unavailable. Try again in a moment.",
  );
  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { icons?: unknown }).icons)
  ) {
    throw new IconifyError(
      "The icon service returned an unexpected response.",
      "Try searching again.",
    );
  }
  const { icons, collections } = payload as {
    icons: string[];
    collections: Record<string, { name?: string; license?: { title?: string; spdx?: string } }>;
  };
  const results: IconSearchResult[] = [];
  for (const icon of icons) {
    const parts = splitIconName(icon);
    if (!parts) continue;
    const set = collections?.[parts.prefix];
    results.push({
      icon,
      prefix: parts.prefix,
      name: parts.name,
      setTitle: set?.name ?? parts.prefix,
      licenseTitle: set?.license?.title ?? "Unknown",
      licenseSpdx: set?.license?.spdx ?? "Unknown",
    });
  }
  return results;
}

/**
 * Shared SVG trust boundary: remove dangerous elements and attributes so the
 * remaining markup is embeddable. Used by both freshly fetched artwork
 * (`sanitizeIconSvg`) and stored icon bodies re-entering the app from files,
 * storage, or host imports (`sanitizeIconBody`).
 */
function cleanSvgTree(root: Element) {
  const walk = (element: Element) => {
    for (const child of Array.from(element.children)) {
      if (FORBIDDEN_ICON_TAGS.has(child.tagName.toLowerCase())) {
        child.remove();
        continue;
      }
      for (const attribute of Array.from(child.attributes)) {
        const name = attribute.name.toLowerCase();
        const isInternalHref =
          (name === "href" || name === "xlink:href") && attribute.value.startsWith("#");
        if (
          name.startsWith("on") ||
          name === "style" ||
          name === "xmlns" ||
          ((name === "href" || name === "xlink:href") && !isInternalHref)
        ) {
          child.removeAttribute(attribute.name);
        }
      }
      walk(child);
    }
  };
  walk(root);
}

/** Sanitize an Iconify SVG payload into embeddable markup plus a viewBox. */
export function sanitizeIconSvg(svgText: string, icon: string): { body: string; viewBox: string } {
  const doc = new DOMParser().parseFromString(svgText, "text/html");
  const root = doc.body?.querySelector("svg");
  if (!root) {
    throw new IconifyError(`"${icon}" is not a readable icon.`, "Choose a different icon.");
  }
  cleanSvgTree(root);
  const rawViewBox = root.getAttribute("viewBox")?.trim();
  const viewBox = rawViewBox && /^[-\d.\s]+$/.test(rawViewBox) ? rawViewBox : DEFAULT_ICON_VIEWBOX;
  const body = root.innerHTML;
  if (body.length > ICON_BODY_MAX_LENGTH) {
    throw new IconifyError(
      `"${icon}" is too large to store in a diagram.`,
      "Choose a different icon.",
    );
  }
  return { body, viewBox };
}

/**
 * Sanitize a stored SVG inner-body fragment (e.g. a document's `iconBody`)
 * into embeddable markup. Documents round-trip through files, browser
 * storage, and host/plugin imports, so every render must apply the same
 * trust boundary as freshly fetched artwork (DM-SEC-1). Unreadable or
 * oversized bodies collapse to empty markup.
 */
export function sanitizeIconBody(body: string): string {
  if (typeof body !== "string" || body.length === 0 || body.length > ICON_BODY_MAX_LENGTH) {
    return "";
  }
  const doc = new DOMParser().parseFromString(`<svg>${body}</svg>`, "text/html");
  const root = doc.body?.querySelector("svg");
  if (!root) return "";
  cleanSvgTree(root);
  return root.innerHTML;
}

/** Fetch one icon's SVG from the API and sanitize it for document storage. */
export async function fetchIconArtwork(
  icon: string,
  options: { signal?: AbortSignal } = {},
): Promise<IconArtwork> {
  const parts = splitIconName(icon);
  if (!parts) {
    throw new IconifyError(`"${icon}" is not a valid icon name.`, "Choose a different icon.");
  }
  let response: Response;
  try {
    response = await fetch(
      `${ICONIFY_API_HOST}/${encodeURIComponent(parts.prefix)}/${encodeURIComponent(parts.name)}.svg`,
      { signal: options.signal },
    );
  } catch {
    throw new IconifyError(
      "The icon could not be downloaded.",
      "Check your internet connection, then try again.",
    );
  }
  assertFetchResponse(response, "The icon is temporarily unavailable. Try another one.");
  const svgText = await response.text();
  return { icon, ...sanitizeIconSvg(svgText, icon) };
}
