# 08: Tests for the chart look, the window, and the counter

**What to build:** Lock the new values and the new behavior with tests, so a later layout change cannot drift from the measured chart.

**Blocked by:** 05, 06, 07

**Status:** resolved

- [x] A token test asserts the exact values: card `220 × 102`, radius `8`, `2px` border, photo `64`, `textX 82`, `15px` type, wires `1px`, partner pitch `254`, generation pitch `188`.
- [x] A layout test asserts the pitch values from the constants, not from hard-coded coordinates.
- [x] A test asserts the depth options and the `5+` meaning.
- [x] A test asserts the counter string for a window of 1 person (`1 of M people`) and for a larger window.
- [x] A test asserts the cousins set: checked adds the sibling's descendants, unchecked removes them.
- [x] A test asserts that a person with unknown sex takes the male border token.
- [x] A golden SVG snapshot covers one small tree, so card anatomy and ornaments are visible in review.
- [x] `bun test` passes.

## Notes

Keep the golden small: one couple, one child, one grandparent. A large snapshot is noise in review.
