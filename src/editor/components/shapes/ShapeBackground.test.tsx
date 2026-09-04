// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ShapeBackground } from "./ShapeBackground";

afterEach(cleanup);

describe("ShapeBackground interaction targets", () => {
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
