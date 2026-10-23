# 08: Zoom percent label

**What to build:** Show the current zoom as a percent near the zoom
buttons. Update it on wheel, button, fit, and home actions.

**Blocked by:** none

**Status:** resolved

- [x] The label reads `100%` at the initial family scale
      (`chartTokens.initialScale`, `0.7`).
- [x] The percent is `round(scale / initialScale * 100)`. Do not show a
      bare scale value.
- [x] Clamp the shown range to `21%` and `571%`, which match the current
      scale limits `0.15` and `4`.
- [x] The label updates after a wheel zoom, a button zoom, `fit`, and
      `home`.
- [x] It sits with the zoom cluster and does not cover the chart.
- [x] It has a fixed width, so the buttons do not shift at `99%` to
      `100%`.
- [x] It is a plain text node with a `title` of `Zoom level`. It is not
      a live region. Do not use `aria-label`, so the percent is read.
- [x] Tests cover the mapping at `0.15`, `0.7`, and `4`.
- [x] `bun test` passes and `bun run typecheck` is clean.

## Notes

The source chart shows `100%` at its base scale and `28%` when zoomed
out. Match that convention, not a raw transform value.

Keep the control out of print and SVG export. A percent is screen-only.

## Done

`zoomPercent(scale)` in `src/views/chartTokens.ts` maps `0.15` to `21`,
`0.7` to `100`, and `4` to `571`. `apply()` writes the value to
`#zoomLabel`. The label is the first item in `.zoom-cluster`, above the
buttons. It has a fixed width and tabular digits.

The stylesheet hides `.zoom-cluster` in print, so the label stays off
paper. `tests/chart.test.ts` pins all three values and the page markup.
