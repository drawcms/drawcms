// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StoryState } from "../story/model";
import { SequenceDock } from "./SequenceDock";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const story: StoryState = {
  activeSceneId: "scene-1",
  scenes: [
    {
      id: "scene-1",
      title: "Request flow",
      steps: [
        {
          id: "step-1",
          title: "Client sends request",
          description: "The request enters through the public endpoint.",
          targets: [{ targetId: "client", targetKind: "node" }],
        },
        {
          id: "step-2",
          title: "Gateway validates",
          targets: [{ targetId: "gateway", targetKind: "node" }],
        },
      ],
    },
  ],
};

const multiSceneStory: StoryState = {
  // Authoring selection must not decide where a public presentation begins.
  activeSceneId: "scene-2",
  scenes: [
    {
      id: "scene-empty",
      title: "Draft notes",
      steps: [],
    },
    {
      id: "scene-1",
      title: "Request",
      steps: [
        {
          id: "shared-step-id",
          title: "Send request",
          targets: [{ targetId: "client", targetKind: "node" }],
        },
      ],
    },
    {
      id: "scene-2",
      title: "Response",
      steps: [
        {
          // Step IDs only need to be unique inside their scene in imported documents.
          id: "shared-step-id",
          title: "Validate response",
          targets: [{ targetId: "gateway", targetKind: "node" }],
        },
        {
          id: "response-complete",
          title: "Return response",
          targets: [{ targetId: "client", targetKind: "node" }],
        },
      ],
    },
  ],
};

describe("SequenceDock", () => {
  it("starts in loop mode and reports the looping canvas state", async () => {
    const onActiveStepChange = vi.fn();
    render(
      <SequenceDock
        story={story}
        knownNodes={[
          { id: "client", label: "Client" },
          { id: "gateway", label: "Gateway" },
        ]}
        knownEdges={[]}
        onActiveStepChange={onActiveStepChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Play Steps" })).toBeTruthy();
    expect(screen.queryByText("Sequence 1 of 2")).toBeNull();
    await waitFor(() =>
      expect(onActiveStepChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          step: null,
          playing: false,
          mode: "loop",
        }),
      ),
    );
  });

  it("keeps the active viewer step and canvas target synchronized", async () => {
    const user = userEvent.setup();
    const onActiveStepChange = vi.fn();
    render(
      <SequenceDock
        story={story}
        knownNodes={[
          { id: "client", label: "Client" },
          { id: "gateway", label: "Gateway" },
        ]}
        knownEdges={[]}
        onActiveStepChange={onActiveStepChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Play Steps" }));
    expect(screen.getAllByText("Client sends request").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(onActiveStepChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          step: expect.objectContaining({ id: "step-1" }),
          playing: true,
          mode: "steps",
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /02.*Gateway validates/i }));
    expect(screen.getAllByText("Gateway validates").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(onActiveStepChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          step: expect.objectContaining({ id: "step-2" }),
          playing: false,
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(onActiveStepChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ playing: true }),
      ),
    );
  });

  it("exits playback back to loop mode and restarts at the first step on replay", () => {
    vi.useFakeTimers();
    const onActiveStepChange = vi.fn();
    render(
      <SequenceDock
        story={story}
        knownNodes={[
          { id: "client", label: "Client" },
          { id: "gateway", label: "Gateway" },
        ]}
        knownEdges={[]}
        onActiveStepChange={onActiveStepChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play Steps" }));
    expect(screen.getByText("Sequence 1 of 2")).toBeTruthy();

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByText("Sequence 2 of 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(screen.queryByText("Sequence 1 of 2")).toBeNull();
    expect(onActiveStepChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        step: null,
        playing: false,
        mode: "loop",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Play Steps" }));
    expect(screen.getByText("Sequence 1 of 2")).toBeTruthy();
  });

  it("starts multi-scene presentations at the first playable scene", async () => {
    const onActiveStepChange = vi.fn();
    render(
      <SequenceDock
        story={multiSceneStory}
        knownNodes={[
          { id: "client", label: "Client" },
          { id: "gateway", label: "Gateway" },
        ]}
        knownEdges={[]}
        onActiveStepChange={onActiveStepChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play Steps" }));
    expect(screen.getAllByText("Send request").length).toBeGreaterThan(0);
    expect(screen.getByText("Scene 1 of 2")).toBeTruthy();
    expect(screen.getByText("Step 1 of 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Validate response/ })).toBeNull();
    const picker = screen.getByRole("combobox", { name: "Choose scene" }) as HTMLSelectElement;
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual([
      "1. Request",
      "2. Response",
    ]);
    await waitFor(() =>
      expect(onActiveStepChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scene: expect.objectContaining({ id: "scene-1" }),
          step: expect.objectContaining({ title: "Send request" }),
        }),
      ),
    );
  });

  it("lets viewers choose a scene and pauses autoplay on its first step", () => {
    vi.useFakeTimers();
    render(
      <SequenceDock
        story={multiSceneStory}
        knownNodes={[
          { id: "client", label: "Client" },
          { id: "gateway", label: "Gateway" },
        ]}
        knownEdges={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play Steps" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Choose scene" }), {
      target: { value: "scene-2" },
    });

    expect(screen.getByText("Scene 2 of 2")).toBeTruthy();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getAllByText("Validate response").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Send request/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
  });

  it("auto-advances across scene boundaries and wraps to the beginning", () => {
    vi.useFakeTimers();
    render(
      <SequenceDock
        story={multiSceneStory}
        knownNodes={[
          { id: "client", label: "Client" },
          { id: "gateway", label: "Gateway" },
        ]}
        knownEdges={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play Steps" }));
    expect(screen.getByText("Scene 1 of 2")).toBeTruthy();
    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByText("Scene 2 of 2")).toBeTruthy();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getAllByText("Validate response").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Send request/ })).toBeNull();

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
    expect(screen.getAllByText("Return response").length).toBeGreaterThan(0);

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByText("Scene 1 of 2")).toBeTruthy();
    expect(screen.getAllByText("Send request").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Validate response/ })).toBeNull();
  });
});
