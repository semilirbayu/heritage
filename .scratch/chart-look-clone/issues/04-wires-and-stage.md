# 04: Wires, couple links, and the stage

**What to build:** Draw the chart lines and the canvas background at the measured values.

**Blocked by:** 01

**Status:** resolved

- [x] Parent-to-child wires are `1px` in `#999`.
- [x] The partner link is `1px` in `#283F66`.
- [x] Wire corners are square, not rounded.
- [x] The stage background is `rgba(0, 0, 0, 0.05)`.
- [x] The chart opens at scale `0.7`, centered on the focus person.
- [x] The lines stay behind cards at every zoom level.
- [x] The SVG export keeps the same colors. The export covers the full chart, not just the viewport.
- [x] `bun test` passes.

## Notes

Today the renderer uses `stroke-width: 2` and `1.25` in places. Confirm each path against the target before changing it. The crossing count is not a goal; do not reroute wires to reduce it.
