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

## Manual WCAG-oriented release checklist

Run before every public release (record in the sprint/release report):

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

- The free-drag canvas itself is pointer-centric (React Flow); keyboard node
  movement/arrows are provided, full node editing parity is post-launch work.
- Shared/presentation views inherit this support through the same components.
