# 02: Card anatomy at MyHeritage size

**What to build:** Each person card is `220 × 102` with radius `8`. The card holds a 64px round photo left, a name and dates right, and a 2px sex-coded border.

**Blocked by:** 01

**Status:** resolved

- [x] The card rect is `220 × 102`, radius `8`.
- [x] The border is `2px` and takes the sex token. Unknown sex uses the male color.
- [x] The focus person gains an extra `3px` ring outside the border.
- [x] The photo is a `64 × 64` circle at `(10, 19)` relative to the card.
- [x] A person without a photo still gets the circle, with initials. The layout does not shift.
- [x] Text starts at `x = 82`.
- [x] The name uses `15px` at weight `500`. Long names wrap inside the card, not past it.
- [x] The dates line uses `15px` and `#595959`. It falls back to `Deceased` or `Living` as today.
- [x] Two-line names do not collide with the dates line.
- [x] `bun test` passes.

## Notes

`wrapDisplayName` currently assumes a `232` card with `68` height and a smaller font. Re-check its wrap width against `220 - 82 - 12`. `CARD_H_SHORT` and `CARD_H_TALL` collapse to one height; delete the split if nothing else uses it.
