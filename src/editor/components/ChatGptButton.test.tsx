// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatGptButton } from "./ChatGptButton";

const defaultDeepLink = `codex://browser?url=${encodeURIComponent(
  "http://localhost:3000/editor?webmcpconnected=true",
)}`;

describe("ChatGptButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /** jsdom freezes location.href on a non-configurable slot in this Node
   * version, so replace the whole location with a mutable stand-in that
   * keeps the URL fields `new URL()` and the component's mount read need. */
  function stubLocationHref(): { hrefSets: string[] } {
    const hrefSets: string[] = [];
    const currentHref = window.location.href;
    const location = window.location;
    Object.defineProperty(window, "location", {
      value: {
        get href() {
          return currentHref;
        },
        set href(value: string) {
          hrefSets.push(value);
        },
        origin: location.origin,
        protocol: location.protocol,
        host: location.host,
        hostname: location.hostname,
        port: location.port,
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        assign: () => {},
        replace: () => {},
        reload: () => {},
        toString: () => currentHref,
      },
      configurable: true,
    });
    return { hrefSets };
  }

  it("links to the ChatGPT desktop app with the connected flag appended", async () => {
    window.history.replaceState({}, "", "/editor");
    render(<ChatGptButton />);
    const link = await screen.findByRole("link", { name: /draw with chatgpt/i });
    expect(link.getAttribute("href")).toBe(defaultDeepLink);
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

  it("swaps in the host-resolved link when a resolver is provided", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/editor");
    const { hrefSets } = stubLocationHref();
    const resolved = `codex://browser?url=${encodeURIComponent(
      "http://localhost:3000/agent-auth?ott=live-token&next=/editor",
    )}`;
    render(<ChatGptButton resolveDeepLink={vi.fn().mockResolvedValue(resolved)} />);

    await user.click(await screen.findByRole("link", { name: /draw with chatgpt/i }));
    await vi.waitFor(() => expect(hrefSets).toEqual([resolved]));
    // Resolving returns to the clickable link so the user can retry if the
    // OS swallowed the protocol navigation.
    expect(await screen.findByRole("link", { name: /draw with chatgpt/i })).toBeTruthy();
  });

  it("falls back to the built-in deep link when the resolver returns null", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/editor");
    const { hrefSets } = stubLocationHref();
    render(<ChatGptButton resolveDeepLink={vi.fn().mockResolvedValue(null)} />);

    await user.click(await screen.findByRole("link", { name: /draw with chatgpt/i }));
    await vi.waitFor(() => expect(hrefSets).toEqual([defaultDeepLink]));
  });

  it("stays on the page without navigating when the resolver fails", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/editor");
    const { hrefSets } = stubLocationHref();
    render(<ChatGptButton resolveDeepLink={vi.fn().mockRejectedValue(new Error("offline"))} />);

    await user.click(await screen.findByRole("link", { name: /draw with chatgpt/i }));
    // A failed mint must never fall back to the credential-less deep link.
    await vi.waitFor(() =>
      expect(screen.getByRole("link", { name: /draw with chatgpt/i })).toBeTruthy(),
    );
    expect(hrefSets).toEqual([]);
  });

  it("does not intercept the click when no resolver is provided", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/editor");
    const { hrefSets } = stubLocationHref();
    render(<ChatGptButton />);

    const link = await screen.findByRole("link", { name: /draw with chatgpt/i });
    // jsdom does not navigate on <a href="codex:…">; the absence of a
    // programmatic location write proves the default browser behavior is
    // left untouched.
    await user.click(link);
    expect(hrefSets).toEqual([]);
    expect(await screen.findByRole("link", { name: /draw with chatgpt/i })).toBeTruthy();
  });
});
