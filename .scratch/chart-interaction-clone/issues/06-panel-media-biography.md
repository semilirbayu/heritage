# 06: Photos and biography sections in the panel

**What to build:** The person panel gets two read-only sections: `Photos
and videos` and `Biography`. They show what the GEDCOM file holds. No
upload button, no edit link, no add control.

**Blocked by:** none

**Status:** resolved

- [x] `Photos and videos` lists the media that belongs to the person. Each
      row shows the title, the date, and the place when present.
- [x] A media row links to the existing media view when one exists.
- [x] A broken or dangling link shows `Link not found`, not an empty row.
- [x] `Biography` shows the stored text with line breaks kept.
- [x] Each section hides when the file has no data for it. Do not show an
      empty box with an `Add` button.
- [x] The panel still fits a narrow screen and scrolls.
- [x] Tests cover a person with media, with biography, and with neither.
- [x] `bun test` passes and `bun run typecheck` is clean.

## Notes

The domain already has `person.mediaIds`, `tree.media`, and
`person.biography`. This ticket reads them. It does not write them.

Do not copy the MyHeritage labels `PHOTOS & VIDEOS` in caps. Use normal
case and the site type scale.

The panel is the only place for this. Do not add a second person page.

## Done

`/api/person/:id` now returns `biography` and `media`. Each media entry
holds `id`, `path`, `title`, `date`, and `place`. A link id that is not in
the tree returns `missing: true`, and the panel prints `Link not found`.

The drawer adds the two sections after `Life events`, and hides each one
when its data is empty. `#drawer` already scrolls and caps its width at
`calc(100% - 24px)`. Biography text keeps its line breaks through
`white-space: pre-wrap`.

There is no media viewer route in this app, so a row shows text only. Add
the link when a media view exists.

Tests cover a person with two links (one real, one dangling), a person
with biography, and a person with neither. Verified in the browser: the
panel shows `Photos and videos` with `Anne at twenty · 1900 · London`,
then `Biography` with two lines.
