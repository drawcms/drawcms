import { describe, expect, it } from "vitest";
import { addWatermarkToSvgDataUrl } from "./watermark";

describe("export watermark", () => {
  it("adds attribution to SVG exports when configured", () => {
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"></svg>',
    )}`;
    const result = addWatermarkToSvgDataUrl(source, 640, 360, "Made with DrawCMS");
    const svg = decodeURIComponent(result.slice(result.indexOf(",") + 1));

    expect(svg).toContain("Made with DrawCMS");
    expect(svg).toContain('fill="#0c8c5e"');
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("keeps exports unchanged when attribution is disabled", () => {
    const source = "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E";
    expect(addWatermarkToSvgDataUrl(source, 640, 360, undefined)).toBe(source);
  });
});
