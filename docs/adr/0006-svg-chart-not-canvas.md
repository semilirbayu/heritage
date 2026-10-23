# Match the MyHeritage chart in SVG, not canvas

The user asked for a close copy of the MyHeritage family tree chart: its look, not only its behavior. A REA study of a live tree changed the premise. The MyHeritage chart is not a canvas. It is one `<svg>` with a `<g>` per person, drawn through DojoX GFX. Its pan is a translate on the SVG and its zoom is a scale on an inner group. Heritage already uses SVG with a transform-based pan and zoom. We decided to match the MyHeritage chart by restyling the existing SVG renderer, and to reject a canvas renderer.

## Considered Options

- **Canvas renderer** — rejected: the target is SVG, so a canvas gains no fidelity and loses vector export. It would rewrite about 600 lines for no benefit.
- **HTML cards with SVG wires** — rejected: the target draws cards as SVG paths and text. Matching it in SVG keeps one renderer and one export path.
- **A draw-list seam with canvas and SVG backends** — rejected for now: no second backend exists, so the seam is structure without a user. Add it when a second backend has a reason.
- **Restyle the SVG renderer against measured values** — chosen: card size, spacing, colors, ring, markers, and font are all observed and small to apply.

## Consequences

- **SVG export and print-to-PDF stay.** The earlier "export may break" permission is not used.
- The card size changes from `232 × 88` to `220 × 102`, and the generation gap from `72` to `86`. Layout tests and fixtures need new numbers.
- The card font is the system stack `"Helvetica Neue", Helvetica, Arial, sans-serif`. No font is licensed or shipped.
- Icons and ornaments are drawn by us to the measured geometry. No MyHeritage asset enters the repo.
- Sex-coded borders (`#17B4CE` / `#FC8181`) are recorded in `docs/research/myheritage-canvas.md`, not decided here. Heritage needs an explicit rule before it colors cards by sex.
- The viewer now has more visual surface to test: focus ring, couple marker, photo circle, edit affordance. These need DOM-level assertions, not only geometry tests.
