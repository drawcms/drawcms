---
title: "Blog post template"
date: 2026-08-29
description: "Copy this file to write a new DrawCMS blog post. Files starting with an underscore are ignored by the docs site."
excerpt: "Copy this file to write a new DrawCMS blog post."
tags:
  - meta
authors:
  - name: "Your GitHub display name"
    title: "@your-github-handle"
    picture: "https://github.com/your-github-handle.png?size=96"
    url: "https://github.com/your-github-handle"
cover:
  alt: "Describe the cover image for readers who cannot see it"
  image: ./slug-cover.svg
featured: false
---

Copy `_template.md` to `slug.md` in this folder and edit it. The filename becomes the post URL slug (`/blog/slug/`) — keep it friendly and evergreen, with no date prefix; the publish date comes from the `date` frontmatter field.

## Frontmatter

| Field         | Required | Notes                                                                           |
| ------------- | -------- | ------------------------------------------------------------------------------- |
| `title`       | Yes      | Displayed at the top of the post and in the post list                           |
| `date`        | Yes      | `YYYY-MM-DD`; posts are sorted newest first                                     |
| `description` | No       | Used for SEO and social previews                                                |
| `excerpt`     | No       | Short summary for the post list; falls back to the post content                 |
| `tags`        | No       | Shown on the post and grouped on the tags page                                  |
| `authors`     | No       | Inline GitHub author profile: display name, handle, avatar URL, and profile URL |
| `cover`       | No       | Local thumbnail metadata; keep the image beside the Markdown file               |
| `featured`    | No       | `true` pins the post to the "Featured posts" sidebar group                      |
| `draft`       | No       | `true` hides the post from production builds                                    |

## Cover images

Store cover images in the OSS repo beside the post (for example,
`slug-cover.svg`) and reference them relative to the post file:

```yaml
cover:
  alt: "A short description of the cover image"
  image: ./slug-cover.svg
```

Use a 16:10 image when possible so the blog index can show every cover without layout shift.

## Author profile

The blog reads author details from this Markdown frontmatter. Use the GitHub display name and a
stable profile/avatar URL so the post page and blog list identify the contributor who created it:

```yaml
authors:
  - name: "Your GitHub display name"
    title: "@your-github-handle"
    picture: "https://github.com/your-github-handle.png?size=96"
    url: "https://github.com/your-github-handle"
```

## Style

- Write for someone who just opened the editor for the first time.
- Prefer short sections with headings; code blocks get a copy button and syntax highlighting.
- Internal links: docs pages use `/docs/slug/` paths (e.g. `/docs/quick-start/`), other posts use `/blog/slug/`.
- Mention release versions and dates so readers can tell how current the post is.
