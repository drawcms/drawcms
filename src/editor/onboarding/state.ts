"use client";

/** First-run onboarding persistence (DM-021): dismissible, reopenable. */
const DISMISSED_KEY = "drawcms.onboarding.dismissed.v1";
const GUIDE_STEP_KEY = "drawcms.onboarding.guide-step.v1";

const storage = (): Storage | null =>
  typeof window !== "undefined" && window.localStorage ? window.localStorage : null;

export function isOnboardingDismissed(): boolean {
  try {
    return storage()?.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false; // when storage is unavailable we still show onboarding
  }
}

export function dismissOnboarding(): void {
  try {
    storage()?.setItem(DISMISSED_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

/** Reopening the guide resets progressive-hint progress. */
export function reopenOnboarding(): void {
  try {
    storage()?.removeItem(DISMISSED_KEY);
    storage()?.removeItem(GUIDE_STEP_KEY);
  } catch {
    /* non-fatal */
  }
}

export function loadGuideStep(): number {
  try {
    const raw = storage()?.getItem(GUIDE_STEP_KEY);
    const value = raw === null || raw === undefined ? 0 : Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveGuideStep(step: number): void {
  try {
    storage()?.setItem(GUIDE_STEP_KEY, String(step));
  } catch {
    /* non-fatal */
  }
}
