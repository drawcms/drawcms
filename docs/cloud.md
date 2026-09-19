---
title: "DrawCMS Cloud"
description: "What the hosted version adds, how your diagrams are stored, and how it differs from self-hosting."
---

DrawCMS Cloud is the hosted version of DrawCMS at
[drawcms.com](https://drawcms.com). It runs the same editor and reads the same
`.drawcms` document format as the open-source app. The difference is not the
editor, it is what surrounds it: an account, diagram storage, sharing, billed
exports, and updates you do not have to manage yourself.

## Cloud vs self-hosted

|                            | DrawCMS Cloud                             | Self-hosted                                |
| -------------------------- | ----------------------------------------- | ------------------------------------------ |
| Accounts                   | Sign in, owned diagrams                   | No account, browser-local storage          |
| Diagram storage            | Saved to your account with autosave       | Active document kept in browser storage    |
| Backup and recovery        | Autosave, revisions, conflict recovery    | Manual `.drawcms` file save/download       |
| Sharing                    | Revocable view links and iframe embeds    | None; share the file or a screen recording |
| Exports                    | PNG, GIF, SVG, and MP4 within plan limits | PNG and GIF, generated locally             |
| Team access                | Personal workspaces (see constraints)     | Not applicable                             |
| Billing                    | Subscription with invoices                | Not applicable                             |
| Updates                    | Continuous, managed by DrawCMS            | You upgrade when you choose                |
| Data location              | Managed by DrawCMS                        | Your own infrastructure                    |
| Editor and document format | Same as self-hosted                       | Same as Cloud                              |

For the open-source, local-first editor, use the
[self-hosting guide](self-hosting.md).

To generate and sync diagrams from a code repository on the command line, see
the [agent skill](agent-skill.md) — it pushes to Cloud with a git-like flow, or
builds for a self-hosted editor.

## Sharing and embeds

A Cloud viewer link opens `/share/<token>`. Its matching embed URL is
`/embed/<token>`. Both are read-only: viewers can pan, zoom, and move through
presentation steps, but cannot change the diagram. Embed routes allow framing;
other Cloud routes deny it.

Create and revoke links from a diagram's Share dialog. Treat a viewer URL as a
secret while it is active: anyone who has it can open the published diagram
until the link expires or is revoked.

GitHub does not render iframes in README files. Export a GIF, commit it to the
repository, and link that image to the Cloud share URL instead. The
[quick start](quick-start.md#embed-a-cloud-presentation) has both snippets.

## Exports

Self-hosted DrawCMS exports PNG and GIF entirely in your browser. Cloud adds
plan-controlled SVG and MP4 export. MP4 encoding also happens in your browser
through WebCodecs, so a browser without an H.264 encoder falls back to GIF
rather than moving the work to a server. See
[browser support](browser-support.md) for the capability matrix.

## Accounts and sessions

Cloud signs you in through email and password, with optional Google or GitHub
sign-in. Authentication is managed for you; there is no identity provider to run
yourself. A hosted account owns its diagrams, and server-side checks decide
whether a request may read or change a diagram.

## Current product constraints

- Workspaces are personal. Team membership and invitations are not available yet
  and should not be relied on.
- Share links and embeds are view-only, even if an older link was created as
  editable.
- Cloud reads the current versioned document format; older supported documents
  migrate when opened.
- Diagram creation, revisions, renders, and storage are plan-limited. See the
  current [pricing page](https://drawcms.com/pricing) for the limits that apply
  to your plan rather than copying numbers into integrations.

## Plans, billing, and support

Cloud is a paid product; there is no free plan. Pricing, what each plan
includes, and how to upgrade or cancel are on the
[pricing page](https://drawcms.com/pricing). For billing questions or account
issues, use the support channel listed on your account or on the pricing page.

## Where DrawCMS Cloud starts and stops

DrawCMS Cloud is a separate proprietary application. It is not part of the
open-source distribution, and its internal source and operations documentation
are not published. Everything about **using** the editor — the canvas, the
element palette, motion, presentation steps, importers, and the `.drawcms`
format — is identical on Cloud and self-hosted, and is documented in this site.

Ready to try it? Open the hosted editor at
[drawcms.com](https://drawcms.com).
