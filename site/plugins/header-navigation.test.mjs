import assert from "node:assert/strict";
import test from "node:test";
import { getActiveDocsSection } from "./header-navigation.mjs";

test("selects the matching docs header section without duplicating the base path", () => {
  const cases = [
    ["/docs", "guide"],
    ["/docs/index.html", "guide"],
    ["/docs/quick-start", "guide"],
    ["/docs/cloud", "cloud"],
    ["/docs/cloud.html", "cloud"],
    ["/docs/self-hosting", "self-hosting"],
    ["/docs/plugin-api", "public-api"],
    ["/docs/public-api-versioning", "public-api"],
    ["/docs/contributing", "contributing"],
    ["/docs/contributing.html", "contributing"],
    ["/blog", null],
  ];

  for (const [pathname, expected] of cases) {
    assert.equal(getActiveDocsSection(pathname, "/docs/"), expected, pathname);
  }
});
