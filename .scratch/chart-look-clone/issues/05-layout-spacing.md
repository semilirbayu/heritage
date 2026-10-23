# 05: Layout spacing: 188 generation pitch, 254 couple pitch

**What to build:** Change the family-layout constants so the generation pitch is `188`, the partner pitch is `254`, and the sibling pitch is `254–289`.

**Blocked by:** 02, 04

**Status:** resolved

- [x] `NODE_W = 220`, `NODE_H = 102`.
- [x] `COUPLE_GAP = 34`, so the partner pitch is `254`.
- [x] `Y_GAP = 86`, so the generation pitch is `188`.
- [x] `X_GAP = 34` as the base sibling gap, so the tight sibling pitch is `254`.
- [x] A wide sibling unit may breathe up to `289` when its own subtree needs room. The gap never drops below `34`.
- [x] Placeholder cards and their tabs fit the new heights without overlap.
- [x] Sibling bus lanes still clear the placeholder tabs.
- [x] `bun test` passes.

## Notes

The current values are `NODE_W 232`, `NODE_H 88`, `COUPLE_GAP 32`, `X_GAP 56`, `Y_GAP 72`. Several tests assert exact coordinates; update them with the constants, not with new literals.
