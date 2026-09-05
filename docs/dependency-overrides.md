---
title: "Dependency override policy"
---

Next.js 16.2.12 is pinned in this repository. On 2026-07-29, its declared
PostCSS and optional Sharp ranges still resolved to versions covered by current
npm advisories even though 16.2.12 was the latest stable Next.js release. On
2026-08-12, newly published audit findings added vulnerable transitive ranges
under lint and build tooling.

The application therefore pins patched versions through npm `overrides` in
`package.json`:

- `postcss` 8.5.25 (and `nanoid` 3.3.18 under it)
- `sharp` 0.35.3
- `js-yaml` 4.3.1 under ESLint
- `brace-expansion` 1.1.18 under minimatch 3, and 5.0.9 under minimatch 10
- `@babel/core` 7.29.7

These are audit-driven pins, not upgrades: they track the patched versions the
affected ranges should have resolved to, and they exist because the pinned
Next.js 16.2.12 (and current lint tooling) still declares the vulnerable
ranges.

Remove an override only after the selected upstream releases declare
non-vulnerable compatible versions and a production audit (`npm audit`)
remains clean. Each removal should note the advisory that motivated the pin.
