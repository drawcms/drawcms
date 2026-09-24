// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ShapeBackground } from "./ShapeBackground";

afterEach(cleanup);

describe("ShapeBackground interaction targets", () => {
  it("keeps an explicit corner radius circular on a wide reference card", () => {
    const { container } = render(
      <svg>
        <ShapeBackground type="round-rect" borderRadius={12} width={460} height={108} />
      </svg>,
    );
    const rect = container.querySelector("rect")!;
    expect((Number(rect.getAttribute("rx")) * 460) / 104).toBeCloseTo(12);
    expect((Number(rect.getAttribute("ry")) * 108) / 104).toBeCloseTo(12);
  });
  it("forwards selection input to Cloud artwork", () => {
    const onClick = vi.fn();
    const { container } = render(
      <svg>
        <ShapeBackground type="cloud" onClick={onClick} />
      </svg>,
    );

    const artwork = container.querySelector("path");
    expect(artwork).not.toBeNull();
    fireEvent.click(artwork as Element);

    expect(onClick).toHaveBeenCalledOnce();
  });
});
