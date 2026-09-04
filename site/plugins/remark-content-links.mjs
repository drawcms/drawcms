import path from "node:path";
import { visit } from "unist-util-visit";

function isExternal(url) {
  return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith("/") || url.startsWith("#");
}

function toSlug(relativePath, prefix) {
  const withoutExt = relativePath.replace(/\.(md|mdx)$/, "");
  return withoutExt ? `/${prefix}${withoutExt}/` : `/${prefix}`;
}

export function remarkContentLinks(options) {
  const { githubBase = "https://github.com/dimasna/drawcms", ref = "main", contentRoot } = options;
  const root = path.resolve(contentRoot ?? "");

  return (tree, vfile) => {
    const filePath = vfile.path ?? "";
    if (!root || !filePath.startsWith(root)) return;

    const relFromContent = filePath.slice(root.length + 1);
    const pageDir = path.posix.dirname(relFromContent);
    const repoDir = relFromContent.startsWith("blog/")
      ? path.posix.join("blog", pageDir.replace(/^blog\/?/, ""))
      : path.posix.join("docs", pageDir === "." ? "" : pageDir);

    visit(tree, "link", (node) => {
      const url = node.url;
      if (isExternal(url)) return;

      const hashIndex = url.indexOf("#");
      const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
      const target = hashIndex === -1 ? url : url.slice(0, hashIndex);
      if (!target) return;

      const resolved = path.posix.normalize(path.posix.join(repoDir, target));
      const repoPath = resolved.replace(/^(\.\.\/)+/, "");

      if (repoPath === "blog" || repoPath.startsWith("blog/")) {
        if (repoPath === "blog" || repoPath === "blog/") {
          node.url = "/blog/" + hash;
          return;
        }
        if (/\.(md|mdx)$/.test(repoPath)) {
          node.url = toSlug(repoPath.replace(/^blog\/?/, ""), "blog/") + hash;
        } else {
          node.url = `${githubBase}/blob/${ref}/${repoPath}`;
        }
        return;
      }

      if (repoPath.startsWith("docs/")) {
        const docsPath = repoPath.replace(/^docs\//, "");
        if (/\.(md|mdx)$/.test(docsPath)) {
          node.url = toSlug(docsPath, "") + hash;
        } else {
          node.url = `${githubBase}/blob/${ref}/${repoPath}`;
        }
        return;
      }

      node.url = `${githubBase}/blob/${ref}/${repoPath}`;
    });
  };
}
