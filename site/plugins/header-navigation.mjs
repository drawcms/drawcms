const SECTION_PATHS = {
  cloud: ["/cloud"],
  "self-hosting": ["/self-hosting"],
  "public-api": ["/plugin-api", "/public-api-versioning"],
  contributing: ["/contributing"],
};

function normalizePath(pathname) {
  const withoutQuery = pathname.split(/[?#]/, 1)[0];
  const withoutIndex = withoutQuery.replace(/\/index\.html$/, "");
  const withoutExtension = withoutIndex.replace(/\.html$/, "");
  return withoutExtension.length > 1 ? withoutExtension.replace(/\/$/, "") : withoutExtension;
}

/** Return the docs header section for a pathname, or null outside the docs base. */
export function getActiveDocsSection(pathname, basePath) {
  const base = normalizePath(basePath);
  const current = normalizePath(pathname);
  if (current !== base && !current.startsWith(`${base}/`)) return null;

  const relative = current.slice(base.length) || "/";
  for (const [section, paths] of Object.entries(SECTION_PATHS)) {
    if (paths.some((path) => relative === path || relative.startsWith(`${path}/`))) {
      return section;
    }
  }
  return "guide";
}
