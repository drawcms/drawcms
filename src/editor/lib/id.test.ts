import { describe, expect, it } from "vitest";
import { generateId } from "./id";

describe("generateId", () => {
  it("creates compact unique identifiers", () => {
    const first = generateId();
    const second = generateId();

    expect(first).toHaveLength(10);
    expect(second).toHaveLength(10);
    expect(first).not.toBe(second);
  });
});
