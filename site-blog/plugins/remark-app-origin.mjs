import { visit } from "unist-util-visit";

export const APP_ORIGIN_PLACEHOLDER = "https://your-drawcms-host.example";
export const LOCAL_APP_ORIGIN = "http://127.0.0.1:3000";

export function normalizeAppOrigin(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The DrawCMS app origin must use http or https.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The DrawCMS app origin cannot contain credentials, a query, or a hash.");
  }
  return url.toString().replace(/\/$/, "");
}

export function resolveAppOrigin(
  configuredOrigin,
  { isDeployment = Boolean(process.env.CI || process.env.VERCEL) } = {},
) {
  if (configuredOrigin?.trim()) return normalizeAppOrigin(configuredOrigin.trim());

  if (isDeployment) {
    throw new Error(
      "Set PUBLIC_DRAWCMS_APP_URL to the deployed DrawCMS Cloud origin before building the docs site.",
    );
  }

  return LOCAL_APP_ORIGIN;
}

export function remarkAppOrigin({ appOrigin }) {
  const normalizedOrigin = normalizeAppOrigin(appOrigin);

  return (tree) => {
    visit(tree, "html", (node) => {
      node.value = node.value.replaceAll(APP_ORIGIN_PLACEHOLDER, normalizedOrigin);
    });
  };
}
