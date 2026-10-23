/**
 * Measured family-chart look.
 * Source: docs/research/myheritage-canvas.md
 * No MyHeritage file is copied. Icons in this repo use these sizes.
 */
export const chartTokens = {
  edgeMale: "#17B4CE",
  edgeFemale: "#FC8181",
  edgeUnknown: "#17B4CE",
  edgeWidth: 2,
  focusRingWidth: 3,
  radius: 8,
  wire: "#999",
  wireWidth: 1,
  wireLowZoom: "#585857",
  wireLowZoomWidth: 2,
  compactBelowPercent: 35,
  datesBelowPercent: 75,
  coupleLink: "#283F66",
  coupleLinkWidth: 1,
  ink: "#595959",
  nameInk: "#000000",
  nameSize: 15,
  nameWeight: 500,
  dateSize: 15,
  photo: 64,
  photoX: 10,
  photoY: 19,
  textX: 82,
  textPad: 12,
  pillW: 20,
  pillH: 12,
  pillGap: 10,
  pillRadius: 4,
  stage: "rgba(0, 0, 0, 0.05)",
  font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  initialScale: 0.7,
  cardW: 220,
  cardH: 102,
  coupleGap: 34,
  siblingGap: 34,
  generationGap: 86,
  editSize: 16.2,
  editX: 194,
  editY: 76,
  cardFill: "#FFFFFF",
  photoFill: "#F2F2F2",
} as const;

/** Pencil drawn in this repo. Box is `editSize` by `editSize`. */
export const PENCIL_PATH = "M10.8 1.2l2.8 2.8L4.8 13l-2.6.6.6-2.6 8-9.8z";

/** Characters that fit `cardW - textX - textPad` at 15px. */
export const NAME_LINE_CHARS = 15;

export const FAMILY_DEFAULT_DEPTH = 5;

export function edgeForSex(sex: string | undefined): string {
  return sex === "F" ? chartTokens.edgeFemale : chartTokens.edgeUnknown;
}

/** Scale as the percent the user reads. `initialScale` reads as 100%. */
export function zoomPercent(scale: number): number {
  return Math.round((scale / chartTokens.initialScale) * 100);
}

/** Card detail at a scale. Measured on MyHeritage at 2026-10-23. */
export type ZoomTier = "full" | "mid" | "compact";

export function zoomTier(scale: number): ZoomTier {
  const percent = zoomPercent(scale);
  if (percent <= chartTokens.compactBelowPercent) return "compact";
  if (percent <= chartTokens.datesBelowPercent) return "mid";
  return "full";
}

/** CSS custom properties. The stylesheet and the SVG renderer share this set. */
export function chartTokenCss(): string {
  const t = chartTokens;
  return [
    `--card-edge-male:${t.edgeMale}`,
    `--card-edge-female:${t.edgeFemale}`,
    `--card-edge-unknown:${t.edgeUnknown}`,
    `--chart-wire:${t.wire}`,
    `--chart-couple:${t.coupleLink}`,
    `--chart-ink:${t.ink}`,
    `--chart-name:${t.nameInk}`,
    `--chart-stage:${t.stage}`,
    `--chart-font:${t.font}`,
    `--chart-radius:${t.radius}px`,
  ].join(";");
}

export function familyDepthChoices(selected: string): { value: string; label: string }[] {
  const base = ["1", "2", "3", "4", "5", "all"];
  const values = base.includes(selected) ? base : [...base, selected];
  return values.map((value) => ({
    value,
    label: value === "all" ? "All" : value === "5" ? "5+" : value,
  }));
}

/** `5+` is five generations above the focus person and five below. */
export function depthWindow(depth: number): { above: number; below: number } {
  return { above: depth, below: depth };
}

export function peopleCountLabel(shown: number, total: number): string {
  const noun = total === 1 ? "person" : "people";
  return `${shown} of ${total} ${noun}`;
}

/** Name baselines, then the dates baseline. Two lines stay above the dates line. */
export function cardTextBaselines(lineCount: number): { names: number[]; date: number } {
  const count = Math.max(1, lineCount);
  const names = Array.from({ length: count }, (_, i) => 40 + i * 18);
  return { names, date: 40 + count * 18 + 6 };
}
