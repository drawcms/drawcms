// Post-build URL normalization for extensionless canonical URLs.
// Astro's `build.format: "file"` emits canonical/og:url meta tags and a few
// rendered links with `.html` or trailing slashes; the Workers assets config
// (`html_handling: "drop-trailing-slash"`) serves the extensionless form, so
// every emitted URL is normalized here to match the canonical scheme.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SITE = process.env.SITE_URL_PREFIX ?? "/blog";

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

const dist = path.resolve("dist");
let changed = 0;

for (const file of walk(dist)) {
  if (file.endsWith(".html")) {
    const before = readFileSync(file, "utf8");
    const after = before
      // canonical + og:url meta tags
      .replace(/(rel="canonical" href="[^"]*)\.html"/g, '$1"')
      .replace(/(property="og:url" content="[^"]*)\.html"/g, '$1"')
      // rendered links: drop .html, then resolve /x/index → /x, then trailing
      // slashes on internal page links
      .replace(/(href="[^"]*)\.html"/g, '$1"')
      .replace(/(href="[^"]*)\/index"/g, '$1"')
      .replace(new RegExp(`(href="${SITE}/[a-z0-9-]+)/"`, "g"), '$1"')
      .replace(new RegExp(`(href="${SITE})/"`, "g"), '$1"');
    if (after !== before) {
      writeFileSync(file, after);
      changed++;
    }
  }
}

// starlight-blog's RSS template hardcodes trailing slashes on post links;
// normalize them (the channel-level root link keeps its slash).
const rss = path.join(dist, "blog", "rss.xml");
try {
  const before = readFileSync(rss, "utf8");
  const after = before.replace(/(<link>https:\/\/drawcms\.com\/blog[^<]*)\/(<\/link>)/g, "$1$2");
  if (after !== before) {
    writeFileSync(rss, after);
    changed++;
  }
} catch {
  // no rss output — nothing to do
}
console.log(`normalize-urls: rewrote ${changed} file(s)`);
