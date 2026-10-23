# 07: "Show cousins" toggle

**What to build:** A `Show cousins` checkbox adds the descendants of the focus person's siblings. Off, it hides them. On, it brings them back.

**Blocked by:** 06

**Status:** resolved

- [x] A checkbox labeled `Show cousins` sits in the chart toolbar.
- [x] Checked, the chart adds the descendants of the focus person's siblings, with their partners.
- [x] Unchecked, it hides that set and the counter drops.
- [x] The default is checked, as in MyHeritage.
- [x] The state survives a reload through the URL (`cousins=1` / `cousins=0`).
- [x] The toggle never exceeds `MAX_VISIBLE_PEOPLE`. If the cap binds, a placeholder card reports the hidden count.
- [x] The existing `Show siblings` button keeps its meaning: siblings only, no descendants.
- [x] The counter updates on every toggle.
- [x] `bun test` passes.

## Notes

Measured on one tree: cousins on gave `35`, off gave `31` at depth `5+`. The set is the sibling's whole descendant line, not one generation. Reuse the descendant walk that the family layout already runs.
