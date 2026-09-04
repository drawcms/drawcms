// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableNodeLabel } from "./EditableNodeLabel";

afterEach(cleanup);

describe("EditableNodeLabel", () => {
  it("preserves line breaks and constrains long display text", () => {
    render(
      <EditableNodeLabel
        value={"Trusted service\nboundary"}
        isEditing={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );

    const label = screen.getByText(/Trusted service/);
    expect(label.textContent).toBe("Trusted service\nboundary");
    expect(label.className).toContain("whitespace-pre-wrap");
    expect(label.className).toContain("break-words");
    expect(label.style.overflowWrap).toBe("anywhere");
  });

  it("uses a multiline editor and saves only with blur or a modified Enter", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <EditableNodeLabel
        value="Password hashes"
        isEditing
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Element label" });
    expect(editor.tagName).toBe("TEXTAREA");
    await user.type(editor, "{Enter}stay inside");
    expect(onCommit).not.toHaveBeenCalled();
    expect((editor as HTMLTextAreaElement).value).toBe("Password hashes\nstay inside");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onCommit).toHaveBeenCalledWith("Password hashes\nstay inside");
  });

  it("cancels with Escape without saving the draft", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <EditableNodeLabel value="Original" isEditing onCommit={onCommit} onCancel={onCancel} />,
    );

    const editor = screen.getByRole("textbox", { name: "Element label" });
    fireEvent.change(editor, { target: { value: "Draft" } });
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
