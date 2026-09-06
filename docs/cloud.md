---
title: "DrawCMS Cloud"
description: "What the hosted product adds, how it stores diagrams, and how maintainers run it locally."
---

DrawCMS Cloud is the hosted application at
[drawcms.com](https://drawcms.com). It uses the same editor and `.drawcms`
document format as the open-source app, then adds accounts and server-backed
features.

| Open-source app                          | DrawCMS Cloud                                          |
| ---------------------------------------- | ------------------------------------------------------ |
| Active document saved in browser storage | Diagrams saved to an account                           |
| Manual `.drawcms` file backup            | Autosave, revisions, and recovery after save conflicts |
| PNG and GIF export                       | Plan-controlled SVG and MP4 export                     |
| No public links                          | Revocable view links and iframe embeds                 |
| No account or backend                    | Better Auth sessions and server-enforced access checks |

Use the [self-hosting guide](self-hosting.md) when you need the open-source,
local-first editor. DrawCMS Cloud is a separate proprietary application; the
Cloud source repository is not part of the AGPL distribution.

## Sharing and embeds

A Cloud viewer link opens `/share/<token>`. Its matching embed URL is
`/embed/<token>`. Both are read-only: viewers can pan, zoom, and move through
presentation steps, but cannot change the diagram. Embed routes allow framing;
other Cloud routes deny it.

Create and revoke links from a diagram's Share panel. Treat a viewer URL as a
secret while it is active: anyone who has it can open the published diagram
until the link expires or is revoked.

GitHub does not render iframes in README files. Export a GIF, commit it to the
repository, and link that image to the Cloud share URL instead. The
[quick start](quick-start.md#embed-a-cloud-presentation) has both snippets.

## Storage and request path

The production service runs as a Next.js application on Cloudflare Workers:

- D1 stores users, sessions, diagram metadata, revisions, shares, billing
  records, render jobs, and rate-limit counters.
- R2 stores versioned diagram payloads and completed MP4 files.
- KV stores the OpenNext incremental cache.
- Better Auth handles password and optional Google or GitHub sign-in.
- Creem handles checkout and subscription events. The webhook, not the
  browser, changes an account's plan.

D1 does not provide row-level security. Every server path that reads or writes
tenant data must call the shared team or diagram authorization helper. Input
validation, entitlement checks, and rate limits also run on the server.

MP4 encoding happens in the browser through WebCodecs. Cloud checks the plan
and render limits, creates a render record, and provides a signed R2 upload.
Cloud does not move encoding to a server when the browser lacks an H.264
encoder.

## Current product constraints

- Workspaces are personal. Team membership and invitations exist behind a
  disabled rollout flag and must not be presented as available features.
- Share links and embeds are view-only while teams are disabled, even if an
  older database row says `editor`.
- Cloud saves use the current versioned document format. Older supported
  documents migrate when read.
- Diagram creation, revisions, renders, and storage are plan-limited. See the
  current [pricing page](https://drawcms.com/pricing) instead of copying limits
  into integrations.

## Local development for Cloud maintainers

The private Cloud repository has two development modes.

For UI and ordinary server work, use the local SQLite driver:

```bash
npm ci
cp .env.example .env.development.local
npm run db:init
npm run dev
```

Open <http://localhost:3000>. Without R2 credentials, diagram payloads remain
in SQLite and MP4 upload is unavailable.

For deployment parity, use Miniflare with local D1, KV, and R2:

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run db:push
npm run build:cloudflare
npm run preview:cloudflare
```

This also opens on <http://localhost:3000>. Local Cloudflare state is kept
under `.wrangler/state`. Use `npm run observe:local` while the preview runs to
inspect recent traces; `npm run observe:local -- --routes` summarizes route
latency and errors.

Keep Creem test credentials in local files. Production billing values belong
only in encrypted Worker secrets. `npm run env:check` rejects a production
build that mixes test and live billing configuration.

## Updating the editor used by Cloud

Cloud consumes an exact packed editor release from `vendor/`; it never imports
from a sibling checkout. After releasing a new version in the public
`drawcms` repository, run this from the private Cloud repository:

```bash
node scripts/sync-editor.mjs --app ../drawcms
npm run ci
```

Commit the new `vendor/drawcms-editor-<version>.tgz`, `package.json`, and
`package-lock.json` together. The archive ships TypeScript source, so Cloud
compiles it through `transpilePackages`. Do not replace the archive pin with a
relative source path or a floating npm range.

## Before a Cloud change is ready

Run `npm run ci`. For storage, authentication, billing, or Worker-specific
changes, also run the Miniflare flow above and verify:

1. signup and login create a session;
2. a diagram saves, refreshes, and retains presentation steps;
3. a second account cannot read or change the diagram;
4. a viewer link opens `/share/<token>` and its embed opens
   `/embed/<token>` without edit controls;
5. `/api/health` reports healthy database, storage, and billing checks.

Deployment, backup, retention, incident response, and release procedures live
in the private Cloud repository under `docs/operations/` and `docs/release/`.
