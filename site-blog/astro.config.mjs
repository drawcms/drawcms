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

export default defineConfig({
  // Served at drawcms.com/blog by the drawcms-blog Worker (route pattern
  // drawcms.com/blog*); the docs live at drawcms.com/docs (site/).
  site: "https://drawcms.com",
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
      title: "DrawCMS Blog",
      description: "Blog for DrawCMS — animated technical diagrams.",
      logo: { src: "./public/logo.svg" },
      favicon: "/favicon.svg",
      customCss: ["./src/styles/custom.css"],
      components: {
        Header: "./src/components/BlogHeader.astro",
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
      sidebar: [],
    }),
  ],
});
