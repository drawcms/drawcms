---
title: "Upgrading"
---

## Upgrading self-hosted deployments

1. Pull the release and rebuild: `git pull && npm ci && npm run build`.
2. Re-copy editor assets if the release notes mention icon/GIF worker changes:
   `npx drawcms-copy-assets packages/web/public`.
3. Restart the app. There are no database migrations — documents live in
   browsers and in `.drawcms` files.

Users' browser-saved documents migrate automatically on open (see below), so
web app upgrades never strand existing work.

## Upgrading `@drawcms/editor` in your app

```bash
npm install @drawcms/editor@latest
npx drawcms-copy-assets ./public
npm run build
```

Follow semver: patch releases are safe, minor releases add public API,
and `CHANGELOG`-announced majors can break it. The public surface is defined
by `packages/editor/src/index.ts` (guarded by `public-api.test.ts`) and
versioned per [public-api-versioning.md](public-api-versioning.md).

## Document migrations

Documents are versioned independently of the package
([document format](document-format.md)). `migrateDocument` runs automatically
on open/import and upgrades v1 (and legacy v0) documents all the way to the
current schema — through the v2 timed-motion shell, the v3 narrative story
split, the v4 attached sequence messages, and the v5 removal of the unplayed
motion timeline. Downgrades are not supported: an old editor refuses
documents from a newer schema version rather than guessing, and unknown
fields are **preserved** on round trips.
