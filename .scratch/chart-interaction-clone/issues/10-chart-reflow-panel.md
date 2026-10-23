# 10: Chart reflows around the open panel

**What to build:** The person panel takes its own space at the left edge.
The chart shrinks beside it. The selected card stays visible. On a narrow
screen the panel covers the chart as it does today.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] On a wide screen the panel is `370` wide and the chart fills the
      rest. The chart does not sit under the panel.
- [ ] The selected card stays visible after the panel opens. Nudge the
      pan only when the card would fall under the panel.
- [ ] Closing the panel returns the full width and the earlier pan.
- [ ] On a narrow screen, or below a set breakpoint, the panel overlays
      the chart as it does today.
- [ ] The zoom cluster and the toolbar stay clear of the panel.
- [ ] The change does not touch the layout engine or the counter.
- [ ] A test covers the width split and the overlay breakpoint.
- [ ] `bun test` passes and `bun run typecheck` is clean.

## Notes

This is a design choice, not a defect. Confirm with the user before you
change the default. The source chart reflows. Heritage overlays today.

Do not animate the width if the user prefers reduced motion.

Do not re-fit the whole tree when the panel opens. That moves every card
and loses the user's place.
