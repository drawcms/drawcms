---
title: "The DrawCMS agent skill"
description: "Turn a code repository into maintained DrawCMS diagrams from the command line — synced to DrawCMS Cloud, or built for a self-hosted editor with no account."
---

The DrawCMS **agent skill** is a portable skill folder plus a git-like CLI
(`drawcms`) that turns a code repository into validated DrawCMS diagrams. An AI
coding agent (Claude Code, Codex, OpenCode, OpenClaw, Hermes, and similar) reads
your repo,
authors typed JSON, and the CLI validates every diagram against the real DrawCMS
engine before it goes anywhere. The CLI never guesses topology — the agent does
the judgment, the CLI does the deterministic build and sync.

It works two ways:

- **DrawCMS Cloud** — sign in, bind the repo to a project, and push diagrams
  that stay in sync as the code changes (`login → init → pull → push`).
- **Self-hosted editor (limited)** — no account and no server. Build a document
  offline and load it into your [self-hosted open-source editor](self-hosting.md).

## Install

Install the skill into your coding agent with one command:

```bash
npx skills add drawcms/drawcms-skill -g
```

The `-g` flag installs it globally for every agent on your machine; drop it to
install into the current project only. This installs the **skill files** — the
instructions your agent loads plus the `drawcms` CLI (`bin/`, `lib/`, scripts).

The one thing left is the diagram engine: a prebuilt bundle that is downloaded
(not committed), so it is absent right after install. **Your agent fetches it
automatically** the first time it runs an engine command — SKILL.md tells it to
run `scripts/fetch-engine.mjs` (Node only, no `npm install`) on an
`ENGINE_MISSING` error and retry. To do it yourself up front, run that script
from wherever the skill was installed, e.g.:

```bash
node ~/.claude/skills/drawcms/scripts/fetch-engine.mjs   # checksum-verified download
```

Nothing else is required — no `git clone`, no `npm install`. The CLI runs on
Node ≥18 alone (the engine bundle carries its own dependencies). If you want the
short `drawcms` command on your `PATH` instead of
`node <skill-folder>/bin/drawcms.mjs`, see the skill's README for `npm link`.
Verify anytime with:

```bash
node ~/.claude/skills/drawcms/bin/drawcms.mjs doctor   # expect: node OK, engine OK
```

`doctor` checks Node (>=18) and that the diagram engine loads. Every command
supports `--help` and a `--json` machine receipt.

## Which mode am I in?

|                        | DrawCMS Cloud                                | Self-hosted editor                       |
| ---------------------- | -------------------------------------------- | ---------------------------------------- |
| Account / login        | Yes (`drawcms login`, device flow)           | None                                     |
| Repo → project binding | `drawcms init` writes `.drawcms/config.json` | Not applicable                           |
| Delivery               | `drawcms push` (diagram gets a cloud URL)    | `drawcms local` (writes a loadable file) |
| Stays in sync          | Yes — `status` / `diff` / `pull` / `push`    | Re-run `drawcms local` after changes     |
| Share links, autosave  | Yes                                          | No — local-only                          |

Authoring and validation (`build`, `edit`, `recommend`, `grammar`) are identical
in both modes and never touch the network.

## Using it with DrawCMS Cloud

Tell your agent what you want, for example:

> Diagram this repo's runtime architecture in DrawCMS and push it.

The agent runs the git-like flow. The commands it uses:

```bash
drawcms login --begin      # prints a verification URL + code, then exits
# approve in the browser, then:
drawcms login --finish     # stores a session token in ~/.drawcms/config.json

drawcms init               # binds this repo to a DrawCMS project (a project
                           # represents the repo; the project is named after it)

# the agent authors .drawcms/<name>.json, then:
drawcms build architecture .drawcms/architecture.json --json   # validate offline
drawcms push                                                   # save to the cloud
```

`push` fails closed — an invalid or generically-named document is never sent —
and reports the diagram's **URL** so you can open it. On a later run the agent
uses `drawcms status` / `drawcms diff` to see what changed and updates the
diagram rather than rebuilding it.

If you are testing against a **local or self-hosted Cloud instance** rather than
[drawcms.com](https://drawcms.com), point the CLI at it first:

```bash
export DRAWCMS_ORIGIN=http://localhost:3000
```

The CLI attaches your session token only to trusted origins: it refuses
cleartext `http://` for anything but `localhost`, and refuses to send the token
to an origin different from where you logged in unless you acknowledge it with
`--origin` or `DRAWCMS_ALLOW_CROSS_ORIGIN=1`.

See [DrawCMS Cloud](cloud.md) for what the hosted product adds.

## Using it with a self-hosted editor (limited)

The open-source editor is a **local-only canvas**: no account, no projects, no
server API. It stores one document in the browser (`localStorage`). So the sync
commands (`login` / `init` / `pull` / `push`) do not apply — there is nothing to
push to. The skill covers the cloud-less path with `drawcms local`.

Tell your agent your target is the self-hosted editor, for example:

> Build a sequence diagram of the checkout flow for my self-hosted DrawCMS
> editor at http://localhost:3002.

The agent authors the spec, then builds and delivers it:

```bash
drawcms local sequence .drawcms/checkout.json --seed --editor http://localhost:3002
```

`local` validates through the same engine as `build`, writes a loadable
`DrawCMSDocument`, and prints how to open it. There are two load paths — the CLI
runs on your machine and writes a file, so delivery is always one of these:

1. **Import the file.** Open the editor and use its import to open the written
   document (for example `checkout.built.json`).
2. **Seed `localStorage`.** With `--seed`, the CLI prints a one-line snippet.
   Open the editor tab, open the DevTools console, paste the snippet, and press
   enter — the page reloads with the diagram on the canvas. The snippet sets the
   editor's document key (`drawcms.document.v1`).

You can also pass a tracked diagram name instead of a path (for example
`drawcms local sequence checkout` when `.drawcms/checkout.json` exists).

`--editor <url>` only composes the load hint and must be `https` or `localhost`;
it defaults to `http://localhost:3002` (the OSS editor's default port).

### What self-hosted mode cannot do

Share links, project organization, autosave, and version history are
[DrawCMS Cloud](cloud.md) features. In self-hosted mode the skill will not claim
a diagram was "pushed" or hand you a cloud URL — it reports the written file and
the load instructions instead. If your agent drives the editor through a browser
that supports [WebMCP](webmcp.md), it can also push a built diagram straight onto
the canvas through the editor's WebMCP tools — that is the browser path, separate
from `drawcms local`.

## Command reference

| Command                                 | Mode        | Purpose                                                                                        |
| --------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `drawcms doctor`                        | both        | Check Node and the diagram engine.                                                             |
| `drawcms build <type> <spec.json>`      | both        | Build + validate a spec offline.                                                               |
| `drawcms local [<type>] <spec\|name>`   | self-hosted | Build for a self-hosted editor; write a loadable document + load hints (`--seed`, `--editor`). |
| `drawcms edit <name> <ops.json>`        | both        | Apply incremental graph edits, preserving positions.                                           |
| `drawcms recommend <entities.json>`     | both        | Suggest the closest element per entity.                                                        |
| `drawcms grammar [id]`                  | both        | Query the visual grammar (elements, motion, relationships).                                    |
| `drawcms login`                         | cloud       | Device-flow sign-in; stores a token.                                                           |
| `drawcms init`                          | cloud       | Bind this repo to a DrawCMS project.                                                           |
| `drawcms pull [name]`                   | cloud       | Fetch cloud document(s) into `.drawcms/`.                                                      |
| `drawcms push [name]`                   | cloud       | Validate + save local document(s) to the cloud.                                                |
| `drawcms status`                        | cloud       | Show local edits and code-drift since last sync.                                               |
| `drawcms diff [name] [--against-cloud]` | cloud       | Show code changes and, with `--against-cloud`, a node/edge delta vs the live cloud document.   |

The diagram types, authoring rules, visual grammar, and story/motion model are
the same the [WebMCP tools](webmcp.md) use and the same the editor validates
against — see [core concepts](core-concepts.md) and the
[document format](document-format.md).
