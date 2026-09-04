// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconPicker } from "./IconPicker";
import { CollapsedElementsRail } from "./SidebarLeft";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockIconifyApi() {
  const searchResponse = new Response(
    JSON.stringify({
      icons: ["lucide:home", "lucide:cloud"],
      collections: {
        lucide: { name: "Lucide", license: { title: "ISC", spdx: "ISC" } },
      },
    }),
    { status: 200 },
  );
  const svgResponse = new Response(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7"/></svg>',
    { status: 200 },
  );
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input: RequestInfo | URL) =>
      String(input).includes("/search")
        ? Promise.resolve(searchResponse)
        : Promise.resolve(svgResponse),
    );
  return fetchMock;
}

describe("IconPicker", () => {
  it("searches the Iconify API and adds the picked icon", async () => {
    const user = userEvent.setup();
    mockIconifyApi();
    const onAddIcon = vi.fn();
    render(<IconPicker onAddIcon={onAddIcon} />);

    await user.click(screen.getByRole("button", { name: "Search icons…" }));
    const search = screen.getByRole("searchbox", { name: "Search icons" });
    await user.type(search, "home");

    const homeButton = await screen.findByRole("button", { name: "Add lucide:home icon" });
    expect(homeButton.getAttribute("title")).toContain("Lucide (ISC)");
    await user.click(homeButton);

    await waitFor(() =>
      expect(onAddIcon).toHaveBeenCalledWith({
        icon: "lucide:home",
        body: '<path d="M3 9l9-7 9 7"></path>',
        viewBox: "0 0 24 24",
        label: "home",
      }),
    );
    expect(screen.queryByRole("searchbox", { name: "Search icons" })).toBeNull();
  });

  it("shows a recoverable error state when the API is unreachable", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("Network error"));
    render(<IconPicker onAddIcon={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Search icons…" }));
    await user.type(screen.getByRole("searchbox", { name: "Search icons" }), "home");

    await screen.findByText("Icons are unavailable");
    screen.getByText(/internet connection/i);

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ icons: ["lucide:home"], collections: {} }), {
          status: 200,
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("button", { name: "Add lucide:home icon" });
  });

  it("shows an empty state when no icons match", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ icons: [], collections: {} }), { status: 200 }),
    );
    render(<IconPicker onAddIcon={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Search icons…" }));
    await user.type(screen.getByRole("searchbox", { name: "Search icons" }), "zzzz");

    await screen.findByText("No matching icons");
  });
});

describe("CollapsedElementsRail icons tool", () => {
  it("opens the icon search from the rail and adds an icon", async () => {
    const user = userEvent.setup();
    mockIconifyApi();
    const onAddIcon = vi.fn();
    render(
      <CollapsedElementsRail onAddNode={() => {}} onAddIcon={onAddIcon} onExpand={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: "Search icons" }));
    screen.getByRole("dialog", { name: "Icons" });
    await user.type(screen.getByRole("searchbox", { name: "Search icons" }), "home");
    await user.click(await screen.findByRole("button", { name: "Add lucide:home icon" }));

    await waitFor(() =>
      expect(onAddIcon).toHaveBeenCalledWith({
        icon: "lucide:home",
        body: '<path d="M3 9l9-7 9 7"></path>',
        viewBox: "0 0 24 24",
        label: "home",
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
