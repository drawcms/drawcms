---
title: "Contributing"
description: "Set up DrawCMS, make a focused change, and prepare a pull request."
template: doc
eyebrow: "Project"
---

DrawCMS accepts fixes, documentation improvements, and focused features. Search the existing issues
before starting. For a substantial feature or data-model change, open an issue first so the design
can be agreed before implementation.

## Set up the repository

DrawCMS requires Node.js 24. From the repository root:

```bash
npm ci
npm run dev
```

The development server runs at `http://localhost:3002`. The repository is a single Next.js app:

- `src/editor/` contains the diagram editor.
- `src/app/` contains the application shell and routes.
- `public/` contains assets copied into builds and releases.
- `docs/` contains this documentation.
- `blog/` contains blog posts.

Use `npm run docs:dev` for the docs site and `npm run blog:dev` for the blog.

## Make the change

Keep changes focused and include tests when behavior changes. These references cover the contracts
most likely to affect contributors:

- [Plugin API](/docs/plugin-api) for public editor integration points.
- [Document format](/docs/document-format) for saved-file compatibility.
- [Design system](/docs/design-system) for stable CSS tokens.
- [Performance](/docs/performance) for budgets and measurement.
- [API versioning](/docs/public-api-versioning) for compatibility rules.

The dependency overrides in `package.json` are security pins. Do not remove or relax them without
checking the advisory and the removal criteria documented in the repository.

## Verify the change

Run the full local quality gate before opening a pull request:

```bash
npm run ci
```

It runs linting, formatting checks, type checking, tests, the application build, and both site
builds. During development, `npm run test` runs the test suite without the other checks.

## Pull request checklist

Before submitting:

- Explain what changed and why.
- Link the related issue when one exists.
- Add or update tests for behavior changes.
- Update documentation for user-facing or API changes.
- Confirm `npm run ci` passes.
- Confirm no secrets, credentials, generated output, or unrelated files are included.

Contributors must accept the project's Contributor License Agreement through the pull request
workflow. Only submit work you have permission to license. External pull requests cannot be merged
until the CLA check records acceptance.

## Report security issues

Do not open a public issue for a suspected vulnerability. Email `support@drawcms.com` with the
affected version, reproduction steps, impact, and any proposed mitigation.
