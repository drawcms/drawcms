---
title: "Self-hosting the DrawCMS web app"
---

`@drawcms/web` (in `packages/web`) is a Next.js 16 app with zero backend
dependencies: all persistence is browser-local (`localStorage` + explicit
`.drawcms` file save/download). Any static-capable Node host can serve it.

## Build and serve

```bash
git clone https://github.com/dimasna/drawcms.git
cd drawcms
npm install
npm run build        # builds the editor package, then the web app
npm run start -w packages/web
```

The app listens on port 3000 by default (`PORT=4000 npm run start -w
packages/web` to change it). No environment variables are required.

| Variable                | Purpose                                                                                                                                       | Default                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_CLOUD_URL` | Shows a "Try DrawCMS Cloud" CTA on the landing page, and points the editor's locked SVG/MP4 export and Share button at your managed instance. | unset (CTA hidden; locked exports show fallback text)     |
| `NEXT_PUBLIC_DOCS_URL`  | Sets the Docs and Blog link origin.                                                                                                           | `http://localhost:4321` in dev; hosted docs in production |

## What ships where

- `/` — landing page (sample animation, links into the editor).
- `/editor` — the editor itself. Self-hosted brands often reverse-proxy
  `example.com/editor` and keep marketing elsewhere; nothing is route-coupled.
- `public/cloud-icons/` and `public/gif.worker.js` are committed copies
  produced by `npx drawcms-copy-assets packages/web/public`; icon and GIF
  worker updates arrive with editor package upgrades — re-copy them when
  `npm run build` warns about assets (or just always re-copy after upgrading).

## Verification checklist

After deploying:

1. `/` loads, sample animation plays (respecting `prefers-reduced-motion`).
2. `/editor` opens with onboarding; the guided sample plays its sequence.
3. `File → Save` downloads a `.drawcms` file; reopening it restores state.
4. A refresh keeps the document (browser autosave chip shows "Saved locally").
5. Export → GIF produces a deterministic three-second recording of the sample.
