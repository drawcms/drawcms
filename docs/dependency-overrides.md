---
title: "Dependency override policy"
---

Next.js 16.2.12 is pinned in both applications. On 2026-07-29, its declared
PostCSS and optional Sharp ranges still resolved to versions covered by current
npm advisories even though 16.2.12 was the latest stable Next.js release.

The workspace therefore pins patched versions through root npm overrides:

- `postcss` 8.5.25
- `sharp` 0.35.3

The OSS root also lists the exact Next.js version as a development dependency.
This duplicate pin is intentional: npm 11 does not enforce root child
overrides for a dependency that exists only inside a workspace. The pin makes
the resolved Next.js tree shared and override-aware while the web package keeps
its own exact production dependency.

The cloud repository additionally overrides `ws` to 8.21.1 for the Supabase
realtime client.

On 2026-08-12, newly published audit findings also required compatible patched
transitives while upstream lint/build packages still declared vulnerable
ranges:

- `js-yaml` 4.3.1 under ESLint;
- `brace-expansion` 1.1.18 under minimatch 3, and 5.0.9 under minimatch 10;
- `nanoid` 3.3.17 under the intentionally pinned PostCSS 8.5.25.

The editor directly pins jsPDF 4.2.1, the first release patched for the
critical new-window HTML injection advisory. This is a normal production
dependency pin, not an override.

Remove these overrides only after the selected upstream releases declare
non-vulnerable compatible versions and a production audit remains clean.
