# 01: Card pencil opens a quick-edit dialog

**What to build:** Clicking the pencil on a card opens a centered
dialog. The dialog edits the same core fields as the person form. It
submits to the existing edit mutation. The chart stays where it was.

**Blocked by:** none

**Status:** wontfix

**Reason:** Heritage views a GEDCOM file. A quick-edit dialog grows the
edit surface, which is out of scope.

- [ ] The pencil is a real control. It has `cursor: pointer` and the
      accessible name `Quick edit <name>`.
- [ ] A click opens the dialog and does not change pan or zoom.
- [ ] The dialog is centered on a dim overlay. It is at most `750 x 675`
      and shrinks on a small screen.
- [ ] Fields: sex, given name, surname, display name, living or deceased,
      birth date, birth place.
- [ ] `OK` submits `POST /person/:id/edit`. `Cancel` and `Escape` close
      with no write.
- [ ] After a save the card shows the new name and dates. The chart keeps
      its pan, zoom, and open branch state.
- [ ] Focus enters the dialog on open and returns to the card on close.
- [ ] The dialog has `role="dialog"`, a label, and a focus trap.
- [ ] `bun test` passes and `bun run typecheck` is clean.

## Notes

MyHeritage also shows email and partner marriage fields in this dialog.
Do not add them in this ticket.

The existing mutation reads `given`, `surname`, `display`, `sex`,
`private`, `biography`, and `living`. Reuse it. Do not add a second
handler.

The pencil sits at `(194, 76)` inside a `220 x 102` card. Keep the hit
box at `22 x 22` or larger.
