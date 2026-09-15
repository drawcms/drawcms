import { describe, expect, it } from "vitest";
import {
  FONT_SIZE_STEPS,
  MAX_SHAPE_FONT_SIZE,
  MAX_TEXT_FONT_SIZE,
  MIN_FONT_SIZE,
  nextFontSize,
} from "./constants";

describe("nextFontSize", () => {
  it("walks the ladder one rung at a time", () => {
    expect(nextFontSize(14, 1, MAX_TEXT_FONT_SIZE)).toBe(16);
    expect(nextFontSize(16, -1, MAX_TEXT_FONT_SIZE)).toBe(14);
    expect(nextFontSize(20, 1, MAX_TEXT_FONT_SIZE)).toBe(24);
    expect(nextFontSize(24, -1, MAX_TEXT_FONT_SIZE)).toBe(20);
  });

  it("stops at each type's own ceiling and at the shared floor", () => {
    expect(nextFontSize(96, 1, MAX_TEXT_FONT_SIZE)).toBe(96);
    expect(nextFontSize(48, 1, MAX_SHAPE_FONT_SIZE)).toBe(48);
    // A shape sitting above its ceiling (imported, or type-swapped) comes back down.
    expect(nextFontSize(72, 1, MAX_SHAPE_FONT_SIZE)).toBe(MAX_SHAPE_FONT_SIZE);
    expect(nextFontSize(MIN_FONT_SIZE, -1, MAX_TEXT_FONT_SIZE)).toBe(MIN_FONT_SIZE);
  });

  it("moves an off-ladder size to the nearest rung in the requested direction", () => {
    // 15px comes from the slider, which is continuous.
    expect(nextFontSize(15, 1, MAX_TEXT_FONT_SIZE)).toBe(16);
    expect(nextFontSize(15, -1, MAX_TEXT_FONT_SIZE)).toBe(14);
    expect(nextFontSize(1, 1, MAX_TEXT_FONT_SIZE)).toBe(MIN_FONT_SIZE);
    expect(nextFontSize(200, -1, MAX_TEXT_FONT_SIZE)).toBe(96);
  });

  it("keeps the ladder ascending and inside the slider's range", () => {
    expect([...FONT_SIZE_STEPS].sort((a, b) => a - b)).toEqual([...FONT_SIZE_STEPS]);
    expect(FONT_SIZE_STEPS[0]).toBe(MIN_FONT_SIZE);
    expect(FONT_SIZE_STEPS.at(-1)).toBe(MAX_TEXT_FONT_SIZE);
    expect(FONT_SIZE_STEPS).toContain(MAX_SHAPE_FONT_SIZE);
  });
});
