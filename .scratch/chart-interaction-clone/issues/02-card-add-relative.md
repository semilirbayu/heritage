# 02: Card add pill opens a choice of relatives

**What to build:** Add a small pill to the bottom edge of each card. It
opens a choice of relatives: partner, brother, sister, son, daughter.
Each choice lands on the add-kin form with the role set. The pill never
expands a branch.

**Blocked by:** none

**Status:** wontfix

**Reason:** The add-relative pill creates data. Heritage views and
explores a GEDCOM file, so the add path is out of scope. The branch
expand control keeps its place under the card.

- [ ] The pill is `64 x 17`, centered on the card bottom edge, and sits
      above the wires.
- [ ] The accessible name is `Add relatives for <name>`. The pill is
      reachable by keyboard.
- [ ] The choice list has the five roles above. The labels are plain
      English.
- [ ] A partner choice lands on `/person/:id#add-kin` with the partner
      role set. The other four set their own role.
- [ ] The branch expand/collapse control moves to the card right edge.
      It keeps its labels, its `+` and `−` marks, and its behavior.
- [ ] The two controls do not overlap at any zoom. Check `0.15` and `4`.
- [ ] The pill does not fire the card select action or the branch toggle.
- [ ] `bun test` passes and `bun run typecheck` is clean.

## Notes

MyHeritage opens a modal `745 x 495` with the five choices. Heritage can
use a small menu near the pill. Pick the shortest path for the user.

The card click still opens the drawer. Keep that. The pill stops the
event before it reaches the card.

The `+` mark under the card used to mean "expand branch". Do not keep
two `+` marks on one card. The expand control moves to the edge.
