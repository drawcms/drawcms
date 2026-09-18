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
  it("keeps the dialog within the viewport: capped height, scrollable body, pinned footer", () => {
    renderDialog();
    // The dialog panel caps its height and hides overflow so it can never spill
    // past the viewport the way the pre-fix grid layout did.
    const panel = document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.className).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
    expect(panel.className).toMatch(/overflow-hidden/);
    // The body between header and footer is the scroll region.
    const scrollBody = panel.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scrollBody).toBeTruthy();
    expect(scrollBody.className).toMatch(/min-h-0/);
    // The footer's buttons live outside that scroll region (pinned).
    const save = screen.getByRole("button", { name: /Save changes/ });
    expect(scrollBody.contains(save)).toBe(false);
  });

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

  it("preserves hidden selections when searching and saves the full selected set", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByRole("searchbox", { name: "Search items" }), "CHECKOUT");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await user.click(screen.getByRole("checkbox", { name: /Click checkout/ }));
    expect(screen.getByText("4 selected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit.mock.calls[0][0].targets).toHaveLength(4);
  });

  it("lets users review selected items and recover after removing the last one", async () => {
    const user = userEvent.setup();
    renderDialog({ targets: [{ targetId: "user", targetKind: "node" }] });

    await user.click(screen.getByRole("button", { name: "Selected" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await user.click(screen.getByRole("checkbox", { name: /User/ }));
    expect(screen.getByText("No items selected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show all items" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("recovers from an empty search without changing the selected items", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole("searchbox", { name: "Search items" }), "missing item");
    expect(screen.getByText("No matching items")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show all items" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.getByText("3 selected")).toBeTruthy();
  });

  it("saves duration presets and preserves the default duration representation", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await user.click(screen.getByRole("button", { name: "8s" }));
    expect((screen.getByRole("slider", { name: "Hold duration" }) as HTMLInputElement).value).toBe(
      "8",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSubmit.mock.calls[0][0].durationMs).toBe(8000);

    await user.click(screen.getByRole("button", { name: /4s · Default/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSubmit.mock.calls[1][0].durationMs).toBeUndefined();
  });

  it("explains an empty diagram and prevents creating a step without targets", () => {
    renderDialog({ mode: "create", targets: [], knownNodes: [], knownEdges: [] });
    expect(screen.getByText("No items yet")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add step" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("dismisses with Escape without submitting edits", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { onSubmit } = renderDialog({ onOpenChange });
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
