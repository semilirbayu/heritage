# MyHeritage tree chart: observed anatomy

**Date:** 2026-10-22
**Target:** `https://www.myheritage.com/family-trees/bayu/...` — "Bayu Family Tree Website", Family view, 64 of 186 people loaded.
**Method:** REA 6.7.0 attached over CDP to a disposable Chrome profile, logged in by the user. Passive page capture, one screenshot, and read-only DOM measurement on the user's own tree.

This note records facts, not copied code. No MyHeritage source, CSS file, font file, or image was taken into the repo.

## The headline

The MyHeritage "canvas" is **not a canvas**. It is one `<svg>` with a `<g>` per person.

- `document.querySelectorAll("canvas").length` → `0`
- tree SVG box → `4967 × 1119`
- 38 rendered person groups (of 64 shown, of 186 claimed)
- stage background → `rgba(0, 0, 0, 0.05)` over white
- renderer → Dojo Toolkit + DojoX GFX (SVG backend; elements carry `dojoGfxStrokeStyle`)
- jQuery and React are also on the page, but the chart is Dojo GFX

So the target and Heritage already share a renderer family. The gap is styling, spacing, and a few missing ornaments — not paint technology.

## Stage and transform

| Item | Value |
| --- | --- |
| Viewport | 1200 × 1000 |
| Stage SVG | `4967 × 1119` |
| Pan | `translate(-3095, -499)` on the `<svg>` |
| Zoom | `matrix(0.7, 0, 0, 0.7, 0, 0)` on an inner `<g>` |
| Initial scale | `0.7` |

Pan and zoom live on separate layers. Heritage does the same on one layer. This is a cosmetic difference, but it makes hit-testing and fit-to-view simpler to reason about.

## Person group structure

```
g[data-type=_svgOuterGroup][data-individual-id=1500001]  transform=translate(x, y)
└─ g[data-type=_svgGroup].rootPersonGroup
   ├─ g[data-type=_spiderAndFrameGroup]
   │  └─ g[data-type=frameGroup].cardWrapper.rootPersonCard  id=card1500001
   │     ├─ path   card background (white, r=8, shadow filter)
   │     ├─ path   border (2px)
   │     ├─ g[data-type=textGroup]       name
   │     ├─ g[data-type=smallDatesGroup] years / "Deceased"
   │     ├─ g[class=NewTree_EditIcon]    pencil, 22×22 hit box
   │     └─ g[class=profileImageGroup]   photo, 64×64, circular clip
   └─ path   focus ring (only on the root person)
```

The position lives on the outer group, so layout is a pure `translate` per person. Card size is constant.

## Card metrics

| Item | Value |
| --- | --- |
| Card | `220 × 102`, corner radius `8` |
| Fill | `#FFFFFF` plus a drop-shadow filter (`cardFilterDef`) |
| Border | `2px` inset `1px` |
| Male border | `#17B4CE` |
| Female border | `#FC8181` |
| Focus ring | extra path, `3px`, `#17B4CE` |
| Photo | `64 × 64` circle-clipped at `(10, 19)` |
| Text column | `x = 82` (so `10 + 64 + 8` padding) |
| Name | `15px`, weight `500`, `#000` |
| Years / "Deceased" | `15px`, weight `400`, `#595959` |
| Edit glyph | `16.2px` at `(194, 76)`, `#595959` |
| Font stack | `"Helvetica Neue", Helvetica, Arial, sans-serif` |

**The font is a system stack, not a webfont.** No font file needs licensing. This settles the "match harder" question: we can match text exactly, legally, by using the same stack.

## Spacing

| Item | Value |
| --- | --- |
| Generation pitch | `188` (`102` card + `86` gap) |
| Partner pitch | `254` (`220` card + `34` gap) |
| Sibling unit pitch | `254` to `289` (`34` to `69` gap), depends on subtree width |

## Wires and markers

| Item | Value |
| --- | --- |
| Parent/child wire | `#999999`, `1px` |
| Couple link | `#283F66`, `1px` |
| Couple marker | two rounded rects `20 × 12`, `r=4`, `#283F66`, `10px` apart |
| Add-person button | white pill, about `92 × 25`, sits below the card at `y=101.5` |
| Wire geometry | orthogonal with rounded corners |

The "couple pill" in the screenshot is two separate pills with a gap. At `0.7` scale it reads as one marker with two dots.

## Heritage today

| Item | Heritage | MyHeritage |
| --- | --- | --- |
| Renderer | SVG | SVG |
| Card | `232 × 88` | `220 × 102` |
| Partner gap | `32` | `34` |
| Column gap | `56` | `34–69` |
| Generation gap | `72` | `86` |
| Photo | square, optional | `64` circle, always present |
| Border | design token | `2px`, sex-coded |
| Focus | emphasis class | extra `3px` ring |
| Couple marker | none | two navy pills |
| Pan/zoom | one transform | pan and zoom on separate layers |

The sex-coded border is new information. Heritage has no such rule today. It is also a fairness question: the app should not encode gender in color without a setting. Record it, do not assume it.

**Decided (2026-10-22):** Heritage matches MyHeritage. Male cards take `#17B4CE`, female cards take `#FC8181`. Unknown sex takes the male border, same as the source chart. The implementation must name the colors as tokens (`--card-edge-male`, `--card-edge-female`, `--card-edge-unknown`), not as literals at the call site. A neutral option stays possible later because the colors are tokens.

## Limits

- One tree, one viewport, one zoom level. No other views measured.
- 38 of 186 people were rendered. Lazy expansion and culling behavior is not mapped.
- Only DOM, computed style, one screenshot, and script metadata were read. No request bodies.
- Only the visual layer was measured. Drag, pinch, keyboard, and hover behavior were not captured.
- Card height may vary per state (for example, a "has photo" row). Only the default card was measured.

## Focus and culling

The chart is bounded. It does not show the whole tree. Two view-only trials were run on the same tree; a page reload restored the default state each time.

### Trial 1: the ridge control

`g[class=ridgeIcon]`, aria-label "View family branch", sits on the card edge. It does not expand a branch. It **re-roots** the chart on that person and adds a breadcrumb step.

### Trial 2: the reported case

From the default view, click the ridge on Tanirah's card.

| | Before | After |
| --- | --- | --- |
| Counter | 64 of 186 | 45 of 186 |
| Root card | Bayu Eli Makrus | Tanirah |
| Breadcrumb | `Bayu Family Tree › Bayu Eli Makrus` | `Bayu Family Tree › Bayu Eli Makrus › Tanirah` |
| Person nodes | 58 | 30 |
| Wires | 31 | 13 |
| Cards | 40 | 27 |

- 38 nodes left, 10 arrived.
- The removed set is the whole region above Tanirah, plus the in-law lines around it: Kromo Siran, Jemprit, Murtami, Sukatemi, Santosa, Yuliani, Sirianto, Eko Purnomo, Samsul Arifin, Toinem, Kromo Puthut, Kertomedjo, Kenyik, and the unknown ancestor rows.
- The added set is Tanirah's other descendants: Imel, Wagiyem, Tun, Yuli, Waskita, Dewi, Fredi.

This matches the reported behavior: after focusing Tanirah, the upper branch from Sukirman disappears.

### The crossing hypothesis did not hold

Measured on the visible chart, before and after:

| Metric | Before | After |
| --- | --- | --- |
| Proper wire/wire crossings | 1 | 1 |
| Wires passing through a card | 0 | 0 |
| Long edges (> 3 card widths) | 4 | 4 |

The cull removed people and wires. It did not remove crossings. Readability improved because density fell, not because the drawing became planar.

### The cull is a generation window

The toolbar holds the control: a `5+` button opens a panel titled **GENERATIONS ABOVE/BELOW MAIN PERSON**. The panel has a `1`–`5+` slider and a **Show cousins of main person** checkbox.

Measured with Dalliyanayya as the main person:

| Depth | Cousins | Shown |
| --- | --- | --- |
| 1 | off | 8 |
| 2 | off | 28 |
| 3 | off | 31 |
| 4 | off | 31 |
| 5+ | off | 31 |
| 5+ | on | 35 |

With Bayu as the main person at depth `5+`: 28 people with cousins off, 64 with cousins on.

So the counter is the number of people inside a generation window. It has no crossing term and no fixed budget. The `64`/`45`/`35` counts from the focus trials were just three different window contents.

### Trials 3 and 4: other main persons

- **Sukirman:** no ridge exists above his card, because his parents are already visible. Ridges appear only where a parent line is hidden. The nearest ridge belonged to another card, so the click re-rooted on `1500127` instead.
- **Dalliyanayya Ratuviha:** `1500127` is her record. The search control works and shows a live suggestion ("Pamuji — Uncle"), but selecting a suggestion with synthetic mouse input does not navigate. Typing a search term and clicking its row did work.

### A correction: rows are not generations

Card `y` values are not a generation index. Separate family blocks are packed at the same height. In Dalliyanayya's view, she and Bayu share `y=842` because they are partners in one block. So the earlier "focus becomes the top row" reading was wrong. The earlier "38 nodes removed" diff measured layout churn, not depth.

### Open questions

- Is one depth number used above and below, or does the slider mean "5 generations each way"? The label says "above/below", so one number for both.
- Why does the counter exceed the number of drawn cards? Bayu at `5+` with cousins shows 64 people but draws 40 cards. The rest are not drawn as separate cards.
- What does `5+` mean when the line is longer than five generations? Dalliyanayya ran out at four.
- The 186 total is never exceeded, and no state shows the whole tree.

## Next probes, if needed

1. Measure the hover and selected states, plus the person-popup overlay.
2. Measure the fan and pedigree views.
3. Observe one expand action to record the transition and the added nodes.
4. Check whether `smallDatesGroup` shrinks for long dates.

## Re-check, 2026-10-23

**Method:** REA 6.7.0 over CDP on the same signed-in tree. Passive page
capture, one screenshot, and read-only geometry reads. No request bodies.
Viewport 1200 x 942 at dpr 2. Two zoom states were read: 28 percent, then
100 percent after a reload.

These facts confirm the earlier note:

| Item | Observed today |
| --- | --- |
| Renderer | one `<svg>`, `0` canvas elements |
| Person groups | `82` before reload (with `36` add-person slots); `38` after reload (no slots) |
| Card body | `path` `220 x 102`, `r=8`, fill `#FFFFFF` |
| Card border | `path` `218 x 100` at `(1, 1)`, `r=7`, `2px` |
| Male border | `rgb(23, 180, 206)` = `#17B4CE` |
| Female border | `rgb(252, 129, 129)` = `#FC8181` |
| Add-person slot | `rect` `93 x 102`, stroke `#999999` |
| Couple link | `rgb(40, 63, 102)` = `#283F66`, `1px` |
| Wire | `#585857` at `2px` at 28% zoom; `#999` at `1px` at 100% |
| Root ring | `#17B4CE` at `3px` at 100%; grey `3px` at 28% |
| Elbow radius | `30` units on the drop wires |

One item looked like a conflict. It is resolved.

- Earlier note says the parent/child wire is `#999999` at `1px`.
- At 28 percent zoom the 33 long connector paths read `rgb(88, 88, 87)` at `2px`.
- After a reload the view sits at `100%`. The wires now read
  `rgb(153, 153, 153)` at `1px`, which matches the earlier note.
- Clicking `Color coding` did not change the counts.

So the chart compensates the wire stroke as you zoom out. It doubles the
width and darkens the color to stay legible. `chartTokens.wire` stays
`#999` at `1px`. The open question is whether Heritage should copy this
zoom compensation. That is a design choice, not a measurement.

**Detail tiers (stepwise zoom out, 2026-10-23):**

| Zoom | Photo | Dates | Pencil |
| --- | --- | --- | --- |
| 100%, 85% | yes | yes | yes |
| 71%, 57%, 42% | yes | no | yes |
| 28%, 14% | no | no | no |

Dates drop between 85% and 71%. Photos and pencils drop between 42% and
28%. The card box stays `220 x 102` at every tier, so the layout does
not move. Heritage uses 75% for the date cut and 35% for the compact cut.

The default view after a reload showed `38` person groups and `100%`
zoom. The earlier `0.7` matrix lives on an inner group, not on the label.

Open: the pre-reload view had `36` add-person slots. The post-reload view
had none. Both counters read `64 of 186 people`. The cause is not
measured. It may be zoom, or a view setting that a reload clears.

Controls seen in this state: view switcher (Family view, relationship,
chart), `Find a person...`, the generations panel (`1` to `5+`, plus
`Show cousins of main person`), zoom `+`/`-`, fit, home, and a minimap.
The counter read `64 of 186 people`.

Limits: two zoom levels, one viewport, no hover, no selection, no drag
or pinch, no pedigree or fan view, no network bodies.

## Interaction states, 2026-10-23

**Method:** same session, real mouse and key events on two cards. No
field was saved. Every dialog was closed with `Cancel` or `Escape`.

| Action | Result |
| --- | --- |
| Hover a card | cursor becomes `pointer`. Card paths do not change |
| Click a card | left person panel opens, `370` wide, full chart height |
| Panel header | `96` round photo, name, relation (`Your grandfather`), `Deceased` |
| Panel actions | `Profile`, `Edit`, `Add`, `More` |
| Panel sections | `PHOTOS & VIDEOS` + Add, `BIOGRAPHY` + Add, `IMMEDIATE FAMILY` + Add, `FACTS` + Add |
| Panel effect | the chart re-lays out to the right of the panel |
| Click the pencil | `Edit profile` modal, `750 x 675`, on a dim overlay |
| Modal fields | sex, names, birth date and place, living/deceased, email, partner relation, marriage date and place |
| Click the add pill | `Add relatives` modal, `745 x 495`: partner, brother, sister, son, daughter |
| Add pill | `64 x 17` at the card bottom edge, aria label `Add relatives` |
| Missing parent | dashed slot `Add mother` or `Add father` above the row |
| Low zoom | compact card: name only. No photo, dates, pencil, or pills |

## Gap list against Heritage

Measured today, checked against `src/app/viewerScript.ts` and
`src/app/pages.ts`.

| # | MyHeritage | Heritage today | Gap |
| --- | --- | --- | --- |
| 1 | Pencil opens a quick-edit modal | Pencil is drawn but does nothing | Wire it to the edit form |
| 2 | Card pill adds a relative | `+` expands or collapses the branch | Split "add" from "expand" |
| 3 | Dashed add-parent slots | None | Add the two slots |
| 4 | Compact card at low zoom | Full card at every zoom | Detail level by scale |
| 5 | Panel shows photos, biography | Drawer shows life events, parents, partners, children | Add the two sections |
| 6 | Relation label in the panel | Meta shows sex, status, years | Add the relation label |
| 7 | Media badge on the photo | None | Add the badge |
| 8 | Chart reflows around the panel | Drawer overlays the chart | Reflow or keep overlay |
| 9 | Wire widens when zoomed out | Fixed `1px` | Optional zoom compensation |
| 10 | Zoom percent label | No label | Add the label |

Items 1, 2, and 3 change behavior that a user can reach today. Items 4
to 10 are polish. Item 8 is a design choice, not a defect.

**Scope correction (2026-10-23):** Heritage views and explores a GEDCOM
file. It does not grow the edit surface. Items 1 to 3 add or change
data, so they are out of scope. Items 4 to 10 stay in scope and are
ticketed as `04` to `10` in `.scratch/chart-interaction-clone/issues/`.

The look-clone effort in `.scratch/chart-look-clone/` is resolved. The
three write tickets under `.scratch/chart-interaction-clone/issues/` are
marked `wontfix` as a record of the decision.
