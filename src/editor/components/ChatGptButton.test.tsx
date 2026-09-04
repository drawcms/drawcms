// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChatGptButton } from "./ChatGptButton";

describe("ChatGptButton", () => {
  afterEach(cleanup);

  it("links to the ChatGPT desktop app with the connected flag appended", async () => {
    window.history.replaceState({}, "", "/editor");
    render(<ChatGptButton />);
    const link = await screen.findByRole("link", { name: /draw with chatgpt/i });
    expect(link.getAttribute("href")).toBe(
      `codex://browser?url=${encodeURIComponent("http://localhost:3000/editor?webmcpconnected=true")}`,
    );
    // The attention shine only runs while the agent is not connected.
    expect(document.querySelector(".dm-chatgpt-shine")).not.toBeNull();
  });

  it("shows the connected status when opened through the deep link", async () => {
    window.history.replaceState({}, "", "/editor/?webmcpconnected=true");
    render(<ChatGptButton />);
    await screen.findByRole("status");
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.querySelector(".dm-chatgpt-shine")).toBeNull();
  });
});
