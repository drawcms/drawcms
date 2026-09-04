import { describe, expect, it } from "vitest";
import { resolveExportBackground } from "./export";

describe("export background", () => {
  it("keeps solid exports on the canvas background by default", () => {
    expect(resolveExportBackground({})).toBe("#f3f4f6");
    expect(resolveExportBackground({ background: "solid", backgroundColor: "#ffffff" })).toBe(
      "#ffffff",
    );
  });

  it("preserves transparency instead of falling back to the solid default", () => {
    expect(resolveExportBackground({ background: "transparent" })).toBeUndefined();
  });
});
