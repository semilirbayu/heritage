// Static family-chart SVG. The viewer draws the same geometry from chartTokens.
// Tests snapshot one small tree so card anatomy stays visible in review.

import type { FamilyLayout, LayoutNode } from "./family";
import { cardTextBaselines, chartTokens, edgeForSex, PENCIL_PATH } from "./chartTokens";

export interface ChartCardPerson {
  name: string;
  nameLines: string[];
  sex?: string;
  living?: boolean;
  birthYear?: string;
  deathYear?: string;
}

const t = chartTokens;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
}

function datesOf(person: ChartCardPerson): string {
  const years = [person.birthYear, person.deathYear].filter(Boolean).join(" – ");
  if (years) return years;
  return person.living === false ? "Deceased" : "Living";
}

function cardSvg(node: LayoutNode, person: ChartCardPerson): string {
  const sex = person.sex;
  const edge = edgeForSex(sex);
  const cls = sex === "F" ? "sex-f" : sex === "M" ? "sex-m" : "sex-u";
  const lines = person.nameLines.length > 0 ? person.nameLines.slice(0, 2) : [person.name];
  const rows = cardTextBaselines(lines.length);
  const photoR = t.photo / 2;
  const photoCx = t.photoX + photoR;
  const photoCy = t.photoY + photoR;
  const ring = t.focusRingWidth;
  const focus = node.isFocus
    ? `<rect class="focus-ring" x="${-ring}" y="${-ring}" width="${t.cardW + ring * 2}" height="${t.cardH + ring * 2}" rx="${t.radius + ring}" fill="none" stroke="${edge}" stroke-width="${ring}"/>`
    : "";
  const names = lines
    .map((line, i) => `<text class="node-name" x="${t.textX}" y="${rows.names[i]}" font-family="${esc(t.font)}" font-size="${t.nameSize}" font-weight="${t.nameWeight}" fill="${t.nameInk}">${esc(line)}</text>`)
    .join("");
  const expand = node.hasDescendants && (node.collapsed || node.atDepthLimit)
    ? `<g class="expand" role="button" aria-label="Expand branch of ${esc(person.name)}" transform="translate(${t.cardW / 2} ${t.cardH + 14})"><circle class="node-add-bg" r="11" fill="${t.cardFill}" stroke="${t.ink}" stroke-width="1"/><text class="node-add" y="5" text-anchor="middle" font-size="14" fill="${t.nameInk}">+</text></g>`
    : "";
  return `<g class="node ${cls}${node.isFocus ? " focus" : ""}" transform="translate(${node.x} ${node.y})">${focus}<rect class="card" width="${t.cardW}" height="${t.cardH}" rx="${t.radius}" fill="${t.cardFill}" stroke="${edge}" stroke-width="${t.edgeWidth}"/><circle class="photo" cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="${t.photoFill}"/><text class="initials" x="${photoCx}" y="${photoCy + 5}" text-anchor="middle" font-family="${esc(t.font)}" font-size="18" fill="${t.ink}">${esc(initials(person.name))}</text>${names}<text class="node-sub" x="${t.textX}" y="${rows.date}" font-family="${esc(t.font)}" font-size="${t.dateSize}" fill="${t.ink}">${esc(datesOf(person))}</text><g class="edit" role="img" aria-label="Edit ${esc(person.name)}" focusable="false" transform="translate(${t.editX} ${t.editY})"><path d="${PENCIL_PATH}" fill="${t.ink}"/></g>${expand}</g>`;
}

function wirePaths(layout: FamilyLayout): string {
  const parts: string[] = [];
  for (const bus of layout.buses) {
    const legs = [...bus.legs].sort((a, b) => a - b);
    const kids = [...bus.kids].sort((a, b) => a - b);
    const left = Math.min(...legs, ...kids);
    const right = Math.max(...legs, ...kids);
    for (const x of legs) parts.push(`M${x} ${bus.pbot}V${bus.bus}`);
    if (left !== right) parts.push(`M${left} ${bus.bus}H${right}`);
    for (const x of kids) parts.push(`M${x} ${bus.bus}V${bus.kidTop}`);
  }
  return parts
    .map((d) => `<path d="${d}" fill="none" stroke="${t.wire}" stroke-width="${t.wireWidth}" stroke-linecap="butt" stroke-linejoin="miter"/>`)
    .join("");
}

function coupleMarks(layout: FamilyLayout): { links: string; pills: string } {
  const at = new Map(layout.nodes.filter((n) => !n.kind).map((n) => [n.personId, n]));
  const links: string[] = [];
  const pills: string[] = [];
  for (const edge of layout.edges) {
    if (edge.kind !== "partner") continue;
    const a = at.get(edge.from);
    const b = at.get(edge.to);
    if (!a || !b) continue;
    const left = a.x <= b.x ? a : b;
    const right = a.x <= b.x ? b : a;
    const y = left.y + left.h / 2;
    links.push(`<path d="M${left.x + t.cardW} ${y}H${right.x}" fill="none" stroke="${t.coupleLink}" stroke-width="${t.coupleLinkWidth}" stroke-linecap="butt"/>`);
    const mid = (left.x + t.cardW + right.x) / 2;
    const pair = t.pillW * 2 + t.pillGap;
    const x0 = mid - pair / 2;
    const y0 = left.y - t.pillH / 2;
    const pill = (x: number) => `<rect class="couple-pill" x="${x}" y="${y0}" width="${t.pillW}" height="${t.pillH}" rx="${t.pillRadius}" fill="${t.coupleLink}"/>`;
    pills.push(pill(x0), pill(x0 + t.pillW + t.pillGap));
  }
  return { links: links.join(""), pills: pills.join("") };
}

/** Full-chart SVG. The viewBox is the layout, not the screen. */
export function renderFamilyChartSvg(layout: FamilyLayout, people: ReadonlyMap<string, ChartCardPerson>): string {
  const marks = coupleMarks(layout);
  const cards = layout.nodes
    .filter((n) => !n.kind)
    .map((n) => {
      const person = people.get(n.personId);
      if (!person) return "";
      return cardSvg(n, person);
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><rect class="stage" width="100%" height="100%" fill="${t.stage}"/>${wirePaths(layout)}${marks.links}${cards}${marks.pills}</svg>`;
}
