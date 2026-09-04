// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocument } from "../document/serialize";
import type { DocumentPersistenceAdapter } from "./types";
import { createMemoryAdapter } from "./memory";
import { useDocumentPersistence } from "./use-persistence";

const document = createDocument({
  nodes: [
    {
      id: "node-1",
      position: { x: 120, y: 80 },
      data: { label: "Changed", type: "rect" },
    },
  ],
  edges: [],
  meta: { name: "Route transition" },
});

function PersistenceHarness({ adapter }: { adapter: DocumentPersistenceAdapter }) {
  const persistence = useDocumentPersistence(adapter, { debounceMs: 2000 });

  return (
    <button
      type="button"
      onClick={() => {
        persistence.schedule(document);
        void persistence.flush();
      }}
    >
      Edit diagram
    </button>
  );
}

afterEach(cleanup);

describe("useDocumentPersistence", () => {
  it("keeps its controller alive through the Strict Mode mount cycle", async () => {
    const adapter = createMemoryAdapter();
    const save = vi.spyOn(adapter, "save");

    render(
      <StrictMode>
        <PersistenceHarness adapter={adapter} />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit diagram" }));

    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save).toHaveBeenLastCalledWith(document);
  });

  it("creates a live controller when the host switches adapters", async () => {
    const firstAdapter = createMemoryAdapter();
    const secondAdapter = createMemoryAdapter();
    const firstSave = vi.spyOn(firstAdapter, "save");
    const secondSave = vi.spyOn(secondAdapter, "save");
    const view = render(
      <StrictMode>
        <PersistenceHarness adapter={firstAdapter} />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit diagram" }));
    await waitFor(() => expect(firstSave).toHaveBeenCalledOnce());

    view.rerender(
      <StrictMode>
        <PersistenceHarness adapter={secondAdapter} />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit diagram" }));

    await waitFor(() => expect(secondSave).toHaveBeenCalledOnce());
    expect(firstSave).toHaveBeenCalledOnce();
  });
});
