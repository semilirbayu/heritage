# 04: Compact card at low zoom

**What to build:** When the chart scale drops below a threshold, draw a
smaller card anatomy: name only. Hide the photo, the dates, the pencil,
and the couple pills. The card keeps its `220 x 102` box, so the layout
and the pan do not move.

**Blocked by:** none

**Status:** resolved

- [x] Measure the exact threshold first. At `28%` MyHeritage draws the
      compact card. At `100%` it draws the full card. Record the value in
      the ticket before you write code.
- [x] Below the threshold: name only, up to two lines, `15px`, `500`.
- [x] Below the threshold: no photo, no dates, no pencil, no couple pills.
- [x] Below the threshold: the sex-coded border stays. It is the only
      color cue left.
- [x] The card box, the wires, the layout, and the counter do not change.
      Pan and zoom do not jump.
- [x] The accessible name still reads the full name.
- [x] Print and SVG export always use the full card.
- [x] A test pins the threshold and the list of hidden parts.
- [x] `bun test` passes and `bun run typecheck` is clean.

## Notes

This is a rendering mode, not a second layout. Do not change
`src/views/family.ts` geometry.

Do not hide the photo when the user turned photos on and the scale is
high. The setting and the zoom mode are separate inputs.

The threshold is a token, not a literal in the renderer.

## Done

Measured on MyHeritage, stepwise zoom out:

| Zoom | Photo | Dates | Pencil |
| --- | --- | --- | --- |
| 100%, 85% | yes | yes | yes |
| 71%, 57%, 42% | yes | no | yes |
| 28%, 14% | no | no | no |

Dates drop between 85% and 71%. Photos and pencils drop between 42% and
28%. Heritage uses `datesBelowPercent: 75` and `compactBelowPercent: 35`
in `src/views/chartTokens.ts`.

`zoomTier(scale)` returns `full`, `mid`, or `compact`. `draw()` in
`src/app/viewerScript.ts` applies it and sets the `tier-*` class. `apply()`
redraws only when the tier changes. `beforeprint` and the SVG download
force the full tier.

Verified in the browser: at 80% the card keeps photos, dates, and the
pencil. At 51% it keeps photos and the pencil, with no dates. At 33% it
shows the name only. The box, the wires, and the pan did not move.
