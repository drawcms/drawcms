import { describe, expect, it } from "vitest";
import {
  dismissOnboarding,
  isOnboardingDismissed,
  loadGuideStep,
  reopenOnboarding,
  saveGuideStep,
} from "./state";

describe("onboarding state", () => {
  it("falls back to safe defaults outside the browser", () => {
    expect(isOnboardingDismissed()).toBe(false);
    expect(loadGuideStep()).toBe(0);
  });

  it("round-trips through the API defensively (no-throw contract)", () => {
    saveGuideStep(3);
    dismissOnboarding();
    reopenOnboarding();
    // In node (no window) the calls are no-ops and must not throw.
    expect(loadGuideStep()).toBe(0);
    expect(isOnboardingDismissed()).toBe(false);
  });
});
