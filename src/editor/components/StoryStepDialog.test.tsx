// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StoryTarget } from "../story/model";
import { StoryStepDialog } from "./StoryStepDialog";

afterEach(cleanup);

const knownNodes = [
  { id: "user", label: "User" },
  { id: "client", label: "Browser Client" },
  { id: "api", label: "Shopfront API" },
];
const knownEdges = [{ id: "edge-user-client-1", label: "Click checkout" }];

function renderDialog(overrides: Partial<Parameters<typeof StoryStepDialog>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <StoryStepDialog
      open
      mode="edit"
      initialTitle="User clicks checkout"
      initialDescription="The user submits the cart."
      targets={
        [
          { targetId: "user", targetKind: "node" },
          { targetId: "client", targetKind: "node" },
          { targetId: "api", targetKind: "node" },
        ] as StoryTarget[]
      }
      knownNodes={knownNodes}
      knownEdges={knownEdges}
      onOpenChange={() => {}}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit };
}

describe("StoryStepDialog editable targets", () => {
  it("preselects the step's current targets and reports the count", () => {
    renderDialog();
    expect(screen.getByText(/3 selected/)).toBeTruthy();
    // The three nodes are checked; the edge is not.
    const userBox = screen.getByRole("checkbox", { name: /User/ }) as HTMLInputElement;
    expect(userBox.checked).toBe(true);
    const edgeBox = screen.getByRole("checkbox", { name: /Click checkout/ }) as HTMLInputElement;
    expect(edgeBox.checked).toBe(false);
  });

  it("lets the user change the targets and submits the edited set", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    // Fix the over-broad step: drop the two extra participants, add the message.
    await user.click(screen.getByRole("checkbox", { name: /Browser Client/ }));
    await user.click(screen.getByRole("checkbox", { name: /Shopfront API/ }));
    await user.click(screen.getByRole("checkbox", { name: /User/ }));
    await user.click(screen.getByRole("checkbox", { name: /Click checkout/ }));

    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.targets).toEqual([{ targetId: "edge-user-client-1", targetKind: "edge" }]);
  });

  it("blocks submit when no element is selected", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    // Uncheck all three.
    await user.click(screen.getByRole("checkbox", { name: /User/ }));
    await user.click(screen.getByRole("checkbox", { name: /Browser Client/ }));
    await user.click(screen.getByRole("checkbox", { name: /Shopfront API/ }));

    expect(screen.getByText(/Select at least one element/)).toBeTruthy();
    const save = screen.getByRole("button", { name: /Save changes/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.click(save);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
