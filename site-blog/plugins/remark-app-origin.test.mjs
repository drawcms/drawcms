import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_ORIGIN_PLACEHOLDER,
  LOCAL_APP_ORIGIN,
  normalizeAppOrigin,
  remarkAppOrigin,
  resolveAppOrigin,
} from "./remark-app-origin.mjs";

test("replaces the app placeholder in rendered HTML without changing code examples", () => {
  const tree = {
    type: "root",
    children: [
      {
        type: "html",
        value: `<iframe src="${APP_ORIGIN_PLACEHOLDER}/embed/sample"></iframe>`,
      },
      {
        type: "code",
        value: `<iframe src="${APP_ORIGIN_PLACEHOLDER}/embed/your-viewer-token"></iframe>`,
      },
    ],
  };

  remarkAppOrigin({ appOrigin: LOCAL_APP_ORIGIN })(tree);

  assert.equal(
    tree.children[0].value,
    '<iframe src="http://127.0.0.1:3000/embed/sample"></iframe>',
  );
  assert.match(tree.children[1].value, /your-drawcms-host\.example/);
});

test("normalizes configured origins and rejects unsafe values", () => {
  assert.equal(normalizeAppOrigin("https://cloud.example.com/"), "https://cloud.example.com");
  assert.throws(() => normalizeAppOrigin("javascript:alert(1)"), /http or https/);
  assert.throws(() => normalizeAppOrigin("https://user@example.com"), /cannot contain/);
});

test("defaults local builds to the local Cloud server", () => {
  assert.equal(resolveAppOrigin(undefined, { isDeployment: false }), LOCAL_APP_ORIGIN);
  assert.throws(
    () => resolveAppOrigin(undefined, { isDeployment: true }),
    /PUBLIC_DRAWCMS_APP_URL/,
  );
});
