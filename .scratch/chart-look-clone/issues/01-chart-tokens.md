# 01: Chart tokens for colors, type, and the stage

**What to build:** One small module holds every value the chart look needs. Renderers read tokens, never literals.

**Blocked by:** none

**Status:** resolved

- [x] A `chartTokens` object (or CSS custom properties plus a TS mirror) exports:
  - `edgeMale: "#17B4CE"`, `edgeFemale: "#FC8181"`, `edgeUnknown` (male value)
  - `edgeWidth: 2`, `focusRingWidth: 3`, `radius: 8`
  - `wire: "#999"`, `wireWidth: 1`, `coupleLink: "#283F66"`, `coupleLinkWidth: 1`
  - `ink: "#595959"` for dates, `nameSize: 15`, `nameWeight: 500`, `dateSize: 15`
  - `photo: 64`, `photoX: 10`, `photoY: 19`, `textX: 82`
  - `pillW: 20`, `pillH: 12`, `pillGap: 10`, `pillRadius: 4`
  - `stage: "rgba(0, 0, 0, 0.05)"`
  - `font: '"Helvetica Neue", Helvetica, Arial, sans-serif'`
  - `initialScale: 0.7`
- [x] Duplicate hex values are gone from `src/app/viewerScript.ts` and `src/app/pages.ts`.
- [x] Tokens carry a comment that points to `docs/research/myheritage-canvas.md`.
- [x] No MyHeritage asset, font file, or stylesheet enters the repo.
- [x] `bun run build` passes.

## Notes

The existing stylesheet uses `var(--*)` tokens. Extend that set instead of starting a second system. The TS mirror is needed because the SVG renderer sets some values as attributes.
