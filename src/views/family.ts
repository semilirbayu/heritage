// Pure view-model for the Family view: ancestors above, root in the middle,
// descendants below. No DOM here — tests assert layout behavior.
// No DOM here — the app renders nodes/edges to SVG; tests assert geometry.

import type { Tree } from "../domain/types";
import { preferredName } from "../domain/tree";
import { chartTokens, NAME_LINE_CHARS, peopleCountLabel } from "./chartTokens";

export { peopleCountLabel };

export type TreeViewMode = "family" | "pedigree" | "fan";

export interface LayoutNode {
  personId: string;
  x: number;
  y: number;
  /** Card height: rows take the tallest card so padding stays consistent. */
  h: number;
  generation: number;
  hasDescendants: boolean;
  descendantCount: number;
  collapsed: boolean;
  atDepthLimit: boolean;
  branchFamilyIds: string[];
  hasAncestors: boolean;
  atAncestorDepthLimit: boolean;
  /**
   * Parents exist in the tree but are not placed (in-law line, depth cap,
   * collapsed). Rendered as a MyHeritage-style ↑ branch icon above the
   * card; expanding is independent per line, never an accordion.
   */
  hasHiddenParents: boolean;
  /**
   * How many ancestors are hidden above this card (same number the ↑ pill
   * shows, mirroring the descendant pill counts below cards).
   */
  hiddenAncestorCount: number;
  /** The focused (root) person: rendered emphasized, never dimmed. */
  isFocus: boolean;
  /** Absent on person cards. Placeholders stand in for hidden subtrees. */
  kind?: "placeholder";
  /** Side the placeholder stands on. Absent on person cards. */
  direction?: "above" | "below";
  /** The person the hidden branch hangs on. Absent on person cards. */
  anchorId?: string;
  /** Display name shown on a placeholder card. */
  label?: string;
  /** People hidden below (descendant placeholders). */
  hiddenDescendants?: number;
  /** People hidden above (ancestor placeholders). */
  hiddenAncestors?: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  kind: "partner" | "parent";
}

/**
 * A parent→bus→children drop line: `legs` holds the single central drop's
 * x (couple midpoint), `pbot` the parents' shared bottom edge, `pl`/`pr`
 * the inner facing edges of the leftmost/rightmost partner cards. The
 * client draws a Y-connector physically joining both cards into the stem,
 * MyHeritage style. `x` stays the midpoint (single-point fallback).
 */
export interface LayoutBus {
  x: number;
  top: number;
  bus: number;
  kids: number[];
  kidTop: number;
  legs: number[];
  pbot: number;
  /** Inner facing edges of the outer partner cards (equal when single). */
  pl: number;
  pr: number;
}

export interface FamilyLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  buses: LayoutBus[];
  width: number;
  height: number;
  siblingCount: number;
  showSiblings: boolean;
  truncatedCount: number;
  nodeWidth: number;
  nodeHeight: number;
  view: TreeViewMode;
}

export const NODE_W = chartTokens.cardW;
export const NODE_H = chartTokens.cardH;
/** Partner gap. The partner pitch is `NODE_W + COUPLE_GAP` (254). */
export const COUPLE_GAP = chartTokens.coupleGap;
/**
 * Base sibling gap. Tight sibling pitch is `NODE_W + X_GAP` (254).
 * A wide sibling unit may breathe up to 289 when its subtree needs room.
 * The gap never drops below this value.
 */
export const X_GAP = chartTokens.siblingGap;
/** Generation gap. The generation pitch is `NODE_H + Y_GAP` (188). */
export const Y_GAP = chartTokens.generationGap;
/** Pitch between partners inside one couple. */
export const COUPLE_PITCH = NODE_W + COUPLE_GAP;
/** Pitch from one generation row to the next. */
export const GENERATION_PITCH = NODE_H + Y_GAP;

/**
 * Wrap a display name inside the text column (`cardW - textX - textPad`).
 * At most two lines. A third line becomes an ellipsis on line two.
 */
export function wrapDisplayName(name: string): string[] {
  const words = String(name || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["?"];
  const lines: string[] = [];
  let index = 0;
  while (index < words.length && lines.length < 2) {
    let end = index + 1;
    while (end < words.length && words.slice(index, end + 1).join(" ").length <= NAME_LINE_CHARS) end++;
    let line = words.slice(index, end).join(" ");
    if (line.length > NAME_LINE_CHARS) line = `${line.slice(0, NAME_LINE_CHARS - 1)}…`;
    const moreAfter = end < words.length;
    if (lines.length === 1 && moreAfter && !line.endsWith("…")) {
      line = `${line.slice(0, NAME_LINE_CHARS - 1)}…`;
    }
    lines.push(line);
    index = end;
  }
  return lines;
}
const MAX_COLUMNS = 4;
export const MAX_VISIBLE_PEOPLE = 500;
const MAX_SIBLINGS = 12;
/** Placeholder card geometry: same card width, fits one 72px gap. */
const PH_W = NODE_W;
const PH_H = 56;
const PH_GAP = 8;
/**
 * Above-placeholders tab onto the card's top edge (12px overlap) instead of
 * floating in the row gap: the sibling-bus lanes sit in that gap, and a
 * floating box let the bar run through it. The overlap puts the box above
 * the highest lane; the anchor's own drop plugs into the box top.
 */
const PH_TAB = 12;

/**
 * Build a placeholder card: dashed stand-in for a hidden branch. The only
 * place that knows the `ph:` id scheme, so the viewer reads `direction` and
 * `anchorId` instead of parsing ids.
 */
function placeholderNode(o: {
  direction: "above" | "below";
  anchorId: string;
  x: number;
  y: number;
  h: number;
  generation: number;
  label: string;
  hiddenDescendants: number;
  hiddenAncestors: number;
  collapsed?: boolean;
  atDepthLimit?: boolean;
  branchFamilyIds?: string[];
}): LayoutNode {
  return {
    personId: (o.direction === "above" ? "ph:above:" : "ph:below:") + o.anchorId,
    anchorId: o.anchorId,
    direction: o.direction,
    x: o.x,
    y: o.y,
    h: o.h,
    generation: o.generation,
    hasDescendants: false,
    descendantCount: 0,
    collapsed: o.collapsed ?? false,
    atDepthLimit: o.atDepthLimit ?? false,
    branchFamilyIds: o.branchFamilyIds ?? [],
    hasAncestors: false,
    atAncestorDepthLimit: false,
    hasHiddenParents: false,
    hiddenAncestorCount: 0,
    isFocus: false,
    kind: "placeholder",
    label: o.label,
    hiddenDescendants: o.hiddenDescendants,
    hiddenAncestors: o.hiddenAncestors,
  };
}

/** A placeholder above the top row would leave the canvas: shift every card
 * down together so relative layout and row gaps stay identical. */
function shiftAboveCanvas(cards: LayoutNode[]): void {
  const minY = Math.min(0, ...cards.map((p) => p.y));
  if (minY < 0) for (const n of cards) n.y += -minY;
}

function rowWidth(count: number): number {
  return count <= 0 ? 0 : count * NODE_W + (count - 1) * COUPLE_GAP;
}

/** Drop lines shared by one family: per-partner drops → bus bar → kids. */
function buildBuses(
  nodes: LayoutNode[],
  families: Tree["families"],
  included: ReadonlySet<string>,
): LayoutBus[] {
  const at = new Map(nodes.map((n) => [n.personId, n]));
  const raw: { x: number; top: number; kidTop: number; kids: number[]; legs: number[]; pbot: number; pl: number; pr: number }[] = [];
  for (const f of families) {
    if (!included.has(f.id)) continue;
    const partners = f.partners.filter((p) => at.has(p)).sort((a, b) => at.get(a)!.x - at.get(b)!.x);
    const kids = f.children.filter((c) => at.has(c)).sort((a, b) => at.get(a)!.x - at.get(b)!.x);
    if (partners.length === 0 || kids.length === 0) continue;
    // Each parent card gets a vertical drop from its own bottom-center to
    // the bus — every wire physically touches a card, nothing floats.
    // The bus bar joins them and distributes to children. Corners are
    // square. The client draws the strokes.
    const legs = partners.map((p) => at.get(p)!.x + NODE_W / 2);
    const top = Math.max(...partners.map((p) => at.get(p)!.y + (at.get(p)!.h ?? NODE_H) / 2));
    const pbot = Math.max(...partners.map((p) => at.get(p)!.y + (at.get(p)!.h ?? NODE_H)));
    const x = (at.get(partners[0])!.x + at.get(partners[partners.length - 1])!.x + NODE_W) / 2;
    const kidTop = Math.min(...kids.map((c) => at.get(c)!.y));
    if (kidTop <= top) continue;
    raw.push({ x, top, kidTop, kids: kids.map((c) => at.get(c)!.x + NODE_W / 2), legs, pbot, pl: legs[0]!, pr: legs[legs.length - 1]! });
  }
  // Lane separation: families sharing one generation gap would otherwise
  // draw collinear, overlapping bus bars (one indistinguishable line with
  // stray verticals). Overlapping spans get distinct lanes via greedy
  // interval coloring; a lone bus keeps the exact midpoint.
  const buses: LayoutBus[] = [];
  const byGap = new Map<string, typeof raw>();
  for (const r of raw) {
    const key = `${r.top}|${r.kidTop}`;
    const list = byGap.get(key) ?? [];
    list.push(r);
    byGap.set(key, list);
  }
  for (const list of byGap.values()) {
    const spans = list.map((r) => {
      const xs = [...r.legs, ...r.kids];
      return { r, lo: Math.min(...xs), hi: Math.max(...xs), lane: 0 };
    });
    spans.sort((a, b) => a.lo - b.lo);
    const laneEnds: number[] = [];
    for (const s of spans) {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane]! > s.lo) lane++;
      s.lane = lane;
      laneEnds[lane] = s.hi;
    }
    const lanes = Math.max(1, laneEnds.length);
    for (const s of spans) {
      // Lone buses keep the exact midpoint. Shared gaps spread lanes across
      // the middle band only (fractions 0.4–0.6): collapse pills live near
      // the top of the gap and ↑ icons near the bottom, so lanes never run
      // behind them.
      const frac = lanes === 1 ? 0.5 : 0.4 + (0.2 * s.lane) / (lanes - 1);
      const bus = s.r.top + (s.r.kidTop - s.r.top) * frac;
      buses.push({ x: s.r.x, top: s.r.top, bus, kids: s.r.kids, kidTop: s.r.kidTop, legs: s.r.legs, pbot: s.r.pbot, pl: s.r.pl, pr: s.r.pr });
    }
  }
  return buses;
}

/**
 * Family-view engine, cloned from MyHeritage rules: couples sit tight
 * (COUPLE_GAP), sibling/unit boundaries breathe wider (X_GAP); each couple
 * centered over its own children (tidy descendant layout), ancestors
 * centered above. The client draws a Y-connector joining both partner
 * cards into one central drop plus parent→bus→child drop lines from the
 * emitted buses — no partner bars, like MyHeritage.
 */
function layoutFamilyView(
  tree: Tree,
  rootId: string,
  maxDepth: number,
  collapsed: ReadonlySet<string>,
  expandedAncestors: ReadonlySet<string>,
  minimizedAncestorIds: ReadonlySet<string>,
  showSiblings: boolean,
  showCousins: boolean,
  siblingPersonIds: ReadonlySet<string>,
  showYears: boolean,
  showPhotos: boolean,
  familiesByPartner: Map<string, Tree["families"]>,
  familiesByChild: Map<string, Tree["families"]>,
): FamilyLayout {
  const STEP_X = NODE_W + X_GAP;
  const sexById = new Map(tree.persons.map((p) => [p.id, p.sex]));
  const gen = new Map<string, number>([[rootId, 0]]);
  const included = new Set<string>();
  const truncated = new Set<string>();
  const visited = new Set<string>([rootId]);
  const siblingAdded = new Set<string>();
  const cappedUnder = new Set<string>();
  const cap = (id: string, g: number): boolean => {
    if (visited.has(id)) return false;
    if (visited.size >= MAX_VISIBLE_PEOPLE) {
      truncated.add(id);
      return false;
    }
    visited.add(id);
    gen.set(id, g);
    return true;
  };

  // Membership: descendants below, optional same-row siblings, ancestors above.
  const descStack = [rootId];
  const doneDesc = new Set<string>();
  while (descStack.length > 0) {
    const pid = descStack.pop()!;
    if (doneDesc.has(pid)) continue;
    doneDesc.add(pid);
    const g = gen.get(pid)!;
    for (const f of familiesByPartner.get(pid) ?? []) {
      included.add(f.id);
      for (const q of f.partners) if (cap(q, g)) descStack.push(q);
      if (g >= maxDepth || collapsed.has(f.id)) continue;
      for (const c of f.children) {
        if (cap(c, g + 1)) descStack.push(c);
        else if (truncated.has(c)) cappedUnder.add(pid);
      }
    }
  }
  const siblingAnchor = new Map<string, string>();
  const siblingGroup = new Map<string, string>();
  const addSiblingsOf = (pid: string, force = false): void => {
    const g = gen.get(pid);
    if (g === undefined) return;
    if (!force && Math.abs(g) > maxDepth) return;
    for (const f of familiesByChild.get(pid) ?? []) {
      included.add(f.id);
      const sibs = f.children.filter((id) => id !== pid);
      for (const s of sibs.slice(0, MAX_SIBLINGS)) {
        if (!cap(s, g)) continue;
        siblingAdded.add(s);
        siblingAnchor.set(s, pid);
        siblingGroup.set(s, f.id);
        for (const sf of familiesByPartner.get(s) ?? []) {
          included.add(sf.id);
          for (const q of sf.partners) {
            if (cap(q, g)) {
              siblingAdded.add(q);
              siblingAnchor.set(q, pid);
              siblingGroup.set(q, f.id);
            }
          }
        }
      }
      for (const s of sibs.slice(MAX_SIBLINGS)) truncated.add(s);
    }
  };
  if (showSiblings) addSiblingsOf(rootId);
  // Blood ancestors of the focused person only — verified against the
  // MyHeritage Family view for this exact tree: a spouse's parents
  // (in-law lines) stay hidden until you refocus onto that spouse, while
  // aunts/uncles, cousins and nephews/nieces ride along visibly.
  // The ↑ branch affordance (expandedAncestorIds) seeds extra lines here:
  // each expansion is independent — MyHeritage has no accordion rule,
  // expanding one line never minimizes the others.
  const ancStack = [rootId];
  for (const id of expandedAncestors) {
    if (gen.has(id) && !ancStack.includes(id)) ancStack.push(id);
  }
  const doneAnc = new Set<string>();
  while (ancStack.length > 0) {
    const pid = ancStack.pop()!;
    if (doneAnc.has(pid)) continue;
    doneAnc.add(pid);
    // Minimized per-card upstream: the person stays, everything above them
    // (parents, their siblings) is pruned from this load. Ancestors shared
    // with other lines survive via those paths; the ↑ icon restores.
    if (minimizedAncestorIds.has(pid)) continue;
    const g = gen.get(pid)!;
    if (Math.abs(g) >= maxDepth && !expandedAncestors.has(pid)) continue;
    for (const f of familiesByChild.get(pid) ?? []) {
      included.add(f.id);
      for (const q of f.partners) {
        if (!cap(q, g - 1)) continue;
        ancStack.push(q);
        // Aunts and uncles (+ their partners) ride along with their
        // blood sibling, the way a MyHeritage branch shows the whole
        // collateral line around the main person. Skipped for minimized
        // lines so pruning above one person hides that whole side branch.
        if (showSiblings && !minimizedAncestorIds.has(q)) addSiblingsOf(q);
      }
    }
  }
  // Siblings of any placed person (extra aunts/uncles), on explicit expand.
  for (const sid of siblingPersonIds) {
    if (gen.has(sid)) addSiblingsOf(sid);
  }
  // Descendants of the focus person's siblings (the "Show cousins" set),
  // plus descendants of aunts and uncles. Cousins off keeps the siblings
  // and drops only the focus-sibling descendant line. Never upward, so
  // no in-law pedigree leaks in.
  const colStack = [...siblingAdded].filter((id) => showCousins || siblingAnchor.get(id) !== rootId);
  const doneCol = new Set<string>();
  while (colStack.length > 0) {
    const pid = colStack.pop()!;
    if (doneCol.has(pid)) continue;
    doneCol.add(pid);
    const g = gen.get(pid);
    if (g === undefined) continue;
    for (const f of familiesByPartner.get(pid) ?? []) {
      included.add(f.id);
      for (const q of f.partners) if (cap(q, g)) colStack.push(q);
      if (g >= maxDepth || collapsed.has(f.id)) continue;
      for (const c of f.children) {
        if (cap(c, g + 1)) colStack.push(c);
        else if (truncated.has(c)) cappedUnder.add(pid);
      }
    }
  }

  const descendantKids = new Map<string, Set<string>>();
  for (const family of tree.families) {
    for (const partner of family.partners) {
      const kids = descendantKids.get(partner) ?? new Set<string>();
      for (const child of family.children) kids.add(child);
      descendantKids.set(partner, kids);
    }
  }

  // Tidy x positions (centers, relative). y comes from generation rows later.
  const rel = new Map<string, number>();
  const positioned = new Set<string>();
  const active = new Set<string>();
  const placedKidsByParent = new Map<string, Set<string>>();

  function descBlock(pid: string): { width: number; members: string[] } {
    if (active.has(pid)) return { width: 0, members: [] };
    active.add(pid);
    const g = gen.get(pid)!;
    const unit: string[] = [pid];
    const fams = (familiesByPartner.get(pid) ?? []).filter((f) => included.has(f.id));
    for (const f of fams) {
      for (const q of f.partners) {
        if (q !== pid && gen.get(q) === g && gen.has(q) && !positioned.has(q) && !unit.includes(q)) {
          unit.push(q);
        }
      }
    }
    // MyHeritage couple order: father/husband (M) left, mother/wife (F)
    // right, unknown last — stable so GED HUSB/WIFE order breaks ties.
    const sexRank = (id: string): number => {
      const s = sexById.get(id);
      return s === "M" ? 0 : s === "F" ? 1 : 2;
    };
    unit.sort((a, b) => sexRank(a) - sexRank(b));
    const kids: { width: number; members: string[] }[] = [];
    if (g < maxDepth) {
      const seenKid = new Set<string>();
      const mine = placedKidsByParent.get(pid) ?? new Set<string>();
      for (const f of fams) {
        if (collapsed.has(f.id)) continue;
        for (const c of f.children) {
          if (seenKid.has(c) || positioned.has(c) || gen.get(c) !== g + 1) continue;
          seenKid.add(c);
          mine.add(c);
          kids.push(descBlock(c));
        }
      }
      placedKidsByParent.set(pid, mine);
    }
    const coupleW = rowWidth(unit.length);
    const kidsW = kids.reduce((a, k) => a + k.width, 0) + Math.max(0, kids.length - 1) * X_GAP;
    const width = Math.max(coupleW, kidsW);
    unit.forEach((q, i) => {
      rel.set(q, -coupleW / 2 + NODE_W / 2 + i * COUPLE_PITCH);
      positioned.add(q);
    });
    let x = -kidsW / 2;
    for (const k of kids) {
      const shift = x + k.width / 2;
      for (const m of k.members) rel.set(m, rel.get(m)! + shift);
      x += k.width + X_GAP;
    }
    active.delete(pid);
    return { width, members: [...unit, ...kids.flatMap((k) => k.members)] };
  }

  descBlock(rootId);

  // Ancestors: couples stay adjacent like in the descendant pass. Each
  // parent row is centered on its child; per-row occupancy cascades any
  // collision rightward so collateral lines never overlap the main pedigree.
  const occupied = new Map<number, Set<number>>();
  for (const [id, g] of gen) {
    if (!positioned.has(id)) continue;
    const row = occupied.get(g) ?? new Set<number>();
    row.add(rel.get(id)!);
    occupied.set(g, row);
  }
  const claim = (g: number, desiredX: number): number => {
    const row = occupied.get(g) ?? new Set<number>();
    let x = desiredX;
    for (;;) {
      let next = x;
      for (const y of row) {
        if (Math.abs(next - y) < NODE_W + X_GAP) next = Math.max(next, y + STEP_X);
      }
      if (next === x) break;
      x = next;
    }
    row.add(x);
    occupied.set(g, row);
    return x;
  };
  const activeA = new Set<string>();
  function placeAncestors(pid: string): void {
    if (activeA.has(pid)) return;
    activeA.add(pid);
    const baseX = rel.get(pid) ?? 0;
    const myG = gen.get(pid)!;
    const fresh: string[] = [];
    for (const f of familiesByChild.get(pid) ?? []) {
      if (!included.has(f.id)) continue;
      for (const q of f.partners) {
        if (gen.get(q) === myG - 1 && !fresh.includes(q) && !positioned.has(q)) fresh.push(q);
      }
    }
    // Father left, mother right like the descendant pass.
    fresh.sort((a, b) => {
      const ra = sexById.get(a) === "M" ? 0 : sexById.get(a) === "F" ? 1 : 2;
      const rb = sexById.get(b) === "M" ? 0 : sexById.get(b) === "F" ? 1 : 2;
      return ra - rb;
    });
    // Claim the couple jointly so the tight partner pitch survives: the
    // pair shifts right together until both clear the row occupancy.
    const targets = fresh.map((q, i) =>
      fresh.length === 1 ? baseX : baseX - rowWidth(fresh.length) / 2 + NODE_W / 2 + i * COUPLE_PITCH,
    );
    let pairShift = 0;
    for (let iter = 0; iter < 12; iter++) {
      let need = pairShift;
      for (const d of targets) {
        const row = occupied.get(myG - 1) ?? new Set<number>();
        let x = d + pairShift;
        for (;;) {
          let next = x;
          for (const y of row) {
            if (Math.abs(next - y) < NODE_W + X_GAP) next = Math.max(next, y + STEP_X);
          }
          if (next === x) break;
          x = next;
        }
        need = Math.max(need, x - d);
      }
      if (need === pairShift) break;
      pairShift = need;
    }
    fresh.forEach((q, i) => {
      rel.set(q, targets[i]! + pairShift);
      positioned.add(q);
      const row = occupied.get(myG - 1) ?? new Set<number>();
      row.add(targets[i]! + pairShift);
      occupied.set(myG - 1, row);
      placeAncestors(q);
    });
    activeA.delete(pid);
  }
  // Blood chain first (centering priority), then explicitly expanded lines
  // (↑ branch icons). Each expansion is independent — never an accordion.
  if (positioned.has(rootId)) placeAncestors(rootId);
  for (const id of expandedAncestors) {
    if (id !== rootId && gen.has(id) && positioned.has(id)) placeAncestors(id);
  }

  // Shift a whole collateral block until every row it touches is clear on
  // the chosen side. Internal centering (couple over kids) survives the
  // move, so cousin branches read exactly like the main branch, just
  // placed aside. Parking blocks on BOTH sides keeps the blood line in the
  // middle of the layout instead of pinning it to the left edge.
  function shiftBlock(members: string[], dir: number): void {
    let shift = 0;
    for (let iter = 0; iter < 12; iter++) {
      let need = shift;
      for (const m of members) {
        const g = gen.get(m);
        if (g === undefined) continue;
        const row = occupied.get(g) ?? new Set<number>();
        let x = rel.get(m)! + shift;
        for (;;) {
          let next = x;
          for (const y of row) {
            if (Math.abs(next - y) >= NODE_W + X_GAP) continue;
            next = dir > 0 ? Math.max(next, y + STEP_X) : Math.min(next, y - STEP_X);
          }
          if (next === x) break;
          x = next;
        }
        const delta = x - rel.get(m)!;
        if (dir > 0) need = Math.max(need, delta);
        else need = Math.min(need, delta);
      }
      if (need === shift) break;
      shift = need;
    }
    for (const m of members) {
      const g = gen.get(m);
      if (g === undefined) continue;
      rel.set(m, rel.get(m)! + shift);
      positioned.add(m);
      const row = occupied.get(g) ?? new Set<number>();
      row.add(rel.get(m)!);
      occupied.set(g, row);
    }
  }

  // Collateral blocks: aunts/uncles (and root siblings) that have children
  // in scope get their own tidy descendant block — couple centered over
  // cousins, cousins' couples over their kids — parked to the right of the
  // main branch. Childless ones fall through to the pending row below.
  const hasScopedKids = (id: string): boolean => {
    const g = gen.get(id);
    if (g === undefined) return false;
    return (familiesByPartner.get(id) ?? []).some(
      (f) =>
        included.has(f.id) &&
        !collapsed.has(f.id) &&
        f.children.some((c) => gen.get(c) === g + 1),
    );
  };
  // Childless siblings ride directly beside their blood line, BEFORE
  // cousin blocks park further out. This keeps the focus family —
  // Bayu, spouse, Uum, Wahyu — contiguous like MyHeritage, so the parent
  // bus stays short and every sibling's parentage is traceable. Blocks
  // clear these via occupancy.
  const pendingByGen = new Map<number, string[]>();
  for (const id of siblingAdded) {
    if (positioned.has(id)) continue;
    const anchor = siblingAnchor.get(id);
    if (!anchor || !positioned.has(anchor)) continue;
    const g = gen.get(id)!;
    const list = pendingByGen.get(g) ?? [];
    list.push(id);
    pendingByGen.set(g, list);
  }
  for (const [g, ids] of pendingByGen) {
    let rowEdge = -Infinity;
    for (const [id, gg] of gen) {
      if (gg === g && positioned.has(id)) rowEdge = Math.max(rowEdge, rel.get(id)! + NODE_W / 2);
    }
    if (!Number.isFinite(rowEdge)) continue;
    // Sibling groups from different families get breathing room so each
    // group reads as its own unit instead of one undifferentiated row.
    // Partners of the previously placed sibling keep the tight couple
    // pitch, exactly like descendant blocks.
    const shareFamily = (a: string, b: string): boolean =>
      (familiesByPartner.get(a) ?? []).some(
        (f) => included.has(f.id) && f.partners.includes(b),
      );
    let prevGroup: string | undefined;
    let prevId: string | undefined;
    for (const id of ids) {
      const group = siblingGroup.get(id);
      // Aunts/uncles that head their own descendant block are parked by
      // the block pass below, not here.
      if (g < 0 && hasScopedKids(id)) continue;
      if (g >= 0 && siblingAnchor.get(id) === rootId && hasScopedKids(id)) continue;
      const gap =
        prevId !== undefined && shareFamily(prevId, id)
          ? COUPLE_GAP
          : prevGroup !== undefined && group !== undefined && group !== prevGroup
            ? X_GAP * 2
            : X_GAP;
      rowEdge += gap + NODE_W / 2;
      rel.set(id, rowEdge);
      positioned.add(id);
      const row = occupied.get(g) ?? new Set<number>();
      row.add(rowEdge);
      occupied.set(g, row);
      rowEdge += NODE_W / 2;
      prevGroup = group;
      prevId = id;
    }
  }

  // Collateral blocks, parked after the pending siblings: aunts/uncles
  // (and root siblings) that have children in scope get their own tidy
  // descendant block — couple centered over cousins, cousins' couples
  // over their kids. shiftBlock keeps their internal centering intact.
  // Blocks alternate to the lighter side by accumulated width, so a tree
  // full of cousin branches spreads around the blood line instead of
  // piling everything to the right of it.
  let parkedRight = 0;
  let parkedLeft = 0;
  for (const id of siblingAdded) {
    const g = gen.get(id);
    if (g === undefined || positioned.has(id)) continue;
    if (g >= 0 && siblingAnchor.get(id) !== rootId) continue;
    if (!hasScopedKids(id)) continue;
    const { members, width } = descBlock(id);
    const dir = parkedRight <= parkedLeft ? 1 : -1;
    shiftBlock(members, dir);
    if (dir > 0) parkedRight += width;
    else parkedLeft += width;
  }

  let minX = Infinity;
  let minG = 0;
  for (const [id, g] of gen) {
    if (!positioned.has(id)) continue;
    minX = Math.min(minX, rel.get(id)! - NODE_W / 2);
    minG = Math.min(minG, g);
  }
  if (!Number.isFinite(minX)) minX = 0;
  // One fixed height for every row (name-only cards are all compact).
  // The years/status line decides between roomy and ultra-compact; photos
  // fit inside the roomy height, so every level styles identically.
  const rowH = new Map<number, number>();
  // One measured card height. Year and photo settings change the drawing, not the pitch.
  const uniformH = NODE_H;
  void showYears;
  void showPhotos;
  for (const [id, g] of gen) {
    if (!positioned.has(id)) continue;
    rowH.set(g, Math.max(rowH.get(g) ?? 0, uniformH));
  }
  const rowY = new Map<number, number>();
  {
    let cursorY = 0;
    const gens = [...rowH.keys()].sort((a, b) => a - b);
    for (const g of gens) {
      rowY.set(g, cursorY);
      cursorY += rowH.get(g)! + Y_GAP;
    }
  }

  const nodes: LayoutNode[] = [];
  let width = 1;
  let height = 1;
  // Ancestors hidden above each card (for the ↑ count pill): walk upward
  // through whoever is not placed. The walk stops at the first placed
  // ancestor — that card owns its own affordance, so only the person at the
  // top of a collapsed line carries the pill (not everyone below it).
  const countHiddenAncestors = (id: string): number => {
    const seen = new Set<string>([id]);
    const stack = [id];
    let count = 0;
    while (stack.length > 0) {
      const pid = stack.pop()!;
      for (const f of familiesByChild.get(pid) ?? []) {
        for (const q of f.partners) {
          if (seen.has(q)) continue;
          seen.add(q);
          if (positioned.has(q)) continue;
          count++;
          stack.push(q);
        }
      }
    }
    return count;
  };
  for (const [id, g] of gen) {
    if (!positioned.has(id)) continue;
    const x = rel.get(id)! - NODE_W / 2 - minX;
    const y = rowY.get(g) ?? 0;
    const h = rowH.get(g) ?? NODE_H;
    const treeKids = descendantKids.get(id) ?? new Set<string>();
    const placedKids = placedKidsByParent.get(id) ?? new Set<string>();
    const branchFamilies = (familiesByPartner.get(id) ?? []).filter((f) => f.children.length > 0);
    const branchFamilyIds = branchFamilies.map((f) => f.id);
    const atDepthLimit = g >= 0 && g >= maxDepth;
    const hasAncestors = (familiesByChild.get(id)?.length ?? 0) > 0;
    const parentIds = (familiesByChild.get(id) ?? []).flatMap((f) => f.partners);
    const hasHiddenParents = hasAncestors && !parentIds.some((p) => positioned.has(p));
    nodes.push({
      personId: id,
      x,
      y,
      h,
      generation: g,
      hasDescendants: placedKids.size > 0 || (treeKids.size > 0 && (atDepthLimit || branchFamilyIds.some((fid) => collapsed.has(fid)))),
      descendantCount: treeKids.size,
      collapsed: branchFamilyIds.length > 0 && branchFamilyIds.every((fid) => collapsed.has(fid)),
      atDepthLimit,
      branchFamilyIds,
      hasAncestors,
      atAncestorDepthLimit:
        g < 0 && -g >= maxDepth && !expandedAncestors.has(id) && hasAncestors,
      hasHiddenParents,
      hiddenAncestorCount: countHiddenAncestors(id),
      isFocus: id === rootId,
    });
    width = Math.max(width, x + NODE_W);
    height = Math.max(height, y + h);
  }

  const atX = new Map(nodes.map((n) => [n.personId, n.x]));
  const edges: LayoutEdge[] = [];
  for (const f of tree.families) {
    if (!included.has(f.id)) continue;
    const placedPartners = f.partners.filter((p) => atX.has(p)).sort((a, b) => atX.get(a)! - atX.get(b)!);
    for (let i = 1; i < placedPartners.length; i++) {
      edges.push({ from: placedPartners[i - 1]!, to: placedPartners[i]!, kind: "partner" });
    }
    const placedChildren = f.children.filter((c) => atX.has(c));
    if (placedChildren.length > 0 && placedPartners.length > 0) {
      const anchor = placedPartners[0]!;
      for (const c of placedChildren) edges.push({ from: anchor, to: c, kind: "parent" });
    }
  }

  const siblingIds = new Set<string>();
  for (const family of familiesByChild.get(rootId) ?? []) {
    for (const child of family.children) if (child !== rootId) siblingIds.add(child);
  }

  // Placeholder cards: one below each cut descendant branch, one above each
  // cut ancestor line. Pure counts — they never join the visible-people cap.
  const nameOf = (id: string): string =>
    preferredName(tree.persons.find((p) => p.id === id)) || "Hidden branch";
  const countHiddenDescendants = (anchor: string): number => {
    const seen = new Set<string>([anchor]);
    const stack = [anchor];
    let count = 0;
    while (stack.length > 0) {
      const pid = stack.pop()!;
      const placed = gen.has(pid);
      for (const f of familiesByPartner.get(pid) ?? []) {
        if (!placed) {
          for (const q of f.partners) {
            if (q === anchor || seen.has(q)) continue;
            seen.add(q);
            if (!gen.has(q)) count++;
          }
        }
        for (const c of f.children) {
          if (seen.has(c)) continue;
          seen.add(c);
          if (!gen.has(c)) count++;
          stack.push(c);
        }
      }
    }
    return count;
  };
  const firstHiddenAncestorName = (id: string): string => {
    const seen = new Set<string>([id]);
    const stack = [id];
    while (stack.length > 0) {
      const pid = stack.pop()!;
      for (const f of familiesByChild.get(pid) ?? []) {
        for (const q of f.partners) {
          if (seen.has(q)) continue;
          seen.add(q);
          if (!positioned.has(q)) return nameOf(q);
          stack.push(q);
        }
      }
    }
    return "Hidden ancestors";
  };
  const placeholders: LayoutNode[] = [];
  // One below-placeholder per hidden branch: partners of a couple share it,
  // centred under the couple, exactly like their children rows.
  const belowGroups = new Map<string, LayoutNode[]>();
  for (const n of nodes) {
    if (!(n.collapsed || n.atDepthLimit)) continue;
    const key = n.branchFamilyIds.join(",");
    const group = belowGroups.get(key) ?? [];
    group.push(n);
    belowGroups.set(key, group);
  }
  for (const group of belowGroups.values()) {
    const anchor = group[0]!;
    const hidden = countHiddenDescendants(anchor.personId);
    if (hidden <= 0) continue;
    const left = Math.min(...group.map((m) => m.x));
    const right = Math.max(...group.map((m) => m.x));
    const bottom = Math.max(...group.map((m) => m.y + m.h));
    const labels = [...new Set(group.map((m) => nameOf(m.personId)))];
    placeholders.push(placeholderNode({
      direction: "below",
      anchorId: anchor.personId,
      x: (left + right) / 2,
      y: bottom + PH_GAP,
      h: PH_H,
      generation: anchor.generation + 0.5,
      collapsed: anchor.collapsed,
      atDepthLimit: anchor.atDepthLimit,
      branchFamilyIds: anchor.branchFamilyIds,
      label: labels.join(" & "),
      hiddenDescendants: hidden,
      hiddenAncestors: 0,
    }));
  }
  for (const parentId of cappedUnder) {
    const n = nodes.find((node) => node.personId === parentId);
    if (!n) continue;
    const already = placeholders.some(
      (p) => p.direction === "below" && (p.anchorId === parentId || p.branchFamilyIds.some((id) => n.branchFamilyIds.includes(id))),
    );
    if (already) continue;
    const hidden = countHiddenDescendants(parentId);
    if (hidden <= 0) continue;
    placeholders.push(placeholderNode({
      direction: "below",
      anchorId: parentId,
      x: n.x + NODE_W / 2 - PH_W / 2,
      y: n.y + n.h + PH_GAP,
      h: PH_H,
      generation: n.generation + 0.5,
      atDepthLimit: true,
      label: nameOf(parentId),
      hiddenDescendants: hidden,
      hiddenAncestors: 0,
    }));
  }
  for (const n of nodes) {
    if (n.hiddenAncestorCount > 0) {
      placeholders.push(placeholderNode({
        direction: "above",
        anchorId: n.personId,
        x: n.x + NODE_W / 2 - PH_W / 2,
        y: n.y - PH_H + PH_TAB,
        h: PH_H,
        generation: n.generation - 0.5,
        label: firstHiddenAncestorName(n.personId),
        hiddenDescendants: 0,
        hiddenAncestors: n.hiddenAncestorCount,
      }));
    }
  }
  const allCards = [...nodes, ...placeholders];
  shiftAboveCanvas(allCards);
  for (const n of allCards) {
    width = Math.max(width, n.x + (n.kind === "placeholder" ? PH_W : NODE_W));
    height = Math.max(height, n.y + n.h);
  }
  nodes.push(...placeholders);

  return {
    nodes,
    edges,
    buses: buildBuses(nodes, tree.families, included),
    width,
    height,
    siblingCount: siblingIds.size,
    showSiblings,
    truncatedCount: truncated.size,
    nodeWidth: NODE_W,
    nodeHeight: NODE_H,
    view: "family",
  };
}

export function familyLayout(
  tree: Tree,
  rootId: string,
  opts: {
    depth?: number;
    collapsedFamilyIds?: ReadonlySet<string>;
    expandedAncestorIds?: ReadonlySet<string>;
    minimizedAncestorIds?: ReadonlySet<string>;
    showSiblings?: boolean;
    /** Descendants of the focus person's siblings. Default on. */
    showCousins?: boolean;
    siblingPersonIds?: ReadonlySet<string>;
    showYears?: boolean;
    showPhotos?: boolean;
    view?: TreeViewMode;
  } = {},
): FamilyLayout {
  const view = opts.view ?? "family";
  const nodeWidth = view === "fan" ? 142 : NODE_W;
  const nodeHeight = view === "fan" ? 58 : NODE_H;
  if (!tree.persons.some((p) => p.id === rootId)) {
    throw new Error(`person ${rootId} not in tree`);
  }
  const rawDepth = opts.depth;
  const maxDepth =
    typeof rawDepth === "number" && Number.isFinite(rawDepth) && rawDepth >= 0
      ? Math.floor(rawDepth)
      : Number.POSITIVE_INFINITY;
  // Index both relationship directions once. The previous layout scanned all
  // families for every visited person, making navigation O(people × families).
  const familiesByPartner = new Map<string, Tree["families"]>();
  const familiesByChild = new Map<string, Tree["families"]>();
  const addIndex = (index: Map<string, Tree["families"]>, id: string, family: Tree["families"][number]) => {
    const related = index.get(id);
    if (related) related.push(family);
    else index.set(id, [family]);
  };
  for (const family of tree.families) {
    for (const partner of family.partners) addIndex(familiesByPartner, partner, family);
    for (const child of family.children) addIndex(familiesByChild, child, family);
  }

  if (view === "family") {
    return layoutFamilyView(
      tree,
      rootId,
      maxDepth,
      opts.collapsedFamilyIds ?? new Set<string>(),
      opts.expandedAncestorIds ?? new Set<string>(),
      opts.minimizedAncestorIds ?? new Set<string>(),
      opts.showSiblings ?? false,
      opts.showCousins ?? true,
      opts.siblingPersonIds ?? new Set<string>(),
      opts.showYears ?? true,
      opts.showPhotos ?? false,
      familiesByPartner,
      familiesByChild,
    );
  }

  // Ancestors above the focus. Siblings are optional and, when shown, are
  // added only for the focused person so we don't fan out into cousins.
  const gen = new Map<string, number>([[rootId, 0]]);
  const includedFamilies = new Set<string>();
  const truncatedPeople = new Set<string>();
  const addPerson = (id: string, generation: number): boolean => {
    if (gen.has(id)) return false;
    if (gen.size >= MAX_VISIBLE_PEOPLE) {
      truncatedPeople.add(id);
      return false;
    }
    gen.set(id, generation);
    return true;
  };
  const ancestorQueue = [rootId];
  const expandedAncestors = new Set<string>();
  const userExpandedAncestors = opts.expandedAncestorIds ?? new Set<string>();
  while (ancestorQueue.length > 0) {
    const personId = ancestorQueue.pop()!;
    if (expandedAncestors.has(personId)) continue;
    expandedAncestors.add(personId);
    const generation = gen.get(personId)!;
    if (Math.abs(generation) >= maxDepth && !userExpandedAncestors.has(personId)) continue;
    for (const family of familiesByChild.get(personId) ?? []) {
      includedFamilies.add(family.id);
      for (const parentId of family.partners) {
        if (addPerson(parentId, generation - 1)) ancestorQueue.push(parentId);
      }
    }
  }

  // Descendants below the focus (pedigree/fan views show ancestors only).
  const descendantQueue: string[] = [];
  const expandedDescendants = new Set<string>();
  const collapsed = opts.collapsedFamilyIds ?? new Set<string>();
  while (descendantQueue.length > 0) {
    const personId = descendantQueue.pop()!;
    if (expandedDescendants.has(personId)) continue;
    expandedDescendants.add(personId);
    const generation = gen.get(personId)!;
    for (const family of familiesByPartner.get(personId) ?? []) {
      includedFamilies.add(family.id);
      for (const partnerId of family.partners) {
        if (addPerson(partnerId, generation)) descendantQueue.push(partnerId);
      }
      if (generation >= maxDepth || collapsed.has(family.id)) continue;
      for (const childId of family.children) {
        if (addPerson(childId, generation + 1)) descendantQueue.push(childId);
      }
    }
  }

  const descendantIdsByPerson = new Map<string, Set<string>>();
  for (const family of tree.families) {
    for (const partner of family.partners) {
      const childIds = descendantIdsByPerson.get(partner) ?? new Set<string>();
      for (const child of family.children) childIds.add(child);
      descendantIdsByPerson.set(partner, childIds);
    }
  }

  const byGen = new Map<number, string[]>();
  for (const [pid, g] of gen) {
    const list = byGen.get(g) ?? [];
    list.push(pid);
    byGen.set(g, list);
  }
  const nodes: LayoutNode[] = [];
  const minGeneration = Math.min(0, ...byGen.keys());
  const maxGeneration = Math.max(0, ...byGen.keys());
  let width = MAX_COLUMNS * nodeWidth + (MAX_COLUMNS - 1) * X_GAP;
  let height = 1;
  const generations = [...byGen.entries()].sort((a, b) => a[0] - b[0]);
  // Ancestors hidden above each card (depth cap, in-law lines, cap hits).
  // The walk stops at the first placed ancestor — that card carries its own
  // affordance, so only the person at the top of a cut line counts.
  const countHiddenAncestors = (id: string): number => {
    const seen = new Set<string>([id]);
    const stack = [id];
    let count = 0;
    while (stack.length > 0) {
      const pid = stack.pop()!;
      for (const f of familiesByChild.get(pid) ?? []) {
        for (const q of f.partners) {
          if (seen.has(q)) continue;
          seen.add(q);
          if (gen.has(q)) continue;
          count++;
          stack.push(q);
        }
      }
    }
    return count;
  };
  const nameOf = (id: string): string =>
    preferredName(tree.persons.find((p) => p.id === id)) || "Hidden branch";
  const firstHiddenAncestorName = (id: string): string => {
    for (const f of familiesByChild.get(id) ?? []) {
      for (const q of f.partners) {
        if (!gen.has(q)) return nameOf(q);
      }
    }
    return "Hidden ancestors";
  };
  let fanCX = 0;
  let fanCY = 0;
  let fanStep = 0;
  if (view === "fan") {
    const maxAncestorDepth = Math.max(1, ...[...gen.values()].map((generation) => -generation));
    const radiusStep = NODE_H + Y_GAP;
    const maxRadius = maxAncestorDepth * radiusStep;
    const centerX = maxRadius + nodeWidth / 2;
    const centerY = maxRadius + nodeHeight / 2;
    fanCX = centerX;
    fanCY = centerY;
    fanStep = radiusStep;
    width = centerX * 2;
    height = centerY + nodeHeight / 2;
    for (const [generation, ids] of generations) {
      const distance = -generation;
      ids.forEach((personId, index) => {
        const angle = distance === 0 ? -Math.PI / 2 : Math.PI + ((index + 0.5) / ids.length) * Math.PI;
        const radius = distance * radiusStep;
        const descendants = descendantIdsByPerson.get(personId) ?? new Set<string>();
        nodes.push({
          personId,
          x: centerX + radius * Math.cos(angle) - nodeWidth / 2,
          y: centerY + radius * Math.sin(angle) - nodeHeight / 2,
          h: nodeHeight,
          generation,
          hasDescendants: false,
          descendantCount: descendants.size,
          collapsed: false,
          atDepthLimit: false,
          branchFamilyIds: [],
          hasAncestors: (familiesByChild.get(personId)?.length ?? 0) > 0,
          atAncestorDepthLimit:
            generation < 0 && -generation >= maxDepth &&
            !userExpandedAncestors.has(personId) &&
            (familiesByChild.get(personId)?.length ?? 0) > 0,
          hasHiddenParents: false,
          hiddenAncestorCount: countHiddenAncestors(personId),
          isFocus: personId === rootId,
        });
      });
    }
  } else {
    const yByGeneration = new Map<number, number>();
    let cursorY = 0;
    for (let generation = minGeneration; generation <= maxGeneration; generation++) {
      const rowCount = Math.max(1, Math.ceil((byGen.get(generation)?.length ?? 0) / MAX_COLUMNS));
      yByGeneration.set(generation, cursorY);
      cursorY += rowCount * (nodeHeight + Y_GAP);
    }
    for (const [generation, ids] of generations) {
      for (let rowStart = 0; rowStart < ids.length; rowStart += MAX_COLUMNS) {
        const row = ids.slice(rowStart, rowStart + MAX_COLUMNS);
        const rowOffset = ((MAX_COLUMNS - row.length) * (nodeWidth + X_GAP)) / 2;
        row.forEach((personId, column) => {
          const descendants = descendantIdsByPerson.get(personId) ?? new Set<string>();
          const branchFamilies = (familiesByPartner.get(personId) ?? []).filter((family) => family.children.length > 0);
          const branchFamilyIds = branchFamilies.map((family) => family.id);
          nodes.push({
            personId,
            x: rowOffset + column * (nodeWidth + X_GAP),
            y: (yByGeneration.get(generation) ?? 0) + Math.floor(rowStart / MAX_COLUMNS) * (nodeHeight + Y_GAP),
            h: nodeHeight,
            generation,
            hasDescendants: false,
            descendantCount: descendants.size,
            collapsed: branchFamilyIds.length > 0 && branchFamilyIds.every((familyId) => collapsed.has(familyId)),
            atDepthLimit: false,
            branchFamilyIds,
            hasAncestors: (familiesByChild.get(personId)?.length ?? 0) > 0,
            atAncestorDepthLimit:
              generation < 0 && generation * -1 >= maxDepth &&
              !userExpandedAncestors.has(personId) &&
              (familiesByChild.get(personId)?.length ?? 0) > 0,
            hasHiddenParents: false,
            hiddenAncestorCount: countHiddenAncestors(personId),
            isFocus: personId === rootId,
          });
        });
      }
    }
  }
  const nodeById = new Map(nodes.map((n) => [n.personId, n]));
  const edges: LayoutEdge[] = [];
  for (const f of tree.families) {
    if (!includedFamilies.has(f.id)) continue;
    const [a, b] = f.partners;
    if (a && b && nodeById.has(a) && nodeById.has(b)) edges.push({ from: a, to: b, kind: "partner" });
    const anchor = (a && nodeById.has(a) ? a : b) as string | undefined;
    for (const c of f.children) {
      if (anchor && nodeById.has(c)) edges.push({ from: anchor, to: c, kind: "parent" });
    }
  }
  // Placeholder cards above each cut ancestor line: regular rows sit one
  // card-height up; the fan pushes them one ring outward on the same ray.
  const placeholders: LayoutNode[] = [];
  const phW = view === "fan" ? nodeWidth : NODE_W;
  const phH = view === "fan" ? 40 : PH_H;
  for (const n of nodes) {
    if (n.hiddenAncestorCount <= 0) continue;
    let x: number;
    let y: number;
    if (view === "fan") {
      const acx = n.x + nodeWidth / 2;
      const acy = n.y + nodeHeight / 2;
      const dx = acx - fanCX;
      const dy = acy - fanCY;
      const outward = dx === 0 && dy === 0 ? -Math.PI / 2 : Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy) + fanStep;
      x = fanCX + r * Math.cos(outward) - phW / 2;
      y = fanCY + r * Math.sin(outward) - phH / 2;
    } else {
      x = n.x + NODE_W / 2 - phW / 2;
      y = n.y - PH_H + PH_TAB;
    }
    placeholders.push(placeholderNode({
      direction: "above",
      anchorId: n.personId,
      x,
      y,
      h: phH,
      generation: n.generation - 0.5,
      label: firstHiddenAncestorName(n.personId),
      hiddenDescendants: 0,
      hiddenAncestors: n.hiddenAncestorCount,
    }));
  }
  const allCards = [...nodes, ...placeholders];
  shiftAboveCanvas(allCards);
  nodes.push(...placeholders);
  for (const p of placeholders) width = Math.max(width, p.x + phW);
  for (const node of nodes) {
    height = Math.max(height, node.y + (node.h ?? nodeHeight));
  }
  const siblingIds = new Set<string>();
  for (const family of familiesByChild.get(rootId) ?? []) {
    for (const child of family.children) if (child !== rootId) siblingIds.add(child);
  }
  return {
    nodes,
    edges,
    buses: buildBuses(nodes, tree.families, includedFamilies),
    width,
    height,
    siblingCount: siblingIds.size,
    showSiblings: false,
    truncatedCount: truncatedPeople.size,
    nodeWidth,
    nodeHeight,
    view,
  };
}
