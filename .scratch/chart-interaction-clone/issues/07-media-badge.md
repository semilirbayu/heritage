# 07: Media badge on the card photo

**What to build:** A small badge sits at the bottom right of the card
photo when the person has media in the file. MyHeritage uses a small
camera or film mark. Draw a local icon.

**Blocked by:** none

**Status:** resolved

- [x] The badge shows only when the person has at least one media link.
- [x] The badge hides when photos are off or the card is in compact mode.
- [x] The mark is drawn in this repo as an SVG path. No icon file is
      copied.
- [x] The badge sits inside the photo circle edge and does not cover the
      initials.
- [x] The mark keeps a 3:1 contrast ratio on the photo fill.
- [x] The person name and the media count go in the group `title` and the
      accessible name. Do not add a separate tab stop.
- [x] Print and SVG export keep the badge.
- [x] A test checks that a person without media gets no badge.
- [x] `bun test` passes and `bun run typecheck` is clean.

## Notes

The layout does not need the media array today. Add the smallest field
that answers "has media" to the card payload. Do not send every media
record to the chart.

Keep the badge under `12px` at reading zoom. At low zoom it must vanish,
not turn into a dot.

## Done

`personSummary` now sends `mediaCount` on every card. The field counts
`person.mediaIds`, so the chart gets one number, not the media list.
The drawer gets the full list from `/api/person/:id`.

The badge is a local 7px circle with a camera path. It sits at
`+17.5, +17.5` from the photo center: inside the `32px` radius, clear of
the initials. Ink is `#595959` on `#FFFFFF` (about 7:1). The mark is
`aria-hidden`, and the media count joins the group `aria-label` and
`title` as `— N media items`.

It draws only when `settings.showPhotos` is on and the tier is not
compact. Print and the SVG download force the full tier, so the badge
stays in both.

Tests pin the media count on the card payload, `mediaCount: 0` for a
person without media, and the badge guard in the viewer script. Verified
in the browser: the card with one media link shows the badge, and the
card without media shows none.
