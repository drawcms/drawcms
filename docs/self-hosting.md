---
title: "Self-hosting the DrawCMS web app"
---

DrawCMS is a single self-contained Next.js 16 application: the editor engine
lives in `src/editor/`, the app host in `src/app/`. There is no backend
dependency — all persistence is browser-local (`localStorage` + explicit
`.drawcms` file save/download) — so any Node host or edge runtime can serve it.

## Build and serve

```bash
git clone https://github.com/drawcms/drawcms.git
cd drawcms
npm install
npm run build
npm start
```

The app listens on port 3002 by default (`npx next start -p 4000` to change
it). No environment variables are required.

| Variable                | Purpose                                                                                                   | Default                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_CLOUD_URL` | Points the editor's locked SVG/MP4 export and Share surfaces at your managed instance and shows its CTAs. | unset (SVG/MP4 exports and sharing stay locked) |

## Deploy targets

The repository ships ready-made adapters; the production build also sets
security headers (CSP, HSTS) in `next.config.ts`:

- **Vercel / Netlify** — zero-config Next.js deployments
  (`netlify.toml` is included; the README has deploy buttons).
- **Render** — `render.yaml` blueprint (free plan works; the app is
  client-side and local-first).
- **Cloudflare Workers** — `npm run build:cloudflare` (OpenNext, pinned
  `@opennextjs/cloudflare`) and `npm run deploy:cloudflare`.
- **Any Node host** — `output: "standalone"` produces a self-contained
  server bundle under `.next/standalone`.

## What ships where

- `/` — landing page (sample animation, links into the editor).
- `/editor` — the editor itself. Self-hosted brands often reverse-proxy
  `example.com/editor` and keep marketing elsewhere; nothing is route-coupled.
- `public/cloud-icons/` and `public/gif.worker.js` are committed copies of the
  editor's static assets — they ship with the repository and need no extra
  build step.

The documentation and blog sites in this repository (`site/` and
`site-blog/`) are optional static deployments of their own — see the README.

## Verification checklist

After deploying:

1. `/` loads, sample animation plays (respecting `prefers-reduced-motion`).
2. `/editor` opens with onboarding; the guided sample plays its sequence.
3. `File → Save` downloads a `.drawcms` file; reopening it restores state.
4. A refresh keeps the document (browser autosave chip shows "Saved locally").
5. Export → GIF produces a deterministic recording of the sample.
