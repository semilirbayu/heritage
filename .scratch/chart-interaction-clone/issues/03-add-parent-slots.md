# 03: Dashed slots for a missing parent

**What to build:** When a person has no known father or mother, draw a
dashed slot above the person. The slot says `Add father` or
`Add mother`. A click opens the add-kin form with the parent role set.

**Blocked by:** 02

**Status:** wontfix

**Reason:** A parent slot opens a data-entry flow. Heritage only shows
what the GEDCOM file holds, so the slot is out of scope.

- [ ] The slot has the card width, dashed `1px` stroke `#999`, radius
      `8`, and a white or clear fill.
- [ ] The label is `Add father` or `Add mother`, centered, `13px`.
- [ ] The slot shows only for an unknown parent. A known parent never
      gets one.
- [ ] Two slots appear when both parents are unknown.
- [ ] A click opens `/person/:id#add-kin` with the parent role set.
- [ ] The slot does not change the people counter. It is not a person.
- [ ] Keyboard focus reaches the slot and `Enter` opens the form.
- [ ] The accessible name includes the child name, for example
      `Add father of Rono Dikromo`.
- [ ] Layout tests: the slot never overlaps a card, a wire, or a pill.
- [ ] `bun test` passes and `bun run typecheck` is clean.

## Notes

MyHeritage shows these slots in a parent row with the label on the left.
Measure one exact slot before you set the height. The observed height in
the browser was about half a card, but this figure is not confirmed.

Do not add the slot to the print or SVG export until the layout is
stable. An empty dashed box on paper has no value.

This ticket needs the add-kin navigation from ticket 02.
