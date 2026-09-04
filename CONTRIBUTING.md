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
npm run build
```

The editor package is in `packages/editor`; the self-hosted application is in
`packages/web`.

## Pull requests

- Keep changes focused and explain the user-visible effect.
- Add or update tests when behavior changes.
- Include screenshots or a recording for visual changes.
- Update documentation for public APIs, formats, configuration, or workflows.
- Confirm that required checks pass and that the CLA check is successful.

## Security

Do not open a public issue for a suspected vulnerability. Follow
[SECURITY.md](SECURITY.md).
