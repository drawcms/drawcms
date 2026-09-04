import { describe, expect, it } from "vitest";
import { loadExportPreferences } from "./export-preferences";

describe("loadExportPreferences", () => {
  it("returns safe defaults outside the browser (node/test SSR path)", () => {
    expect(loadExportPreferences()).toEqual({
      background: "solid",
      sizePreset: "fit-diagram",
    });
  });
});
