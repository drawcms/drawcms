// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SequenceLifelineArtwork } from "./SequenceLifelineArtwork";

afterEach(cleanup);

describe("SequenceLifelineArtwork", () => {
  it("keeps the actor symbol in its own proportional viewport", () => {
    const { container, getByText } = render(
      <SequenceLifelineArtwork
        type="sequence-actor"
        fill="#ffffff"
        stroke="#475569"
        strokeWidth="2"
        label={<span>Actor</span>}
      />,
    );

    const symbol = container.querySelector(".dm-sequence-actor-symbol");
    expect(symbol?.getAttribute("viewBox")).toBe("0 0 54 54");
    expect(symbol?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    expect(getByText("Actor").closest(".dm-sequence-actor-label")).not.toBeNull();
    expect(
      container.querySelector<HTMLElement>(".dm-sequence-lifeline-line")?.style.borderLeftWidth,
    ).toBe("2px");
  });

  it("centers participant text in a header separated from the stretchable line", () => {
    const { container, getByText } = render(
      <SequenceLifelineArtwork
        type="sequence-participant"
        fill="#ffffff"
        stroke="#475569"
        strokeWidth="1.5"
        label={<span>Participant</span>}
      />,
    );

    const header = getByText("Participant").closest<HTMLElement>(".dm-sequence-participant-header");
    const line = container.querySelector<HTMLElement>(".dm-sequence-participant-line");
    expect(header?.style.borderWidth).toBe("1.5px");
    expect(line?.style.borderLeftWidth).toBe("1.5px");
  });

  it("keeps a malformed or invisible CSS stroke width visible", () => {
    const { container, rerender } = render(
      <SequenceLifelineArtwork
        type="sequence-participant"
        fill="#ffffff"
        stroke="#475569"
        strokeWidth="not-a-number"
        label={<span>Participant</span>}
      />,
    );

    expect(
      container.querySelector<HTMLElement>(".dm-sequence-participant-line")?.style.borderLeftWidth,
    ).toBe("1px");

    rerender(
      <SequenceLifelineArtwork
        type="sequence-participant"
        fill="#ffffff"
        stroke="#475569"
        strokeWidth="0"
        label={<span>Participant</span>}
      />,
    );
    expect(
      container.querySelector<HTMLElement>(".dm-sequence-participant-line")?.style.borderLeftWidth,
    ).toBe("1px");
  });
});
