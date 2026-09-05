---
title: "Upgrading"
---

## Upgrading self-hosted deployments

1. Pull the release and rebuild: `git pull && npm ci && npm run build`.
2. Restart the app. There are no database migrations — documents live in
   browsers and in `.drawcms` files, and static editor assets
   (`public/cloud-icons/`, `public/gif.worker.js`) are committed with the code.

Users' browser-saved documents migrate automatically on open (see below), so
web app upgrades never strand existing work.

## Upgrading a repository that embeds the editor source

The editor engine lives in this repository at `src/editor/` and versions
together with the app — there is no separate editor package to bump. Follow
semver on the repository version: patch releases are safe, minor releases add
public API, and majors can break it. The public surface is defined by
`src/editor/index.ts` (guarded by `src/editor/public-api.test.ts`) and
versioned per [public-api-versioning.md](public-api-versioning.md).

> The legacy npm package `@drawcms/editor@0.12.4` is frozen and no longer
> receives updates. Embedders should track this repository instead.

## Document migrations

Documents are versioned independently of releases
([document format](document-format.md)). `migrateDocument` runs automatically
on open/import and upgrades v1 (and legacy v0) documents all the way to the
current schema — through the v2 timed-motion shell, the v3 narrative story
split, the v4 attached sequence messages, and the v5 removal of the unplayed
motion timeline. Downgrades are not supported: an old editor refuses
documents from a newer schema version rather than guessing, and unknown
fields are **preserved** on round trips.
