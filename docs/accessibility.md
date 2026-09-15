---
title: "Accessibility"
---

DrawCMS targets WCAG 2.2 AA behavior for the editing, motion-preview, and
export journeys. `prefers-reduced-motion` disables nonessential animation;
preset playback remains available when the user explicitly asks for it.

## What is automated

`src/editor/components/a11y.test.tsx` runs in CI and locks in:

- Shape palette entries, motion-preset cards, and all menu items are real
  `<button>`s with accessible names — keyboard add/select works.
- Dropdown menus (File, Export) focus their first item on open, support
  `↑`/`↓`/`Home`/`End`, close on `Escape`, and return focus to the trigger.
- Selected states are announced (`aria-pressed`, `aria-expanded`,
  `aria-selected` on tabs).

## Keyboard shortcuts

Bindings and the hints shown in the right-click menu both come from
`src/editor/shortcuts.ts`, so they cannot disagree. `Mod` is `⌘` on Apple
platforms and `Ctrl` elsewhere. Shortcuts stand down while a text field is
focused, and bare-key ones also defer to any open menu, dialog, or flyout.

| Shortcut                      | Action                                                   |
| ----------------------------- | -------------------------------------------------------- |
| `Mod+Z` / `Mod+Shift+Z`       | Undo / redo (`Mod+Y` also redoes)                        |
| `Mod+X` / `Mod+C` / `Mod+V`   | Cut / copy / paste                                       |
| `Mod+D`                       | Duplicate                                                |
| `Mod+A`                       | Select all                                               |
| `Esc`                         | Cancel an armed connector tool, else clear the selection |
| `Delete` / `Backspace`        | Delete the selection                                     |
| `Mod+G` / `Mod+Shift+G`       | Group / ungroup                                          |
| `Mod+Shift+L`                 | Lock or unlock the selection                             |
| `Mod+Shift+.` / `Mod+Shift+,` | Step the font size of the selection up / down            |
| `N`                           | Add an element where the pointer is                      |
| `R`                           | Replace the selected element                             |
| `Shift+R`                     | Reverse the selected connector                           |
| `S`                           | Add the selection as a presentation step                 |
| `Mod+B`                       | Show or hide the elements panel                          |
| `1`–`8`                       | Open that element group on the rail                      |
| `V` / `H`                     | Area-selection tool / pan tool                           |

Dragging the canvas either pans or draws a selection box, depending on the active
tool, and each mode keeps the other reachable: hold `Space` to pan while the
selection tool is active, hold `Shift` to marquee-select while panning. A marquee
selects anything it touches rather than requiring full enclosure.

Pointer actions worth knowing: double-clicking empty canvas starts a text
element there, and double-clicking an element edits its label. Inside an
element's editor text selects the normal way — drag to highlight, double-click to
select a word — so part of a sentence can be replaced without retyping the rest.

Repeated pastes step further from the original each time instead of stacking, and
pasting from the canvas right-click menu drops the copy where you clicked.

Elements added from the element panel appear at the centre of the visible canvas,
stepping diagonally when that spot is already taken, so a new element is never
placed off-screen and never hidden under the previous one. The canvas itself is
unbounded: panning has no limit and zoom runs from 0.05 to 8, so a wide diagram
can be seen whole.

## Manual WCAG-oriented release checklist

Run before every public release and record the result with the release:

**Keyboard**

- [ ] A keyboard-only user can add a shape (palette buttons), select a shape or
      connector, choose and preview a motion preset, open File/Export menus,
      toggle Animate, and export a PNG.
- [ ] Every icon-only control shows a visible focus ring and has an
      accessible name (canvas zoom/fit, panel collapse, preset selection).
- [ ] No focus traps besides dialogs; dialogs restore focus on close.

**Names and roles**

- [ ] Animate, motion preset selection, speed/loop controls, background, and GIF
      options expose pressed/expanded state.
- [ ] Status changes are announced: save status chip, export errors
      (`role="alert"`), and the motion panel is named and keyboard reachable.

**Motion sensitivity (emulate `prefers-reduced-motion: reduce`)**

- [ ] Onboarding samples do not autoplay.
- [ ] Canvas zoom/fit is instant; decorative preset spinners stop.
- [ ] Preset playback still works when the user explicitly presses Preview or
      Animate — this is content motion chosen by the user.

**Screen reader smoke (VoiceOver or NVDA)**

- [ ] The top bar and editor panels announce their landmarks.
- [ ] The onboarding overlay reads its choices in order; closing returns
      focus to the canvas chrome.

## Known gaps (tracked)

- The free-drag canvas itself is pointer-centric (React Flow). Arrow keys move
  focused nodes, but some direct manipulation still requires a pointer.
- Shared/presentation views inherit this support through the same components.
