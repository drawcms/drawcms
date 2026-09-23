/**
 * Onboarding policy: when the first-launch chooser may open itself, and what
 * picking a template is allowed to do.
 *
 * These are pure decisions kept out of DrawCMSEditor so they can be tested and
 * read on their own. They exist because the original rules were implicit and
 * wrong in one specific, damaging way: the chooser opened whenever a
 * per-browser localStorage flag was absent, and picking a template always
 * replaced the open document. On a host that persists by document identity and
 * autosaves (cloud), that combination silently overwrote a saved diagram —
 * content and name — with the sample.
 */

export type OnboardingVariant = "full" | "presentation";

/**
 * May the chooser open itself on mount?
 *
 * Only over an empty canvas. The dismissal flag is per-browser, not
 * per-document, so it cannot tell "this reader has never seen the guide" from
 * "this reader is opening a saved diagram on a new machine". Requiring an empty
 * document is what makes the difference, and it also keeps the chooser useful
 * exactly where it belongs — a blank canvas.
 *
 * Reopening deliberately via File → Show guide does not go through this; that is
 * an explicit request, and it is guarded at the point of replacement instead.
 */
export function shouldAutoOpenOnboarding(options: {
  variant: OnboardingVariant;
  dismissed: boolean;
  documentIsEmpty: boolean;
}): boolean {
  if (options.variant === "presentation") return false;
  if (options.dismissed) return false;
  return options.documentIsEmpty;
}

/**
 * What should happen when a template is chosen?
 *
 * - `load-in-place` — empty canvas: nothing can be lost.
 * - `new-document` — there is content and the host can create documents, so the
 *   template opens as a new one and the open document is left alone. This is the
 *   right answer for hosts bound to a document id.
 * - `confirm-replace` — there is content and the host cannot create documents
 *   (a local single-document host), so ask before replacing.
 *
 * Note it never returns a silent replace. A whole-document swap has no undo, and
 * the chooser is reachable at any time from the File menu.
 */
export type TemplateTarget = "load-in-place" | "new-document" | "confirm-replace";

export function resolveTemplateTarget(options: {
  documentIsEmpty: boolean;
  hostCanCreateDocument: boolean;
}): TemplateTarget {
  if (options.documentIsEmpty) return "load-in-place";
  return options.hostCanCreateDocument ? "new-document" : "confirm-replace";
}
