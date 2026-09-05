# Contributing to DrawCMS

Thank you for improving DrawCMS.

## Before you contribute

- Search existing issues before opening a new one.
- For a substantial feature or data-model change, open a design issue first.
- Accept the [Contributor License Agreement](CLA.md) through the repository's
  CLA workflow. The CLA lets the public editor remain AGPL while allowing the
  maintainer to offer a separately licensed commercial product.
- Do not submit code, assets, icons, fonts, or examples that you do not have
  permission to contribute.

External pull requests must not be merged until the CLA workflow is installed
and records the contributor's acceptance.

## Development

Requirements: a supported Node.js release and npm.

```bash
npm ci
npm run dev        # editor on :3002 with hot reload
npm run test       # vitest suite
npm run ci         # lint → format:check → typecheck → test → build → sites:ci
```

The repository is a single Next.js app. The editor engine lives in
`src/editor/` (canvas, document format, motion, presentation, plugin API —
public API at `src/editor/index.ts`); the host application shell lives in
`src/app/`. Docs and blog content live in `docs/` and `blog/`, rendered by the
`site/` and `site-blog/` Astro sites (`npm run docs:dev` on :4321,
`npm run blog:dev` on :4322).

Deeper contributor reading: [Plugin & host API](docs/plugin-api.md),
[Design system](docs/design-system.md), [Performance budgets](docs/performance.md),
and the ADRs in [adr/](adr/).

### Dependency overrides

Some dependencies are pinned through npm `overrides` in `package.json`
(`postcss`, `sharp`, `js-yaml`, `brace-expansion`, `@babel/core`, `nanoid`).
These are audit-driven pins, not upgrades: they force the patched versions the
pinned Next.js release (and current lint tooling) should have resolved to.
Remove an override only after the selected upstream releases declare
non-vulnerable compatible versions and a production `npm audit` stays clean;
note the advisory that motivated the pin in the removal commit.

## Pull requests

- Keep changes focused and explain the user-visible effect.
- Add or update tests when behavior changes.
- Include screenshots or a recording for visual changes.
- Update documentation for public APIs, formats, configuration, or workflows.
- Confirm that required checks pass and that the CLA check is successful.

## Security

Do not open a public issue for a suspected vulnerability. Follow
[SECURITY.md](SECURITY.md).
