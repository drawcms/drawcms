---
title: "Design system"
description: "Theme DrawCMS hosts with the editor's public CSS tokens and font contract."
---

DrawCMS ships its public visual tokens through `@drawcms/editor/styles.css`. Hosts must import that
stylesheet before their own overrides. The editor never bundles a web font; it inherits the host's
font variables and falls back to system fonts.

## Theme contract

The default theme is light. Add `.dark` to an ancestor—normally `<html>`—to activate the dark
palette. Hosts may override these stable custom properties after importing the stylesheet:

| Property                 | Purpose                                 |
| ------------------------ | --------------------------------------- |
| `--drawcms-canvas`       | Application and editor canvas chrome    |
| `--drawcms-surface`      | Cards, panels, and fixed chrome         |
| `--drawcms-elevated`     | Menus, dialogs, and popovers            |
| `--drawcms-ink`          | Primary text and meaningful icons       |
| `--drawcms-muted-ink`    | Secondary text                          |
| `--drawcms-border`       | Hairline separators and control borders |
| `--drawcms-accent`       | Primary actions, selection, and focus   |
| `--drawcms-accent-hover` | Accent hover state                      |
| `--drawcms-accent-soft`  | Selected and informative backgrounds    |
| `--drawcms-focus`        | Keyboard focus ring                     |
| `--drawcms-success`      | Success state                           |
| `--drawcms-warning`      | Warning state                           |
| `--drawcms-danger`       | Destructive and error state             |

Set `--font-drawcms-sans` and `--font-drawcms-display` on the host root to provide branded fonts.
The public web apps use Inter and Source Serif 4 respectively.

## Stability

Token names are part of the editor's public CSS surface from `0.12.0`. Values may be refined in a
minor release, but token removal or semantic reassignment requires a compatibility note. Theme
changes affect application chrome only; document-authored colors and exported output remain under
the diagram document's control.
