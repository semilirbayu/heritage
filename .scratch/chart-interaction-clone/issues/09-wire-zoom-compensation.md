# 09: Wires widen at low zoom

**What to build:** At low zoom, draw the parent and child wires wider and
darker, so the structure stays readable. Return to the normal stroke at
reading zoom.

**Blocked by:** 04

**Status:** resolved

- [x] Add tokens for the low-zoom wire: `#585857` at `2px`. Keep the
      current `#999` at `1px` for normal zoom.
- [x] The renderer picks one setting from the scale. No literal in the
      call site.
- [x] The threshold is the same token as the compact card in ticket 04.
      Do not add a second threshold.
- [x] Couple links, couple pills, and card borders do not change.
- [x] The switch does not re-layout. Geometry stays the same.
- [x] Print and SVG export always use the normal wire.
- [x] A test pins both token pairs and the threshold.
- [x] `bun test` passes and `bun run typecheck` is clean.

## Notes

Measured: at `28%` the 33 long connector paths read `rgb(88, 88, 87)` at
`2px`. At `100%` they read `rgb(153, 153, 153)` at `1px`.

The source chart may add a transition. Skip it. A stroke that fades is a
distraction on a large tree.

## Done

`wireLowZoom: "#585857"` and `wireLowZoomWidth: 2` are chart tokens.
`draw()` picks `wire` and `wireW` once from `compact`. The path helper and
the family bus calls use those values. The couple link and the couple
pills keep their own tokens.

Verified in the browser at 33%: `rgb(88, 88, 87)` at `2px`. At 80%:
`rgb(153, 153, 153)` at `1px`. Print and the SVG download force the full
tier, so they keep the normal wire.
