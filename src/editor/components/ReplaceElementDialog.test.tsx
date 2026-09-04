// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReplaceElementDialog } from "./ReplaceElementDialog";
import { SHAPE_CATEGORIES } from "./shapes/catalog";
import { isSequenceEdgeType } from "../types";

describe("ReplaceElementDialog", () => {
  afterEach(cleanup);

  it("lists elements and marks the current type", () => {
    const onChoose = vi.fn();
    render(<ReplaceElementDialog currentType="rect" onChoose={onChoose} onOpenChange={() => {}} />);

    expect(screen.getByText("Replace element")).toBeTruthy();
    const current = screen.getByRole("button", { name: /Rectangle \(current element\)/i });
    expect(current.getAttribute("aria-pressed")).toBe("true");
  });

  it("picks the first search result on Enter and chosen types on click", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<ReplaceElementDialog currentType="rect" onChoose={onChoose} onOpenChange={() => {}} />);

    const search = screen.getByLabelText("Search elements");
    await user.type(search, "diamond");
    expect(screen.queryByText(/no elements match/i)).toBeNull();

    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenCalledWith("diamond");

    await user.clear(search);
    await user.type(search, "star");
    await user.click(screen.getByRole("button", { name: "Replace with Star" }));
    expect(onChoose).toHaveBeenNthCalledWith(2, "star");
  });

  it("offers the whole human palette except attached sequence edges", () => {
    const expected = SHAPE_CATEGORIES.flatMap((category) => category.shapes)
      .filter((shape) => !isSequenceEdgeType(shape.id))
      .map((shape) => shape.id);
    render(<ReplaceElementDialog currentType="" onChoose={() => {}} onOpenChange={() => {}} />);
    const buttons = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? "")
      .filter((label) => /replace with |current element/i.test(label)).length;
    // Every palette entry gets exactly one picker button (current + replace labels).
    expect(buttons).toBe(expected.length);
  });
});
