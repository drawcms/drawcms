import { describe, expect, it } from "vitest";
import { resolveTemplateTarget, shouldAutoOpenOnboarding } from "./policy";

describe("shouldAutoOpenOnboarding", () => {
  it("opens on a blank canvas the reader has not dismissed", () => {
    expect(
      shouldAutoOpenOnboarding({ variant: "full", dismissed: false, documentIsEmpty: true }),
    ).toBe(true);
  });

  // The regression this policy exists for: the dismissal flag lives in
  // localStorage per browser, not per document, so a saved diagram opened on a
  // fresh profile / second machine / cleared storage used to get the first-launch
  // chooser on top of it. Picking anything there replaced the document, and a
  // host that autosaves by diagram id persisted that overwrite immediately.
  it("never opens over a document that already has content", () => {
    expect(
      shouldAutoOpenOnboarding({ variant: "full", dismissed: false, documentIsEmpty: false }),
    ).toBe(false);
  });

  it("stays closed once dismissed", () => {
    expect(
      shouldAutoOpenOnboarding({ variant: "full", dismissed: true, documentIsEmpty: true }),
    ).toBe(false);
  });

  it("never opens in presentation chrome", () => {
    expect(
      shouldAutoOpenOnboarding({
        variant: "presentation",
        dismissed: false,
        documentIsEmpty: true,
      }),
    ).toBe(false);
  });
});

describe("resolveTemplateTarget", () => {
  it("loads in place on a blank canvas, so a new diagram is where templates land", () => {
    expect(resolveTemplateTarget({ documentIsEmpty: true, hostCanCreateDocument: true })).toBe(
      "load-in-place",
    );
    expect(resolveTemplateTarget({ documentIsEmpty: true, hostCanCreateDocument: false })).toBe(
      "load-in-place",
    );
  });

  it("opens a new document when there is content and the host can create one", () => {
    expect(resolveTemplateTarget({ documentIsEmpty: false, hostCanCreateDocument: true })).toBe(
      "new-document",
    );
  });

  it("asks first when there is content and the host cannot create documents", () => {
    expect(resolveTemplateTarget({ documentIsEmpty: false, hostCanCreateDocument: false })).toBe(
      "confirm-replace",
    );
  });

  it("never replaces content silently", () => {
    for (const hostCanCreateDocument of [true, false]) {
      expect(resolveTemplateTarget({ documentIsEmpty: false, hostCanCreateDocument })).not.toBe(
        "load-in-place",
      );
    }
  });
});
