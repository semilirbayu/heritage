# 03: Card ornaments: couple pills, edit glyph, expand control

**What to build:** Add the small marks that make a MyHeritage card readable: the two-pill couple marker, the edit glyph, and the `+` expand control.

**Blocked by:** 02

**Status:** resolved

- [x] The couple marker sits above the couple block: two `20 × 12` pills, radius `4`, `10px` apart, in the couple-link color.
- [x] The marker appears once per couple, not once per card.
- [x] The edit glyph is a `16.2px` pencil at `(194, 76)` inside the card. It stays inside the border at all zoom levels.
- [x] The glyph is a local SVG path drawn in this repo. No icon file is copied.
- [x] The `+` control sits below the card, centered, and keeps its current expand action.
- [x] The `+` control has an accessible name that includes the person's name.
- [x] The edit glyph has an accessible name and does not steal focus from the card.
- [x] Hover and focus states do not move the layout by a pixel.
- [x] `bun test` passes.

## Notes

The pills use the same navy as the couple link. Do not draw a pill pair when only one partner is visible.
