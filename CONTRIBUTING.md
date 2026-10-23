# Contributing to DrawCMS

Thank you for improving DrawCMS.

## Before you contribute

- Search existing issues before opening a new one.
- For a substantial feature or data-model change, open a design issue first.
- Accept the [Contributor License Agreement](CLA.md) on your pull request (see
  below). The CLA lets the public editor remain AGPL while allowing the
  maintainer to offer a separately licensed commercial product.
- Do not submit code, assets, icons, fonts, or examples that you do not have
  permission to contribute.

### Contributor License Agreement

External pull requests run a CLA check (workflow `.github/workflows/cla.yml`).

1. Open the pull request as usual.
2. The check fails until every human co-author has accepted the current CLA.
   A bot comment on the PR links to [CLA.md](CLA.md) and asks for a signature.
3. Reply with exactly this comment (copy and paste):

   ```text
   I have read the CLA Document and I hereby sign the CLA
   ```

4. The workflow records your GitHub identity against the current CLA revision
   on the `cla-signatures` branch (`signatures/versionN/cla.json`) and the
   check turns green. You only need to do this once per CLA revision.
5. If the check is stale after signing, comment `recheck`.

A PR checkbox or informal "I agree" in the description does not count. Do not
merge an external PR while the CLA check is failing.

When [CLA.md](CLA.md)'s Version header changes, maintainers bump
`path-to-signatures` in the CLA workflow to a new `signatures/versionN/` path
so previous acceptances no longer satisfy the check and contributors re-sign.

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
