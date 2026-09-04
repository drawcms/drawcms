---
title: "ADR 001: Licensing and repository boundary"
---

- Status: accepted
- Date: 2026-07-29

## Context

DrawCMS has a public editor repository and a separate commercial cloud
repository. The public project needs a recognized open-source license, while
the managed service must be distributable under proprietary terms.

At the time of this decision, repository history lists only the Maintainer as
an author. The license change must be revisited if any separately owned work is
later discovered.

## Decision

- The public `drawcms` repository is licensed under `AGPL-3.0-only`.
- The Commons Clause is removed.
- The cloud repository is proprietary and is not distributed under the AGPL.
- The copyright holder may use the editor in the cloud product under separate
  commercial rights. A commercial license for another party exists only when
  a separate agreement is signed.
- External contributions require a CLA granting the maintainer sufficient
  copyright and patent rights to relicense the contribution under both
  open-source and proprietary terms.
- Trademark rights remain separate from the software license.

## Consequences

- Anyone may operate a competing hosted service using the AGPL version if they
  comply with the AGPL, including its network-source obligations.
- AGPL does not automatically make the cloud repository open source when the
  cloud product uses an independently licensed copy of the editor.
- An AGPL-only third-party contribution cannot enter the proprietary cloud
  build unless the maintainer also receives the required separate rights.
- The repositories may remain separate, but cloud builds must consume a
  versioned editor package rather than sibling source or uncommitted output.
- Qualified counsel must review the CLA and commercial license before
  commercial reliance.
