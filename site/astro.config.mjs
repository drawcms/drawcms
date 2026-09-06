import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { remarkAppOrigin, resolveAppOrigin } from "./plugins/remark-app-origin.mjs";
import { remarkContentLinks } from "./plugins/remark-content-links.mjs";

const siteRoot = fileURLToPath(new URL("./", import.meta.url));
const docsDir = path.join(siteRoot, "src", "content", "docs");

const GITHUB_URL = "https://github.com/drawcms/drawcms";
const APP_ORIGIN = resolveAppOrigin(
  process.env.PUBLIC_DRAWCMS_APP_URL ?? process.env.PUBLIC_DRAWMS_APP_URL,
);

const SIDEBAR_GROUPS = [
  {
    label: "Get started",
    items: ["quick-start", "core-concepts"],
  },
  {
    label: "Creating diagrams",
    items: ["design-system", "document-format"],
  },
  {
    label: "Deploy",
    items: ["self-hosting", "upgrading"],
  },
  {
    label: "Extend",
    items: ["plugin-api", "webmcp"],
  },
  {
    label: "Reference",
    items: [
      "public-api-versioning",
      "importer-limitations",
      "browser-support",
      "accessibility",
      "performance",
    ],
  },
];

/** Short sidebar labels for pages whose frontmatter titles are long. */
const SIDEBAR_LABELS = {
  "quick-start": "Quick start",
  "core-concepts": "Concepts",
  "self-hosting": "Self-hosting",
  upgrading: "Upgrading",
  "plugin-api": "Plugin API",
  "design-system": "Design system",
  "public-api-versioning": "API versioning",
  "document-format": "Document format",
  "importer-limitations": "Importers",
  "browser-support": "Browsers",
  accessibility: "Accessibility",
  performance: "Performance",
  webmcp: "WebMCP",
};

function buildSidebar() {
  if (!existsSync(docsDir)) {
    return [];
  }

  const entries = readdirSync(docsDir);
  const topLevel = [];

  for (const entry of entries) {
    if (entry.startsWith("_") || /^index\.(md|mdx)$/.test(entry)) continue;

    const fullPath = path.join(docsDir, entry);
    if (!statSync(fullPath).isDirectory() && /\.(md|mdx)$/.test(entry)) {
      topLevel.push(entry.replace(/\.(md|mdx)$/, ""));
    }
  }

  const sidebar = [];
  const remaining = new Set(topLevel);

  for (const group of SIDEBAR_GROUPS) {
    const items = group.items
      .filter((slug) => remaining.delete(slug))
      .map((slug) =>
        SIDEBAR_LABELS[slug] ? { label: SIDEBAR_LABELS[slug], link: `/${slug}` } : slug,
      );
    if (items.length === 0) continue;
    if (sidebar.length === 0) items.unshift({ label: "Overview", link: "/" });
    sidebar.push({ label: group.label, items });
  }

  if (remaining.size > 0) {
    sidebar.push({ label: "More", items: [...remaining].sort() });
  }
  return sidebar;
}

export default defineConfig({
  // Served at drawcms.com/docs by the drawcms-docs Worker (route pattern
  // drawcms.com/docs*); the blog lives at drawcms.com/blog (site-blog/).
  site: "https://drawcms.com",
  base: "/docs",
  // Extensionless canonical URLs (/docs/quick-start, not /docs/quick-start/).
  build: { format: "file" },
  // Emit the /docs prefix into the asset tree so the drawcms-docs Worker can
  // serve drawcms.com/docs* straight from its assets (URLs and file paths align).
  outDir: "dist/docs",
  vite: {
    // Docs content lives in a symlinked folder outside site/, so mdx imports
    // of Starlight components fail to resolve without an explicit alias.
    resolve: {
      alias: [
        {
          find: /^@astrojs\/starlight\/components$/,
          replacement: new URL("./node_modules/@astrojs/starlight/components.ts", import.meta.url)
            .pathname,
        },
      ],
    },
  },
  markdown: {
    remarkPlugins: [
      [remarkAppOrigin, { appOrigin: APP_ORIGIN }],
      [
        remarkContentLinks,
        { githubBase: GITHUB_URL, ref: "main", contentRoot: docsDir, docsPrefix: "docs/" },
      ],
    ],
  },
  integrations: [
    starlight({
      title: "DrawCMS Docs",
      description: "Documentation and guides for DrawCMS — animated technical diagrams.",
      logo: { src: "./public/logo.svg" },
      favicon: "/favicon.svg",
      customCss: ["./src/styles/custom.css"],
      components: {
        Header: "./src/components/Header.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
        Sidebar: "./src/components/Sidebar.astro",
        Pagination: "./src/components/Pagination.astro",
        Footer: "./src/components/Footer.astro",
        PageTitle: "./src/components/PageTitle.astro",
      },
      social: [{ icon: "github", label: "GitHub", href: GITHUB_URL }],
      sidebar: buildSidebar(),
    }),
  ],
});
