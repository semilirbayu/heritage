# Spec: Match MyHeritage chart exploration

**Status:** open

Source: `docs/research/myheritage-canvas.md`, sections "Interaction
states, 2026-10-23" and "Gap list against Heritage".

## Scope rule

Heritage views and explores a GEDCOM file. It does not grow the edit
surface. Any new control must read data, move the view, or change what
is visible.

A control that creates or changes a person, a fact, a photo, or a
relation is out of scope, even when MyHeritage has it.

## Problem Statement

The chart looks like MyHeritage now. A few read-only behaviors still
differ. A user who explores a large tree cannot tell the zoom level. A
user who opens a card cannot see the relation to the main person. A user
who zooms out gets a full card that turns into a blur.

## Solution

Close the read-only gaps. Change no write path. Add no form.

## Measured targets

| Item | Value |
| --- | --- |
| Compact card | name only. No photo, dates, pencil, or pills |
| Compact threshold | appears between 28% and 100% zoom. Exact value not measured |
| Relation label | plain line under the name, for example `Your grandfather` |
| Media badge | small mark at the photo bottom right |
| Zoom label | `28%`, `100%`, placed near the zoom buttons |
| Wire at low zoom | `#585857` at `2px`, instead of `#999` at `1px` |
| Panel width | `370` at the left edge. The chart reflows beside it |

## In scope

1. Compact card at low zoom.
2. Relation label in the person panel.
3. Photos and biography sections in the panel, read-only.
4. Media badge on the card photo.
5. Zoom percent label.
6. Wire stroke that widens at low zoom.
7. Chart reflow around the open panel.

## Out of scope

- Quick-edit dialog.
- Add-relative pill.
- Add-parent slots.
- Any import, merge, or match feature.
- Any MyHeritage asset, text, or style file.

## User Stories

1. As a user at low zoom, I want a compact card, so that a large branch
   stays readable.
2. As a user, I want to know the relation to the main person, so that I
   read the tree without counting rows.
3. As a user, I want to see the photos and the biography of a person, so
   that I explore the file in one place.
4. As a user, I want to see the zoom level, so that I can return to a
   known scale.
5. As a user, I want the wires to stay visible when I zoom out, so that
   the structure does not fade.

## Decisions

- The panel shows only data that the GEDCOM file holds. It never invents
  a label.
- The relation label comes from the current root person. When the user
  re-roots, the label updates.
- The compact card is a rendering mode, not a second layout. Geometry
  stays the same, so pan and zoom do not jump.
- The wire rule follows the browser: normal stroke at reading zoom,
  wider and darker stroke below a threshold.

## Rejected

These tickets were drafted before the scope rule. They add or change
data, so they are `wontfix`.

- `issues/01-card-quick-edit.md`
- `issues/02-card-add-relative.md`
- `issues/03-add-parent-slots.md`

## Tickets

| # | Ticket | Depends on |
| --- | --- | --- |
| 04 | `04-compact-card-low-zoom.md` | none |
| 05 | `05-relation-label.md` | none |
| 06 | `06-panel-media-biography.md` | none |
| 07 | `07-media-badge.md` | none |
| 08 | `08-zoom-label.md` | none |
| 09 | `09-wire-zoom-compensation.md` | 04 |
| 10 | `10-chart-reflow-panel.md` | none |

Start order: 04, 08, 09, then 05, 06, 07, then 10. Ticket 10 needs a
user decision first.

