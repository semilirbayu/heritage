# 06: Depth window and "N of M people" counter

**What to build:** The toolbar offers `1`–`5+` plus `All`. The counter reads `N of M people`, where `N` is the people in the current window and `M` is the whole tree.

**Blocked by:** 05

**Status:** resolved

- [x] The family view depth options are `1`, `2`, `3`, `4`, `5+`, `All`.
- [x] `5+` means five generations above and five below the focus person.
- [x] The family view opens at `5+`, not `All`.
- [x] The counter reads `N of M people`. Singular uses `person`.
- [x] `N` counts the placed person cards only. Placeholder cards do not count.
- [x] `M` is the total number of people in the loaded tree.
- [x] The counter updates after a depth change, a refocus, and a cousins toggle.
- [x] The depth choice survives a page reload through the URL.
- [x] `bun test` passes.

## Notes

This changes the family-view default from `All` to `5+`. The list of options shrinks from `1,2,3,4,5,6,12,all` to the six above. Keep `All` available; do not rename existing URL values without a fallback.
