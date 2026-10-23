# Spec: Match the MyHeritage family-chart look

**Status:** resolved

Source: browser study of 2026-10-22 (`docs/research/myheritage-canvas.md`) and ADR `docs/adr/0006-svg-chart-not-canvas.md`.

## Problem Statement

The Heritage family chart does not look like the chart that MyHeritage users know. The cards are smaller, the spacing is tighter, the borders do not carry sex, and the ornaments are missing. A person who moves from MyHeritage to Heritage must relearn the picture. A printed chart also does not match what relatives see on MyHeritage.

## Solution

Restyle the SVG family view to match the measured MyHeritage chart. The renderer stays SVG. The layout engine stays. This work changes constants, card anatomy, ornaments, and the two view controls that set how much of the tree appears.

Scope chosen by the user: **look + depth window + cousins toggle**. Heritage copies the visual layer, the `1`–`5+` generation window, the `N of M people` counter, and a "show cousins" toggle.

Out of scope: the person-card popup, the fan and pedigree views, the Dojo widget structure, and any MyHeritage asset. No font binary, icon file, or stylesheet is copied. The font is the system stack `"Helvetica Neue", Helvetica, Arial, sans-serif`. Every icon is drawn in this repo.

## Measured targets

| Item | Value |
| --- | --- |
| Card | `220 × 102`, radius `8` |
| Male border | `#17B4CE`, `2px` |
| Female border | `#FC8181`, `2px` |
| Unknown sex | male border |
| Focus ring | extra `3px` ring, accent color |
| Photo | `64 × 64` circle at `(10, 19)` |
| Text left edge | `x = 82` |
| Name | `15px`, weight `500` |
| Dates | `15px`, `#595959` |
| Edit glyph | `16.2px` at `(194, 76)` |
| Wire | `1px`, `#999` |
| Couple link | `1px`, `#283F66` |
| Couple marker | two `20 × 12` radius `4` pills, `10px` apart |
| Stage background | `rgba(0, 0, 0, 0.05)` |
| Initial scale | `0.7` |
| Generation pitch | `188` |
| Partner pitch | `254` |
| Sibling pitch | `254–289` |

## User Stories

1. As a MyHeritage user, I want cards of the same size and anatomy, so that the chart feels familiar.
2. As a viewer, I want the border color to show sex, so that I scan a generation at a glance.
3. As a viewer, I want the couple marker and the couple link, so that I read partnerships without reading text.
4. As a viewer, I want a "1–5+" generation control, so that I choose how much of the tree appears.
5. As a viewer, I want a "N of M people" counter, so that I know how much of the tree I see.
6. As a viewer, I want a "show cousins" toggle, so that I trade width for focus.
7. As a viewer in a large tree, I want the default window to stay readable, so that the first view is not a wall of cards.

## Decisions

- Borders are sex-coded. The colors are tokens, so a neutral mode can arrive later.
- The depth control offers `1`–`5+` plus `All`. `5+` means five generations above and five below.
- The counter counts the people in the current window, against the whole tree.
- "Show cousins" adds the descendants of the focus person's siblings.
- Print and SVG export keep working. The export path is not redesigned.

## Tickets

- `01-chart-tokens.md`
- `02-card-anatomy.md`
- `03-card-ornaments.md`
- `04-wires-and-stage.md`
- `05-layout-spacing.md`
- `06-depth-counter-toolbar.md`
- `07-show-cousins.md`
- `08-chart-tests.md`
