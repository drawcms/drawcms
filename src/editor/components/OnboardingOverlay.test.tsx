// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OnboardingOverlay } from "./OnboardingOverlay";
import { TEMPLATES, GUIDED_TEMPLATE_ID } from "../document/templates";

function renderOverlay(overrides: Partial<Parameters<typeof OnboardingOverlay>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onChoose: vi.fn(),
    onImport: vi.fn(),
    onBlank: vi.fn(),
    ...overrides,
  };
  render(<OnboardingOverlay {...props} />);
  return props;
}

describe("OnboardingOverlay", () => {
  afterEach(cleanup);

  it("offers the guided sample with autoplay", async () => {
    const props = renderOverlay();
    await userEvent.click(screen.getByTestId("onboarding-sample"));
    expect(props.onChoose).toHaveBeenCalledWith(GUIDED_TEMPLATE_ID, true);
  });

  // Regression: this line was hardcoded to "Request flow, deployment, incident,
  // or sequence diagram" — the original four — and never updated as the catalog
  // grew to 18, so the guide advertised a fraction of what it offered.
  it("summarises the template count from the catalog rather than a fixed list", async () => {
    renderOverlay();
    const summary = screen.getByText(/more\.$/);
    expect(summary.textContent).toContain(TEMPLATES[0].name);
    expect(summary.textContent).toContain(`${TEMPLATES.length - 3} more`);
  });

  it("lists every catalog template once the template view is opened", async () => {
    renderOverlay();
    await userEvent.click(screen.getByText("Start from a template"));

    for (const template of TEMPLATES) {
      expect(screen.getByText(template.name)).toBeTruthy();
    }
  });

  it("passes the chosen template id through", async () => {
    const props = renderOverlay();
    await userEvent.click(screen.getByText("Start from a template"));

    const last = TEMPLATES[TEMPLATES.length - 1];
    await userEvent.click(screen.getByText(last.name));
    expect(props.onChoose).toHaveBeenCalledWith(last.id, true);
  });
});
