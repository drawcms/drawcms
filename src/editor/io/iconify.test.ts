// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ICONIFY_API_HOST,
  ICON_BODY_MAX_LENGTH,
  IconifyError,
  fetchIconArtwork,
  sanitizeIconBody,
  sanitizeIconSvg,
  searchIcons,
} from "./iconify";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("searchIcons", () => {
  it("queries the public API with the search term and maps results", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          icons: ["lucide:home", "mdi:cloud"],
          collections: {
            lucide: { name: "Lucide", license: { title: "ISC", spdx: "ISC" } },
            mdi: {
              name: "Material Design Icons",
              license: { title: "Apache 2.0", spdx: "Apache-2.0" },
            },
          },
        }),
        { status: 200 },
      ),
    );

    const results = await searchIcons("home");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${ICONIFY_API_HOST.replace(".", "\\.")}/search\\?`)),
      expect.objectContaining({ signal: undefined }),
    );
    expect(results).toEqual([
      {
        icon: "lucide:home",
        prefix: "lucide",
        name: "home",
        setTitle: "Lucide",
        licenseTitle: "ISC",
        licenseSpdx: "ISC",
      },
      {
        icon: "mdi:cloud",
        prefix: "mdi",
        name: "cloud",
        setTitle: "Material Design Icons",
        licenseTitle: "Apache 2.0",
        licenseSpdx: "Apache-2.0",
      },
    ]);
  });

  it("fails with a recovery hint when the service is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network error"));

    await expect(searchIcons("home")).rejects.toMatchObject({
      name: "IconifyError",
      recoveryHint: expect.stringContaining("internet"),
    });
  });

  it("fails with a recovery hint on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    await expect(searchIcons("home")).rejects.toMatchObject({
      name: "IconifyError",
      recoveryHint: expect.stringContaining("moment"),
    });
  });
});

describe("sanitizeIconSvg", () => {
  it("extracts the inner body and viewBox", () => {
    const { body, viewBox } = sanitizeIconSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path d="M2 2h20v20H2z"/></svg>',
      "lucide:test",
    );

    expect(body).toBe('<path d="M2 2h20v20H2z"></path>');
    expect(viewBox).toBe("0 0 48 48");
  });

  it("removes scripts, event handlers, styles, and external links", () => {
    const { body } = sanitizeIconSvg(
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"><script>alert(1)</script><path d="M0 0h24v24H0z" onclick="alert(1)" style="fill:red"/><a xlink:href="https://evil.example"><path d="M1 1h2v2H1z"/></a></svg>',
      "lucide:test",
    );

    expect(body).not.toContain("script");
    expect(body).not.toContain("onclick");
    expect(body).not.toContain('style="fill:red"');
    expect(body).not.toContain("xlink:href");
    expect(body).toContain('<path d="M0 0h24v24H0z"></path>');
  });

  it("keeps internal defs references", () => {
    const { body } = sanitizeIconSvg(
      '<svg viewBox="0 0 24 24"><defs><linearGradient id="g1"><stop offset="0"/></linearGradient></defs><rect fill="url(#g1)" width="24" height="24"/></svg>',
      "lucide:test",
    );

    expect(body).toContain('id="g1"');
    expect(body).toContain('fill="url(#g1)"');
  });

  it("rejects non-SVG payloads", () => {
    expect(() => sanitizeIconSvg("<html><body>nope</body></html>", "lucide:test")).toThrow(
      IconifyError,
    );
  });

  it("falls back to a default viewBox when the icon lacks one", () => {
    const { viewBox } = sanitizeIconSvg('<svg><path d="M0 0h24v24H0z"/></svg>', "lucide:test");

    expect(viewBox).toBe("0 0 24 24");
  });
});

describe("sanitizeIconBody", () => {
  it("passes through benign markup unchanged", () => {
    expect(sanitizeIconBody('<path d="M3 9l9-7 9 7"></path>')).toBe(
      '<path d="M3 9l9-7 9 7"></path>',
    );
  });

  it("strips event handlers, forbidden tags, styles, and external links from stored bodies", () => {
    const body = sanitizeIconBody(
      '<script>alert(1)</script><path d="M0 0h24v24H0z" onclick="alert(1)" style="fill:red"/><foreignObject><img src="x" onerror="alert(1)"/></foreignObject><animate onbegin="alert(1)" attributeName="href"/><a href="javascript:alert(1)"><text>x</text></a><image href="https://evil.example/t.png"/>',
    );

    expect(body).not.toContain("script");
    expect(body).not.toContain("foreignObject");
    expect(body).not.toContain("img");
    expect(body).not.toContain("onerror");
    expect(body).not.toContain("onbegin");
    expect(body).not.toContain("animate");
    expect(body).not.toContain("javascript:");
    expect(body).not.toContain("evil.example");
    expect(body).not.toContain('style="fill:red"');
    expect(body).toContain('<path d="M0 0h24v24H0z"></path>');
  });

  it("drops content that escapes the svg fragment boundary", () => {
    const body = sanitizeIconBody('</svg><img src="x" onerror="alert(1)"/><path d="M1 1h2v2H1z"/>');

    expect(body).not.toContain("img");
    expect(body).not.toContain("onerror");
  });

  it("collapses empty, non-string, and oversized bodies to empty markup", () => {
    expect(sanitizeIconBody("")).toBe("");
    expect(sanitizeIconBody(undefined as unknown as string)).toBe("");
    expect(sanitizeIconBody("<path/>".repeat(ICON_BODY_MAX_LENGTH / 7 + 1))).toBe("");
  });
});

describe("fetchIconArtwork", () => {
  it("fetches the icon SVG and returns sanitized artwork", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7"/></svg>',
        { status: 200 },
      ),
    );

    const artwork = await fetchIconArtwork("lucide:home");

    expect(artwork).toEqual({
      icon: "lucide:home",
      body: '<path d="M3 9l9-7 9 7"></path>',
      viewBox: "0 0 24 24",
    });
  });

  it("rejects invalid icon names", async () => {
    await expect(fetchIconArtwork("nope")).rejects.toMatchObject({
      name: "IconifyError",
      recoveryHint: "Choose a different icon.",
    });
  });
});
