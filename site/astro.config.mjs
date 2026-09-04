import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightBlog from "starlight-blog";
import { remarkAppOrigin, resolveAppOrigin } from "./plugins/remark-app-origin.mjs";
import { remarkContentLinks } from "./plugins/remark-content-links.mjs";

const siteRoot = fileURLToPath(new URL("./", import.meta.url));
const docsDir = path.join(siteRoot, "src", "content", "docs");

const GITHUB_URL = "https://github.com/drawcms/drawcms";
const APP_ORIGIN = resolveAppOrigin(
  process.env.PUBLIC_DRAWCMS_APP_URL ?? process.env.PUBLIC_DRAWMS_APP_URL,
);

function contentRef() {
  try {
    const pin = JSON.parse(readFileSync(path.join(siteRoot, "content.config.json"), "utf8"));
    return pin.tag ?? "main";
  } catch {
    return "main";
  }
}

const SIDEBAR_GROUPS = [
  {
    label: "Get started",
    items: ["quick-start", "core-concepts"],
  },
  {
    label: "Deploy",
    items: ["self-hosting", "upgrading"],
  },
  {
    label: "Extend",
    items: ["plugin-api", "design-system", "public-api-versioning"],
  },
  {
    label: "Reference",
    items: [
      "document-format",
      "importer-limitations",
      "browser-support",
      "accessibility",
      "performance",
      "dependency-overrides",
    ],
  },
];

const GROUP_ORDER = ["decisions"];

const GROUP_LABELS = {
  decisions: "Decisions",
};

function humanize(name) {
  return GROUP_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

function groupNameToSlug(dirPath, fileName) {
  return path.join(path.basename(dirPath), fileName.replace(/\.(md|mdx)$/, ""));
}

function buildSidebar() {
  if (!existsSync(docsDir)) {
    return [];
  }

  const entries = readdirSync(docsDir);
  const topLevel = [];
  const groups = [];

  for (const entry of entries) {
    if (entry.startsWith("_") || /^index\.(md|mdx)$/.test(entry)) continue;

    const fullPath = path.join(docsDir, entry);
    if (!statSync(fullPath).isDirectory()) {
      if (/\.(md|mdx)$/.test(entry)) topLevel.push(entry.replace(/\.(md|mdx)$/, ""));
      continue;
    }

    if (entry === "blog") continue;

    const items = readdirSync(fullPath)
      .filter((file) => !file.startsWith("_") && /\.(md|mdx)$/.test(file))
      .map((file) => groupNameToSlug(fullPath, file));
    if (items.length > 0) groups.push({ name: entry, label: humanize(entry), items: items.sort() });
  }

  groups.sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a.name);
    const indexB = GROUP_ORDER.indexOf(b.name);
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const sidebar = [];
  const remaining = new Set(topLevel);

  for (const group of SIDEBAR_GROUPS) {
    const items = group.items.filter((slug) => remaining.delete(slug));
    if (items.length === 0) continue;
    if (sidebar.length === 0) items.unshift({ label: "Overview", link: "/" });
    sidebar.push({ label: group.label, items });
  }

  if (remaining.size > 0) {
    sidebar.push({ label: "More", items: [...remaining].sort() });
  }
  for (const group of groups) {
    sidebar.push({ label: group.label, items: group.items });
  }
  return sidebar;
}

export default defineConfig({
  site: "https://docs.drawcms.com",
  markdown: {
    remarkPlugins: [
      [remarkAppOrigin, { appOrigin: APP_ORIGIN }],
      [remarkContentLinks, { githubBase: GITHUB_URL, ref: contentRef(), contentRoot: docsDir }],
    ],
  },
  integrations: [
    starlight({
      title: "DrawCMS Docs",
      description: "Documentation, guides, and blog for DrawCMS — animated technical diagrams.",
      logo: { src: "./public/logo.svg" },
      favicon: "/favicon.svg",
      customCss: ["./src/styles/custom.css"],
      components: {
        Header: "./src/components/Header.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      social: [{ icon: "github", label: "GitHub", href: GITHUB_URL }],
      plugins: [
        starlightBlog({
          title: "Blog",
          metrics: { readingTime: true },
          authors: {
            drawcms: {
              name: "DrawCMS Team",
              url: GITHUB_URL,
            },
          },
        }),
      ],
      sidebar: buildSidebar(),
    }),
  ],
});
