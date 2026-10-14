import type { Tree } from "../domain/types";
import { preferredName } from "../domain/tree";
import type { FamilyLayout } from "./family";

export interface OutlineNode {
  id: string;
  name: string;
  hiddenAncestors: number;
  hiddenDescendants: number;
  parents: OutlineNode[];
  children: OutlineNode[];
}

export interface Outline {
  root: string;
  tree: OutlineNode | null;
}

/** Build the outline of the focused branch from one layout run. */
export function outlineFromLayout(tree: Tree, layout: FamilyLayout, rootId: string): Outline {
  const personOf = new Map(tree.persons.map((p) => [p.id, p]));
  const placed = new Set<string>();
  const nodeOf = new Map<string, { hiddenAncestorCount: number }>();
  for (const n of layout.nodes) {
    if (n.kind === "placeholder") continue;
    placed.add(n.personId);
    nodeOf.set(n.personId, n);
  }
  const kidsOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const famsOfPartner = new Map<string, Tree["families"]>();
  const push = <V>(map: Map<string, V[]>, key: string, value: V): void => {
    const list = map.get(key) ?? [];
    if (!list.includes(value)) list.push(value);
    map.set(key, list);
  };
  for (const f of tree.families) {
    for (const partner of f.partners) {
      push(famsOfPartner, partner, f);
      for (const child of f.children) push(kidsOf, partner, child);
    }
    for (const child of f.children) {
      for (const partner of f.partners) push(parentsOf, child, partner);
    }
  }
  const nameOf = (id: string): string => preferredName(personOf.get(id)!) || "(no name)";
  // Count unplaced people under this person: only walks down through
  // unplaced people, so every branch carries its own cut, not its parents'.
  const countHiddenBelow = (id: string): number => {
    const seen = new Set<string>([id]);
    const stack = (kidsOf.get(id) ?? []).filter((c) => !placed.has(c));
    for (const s of stack) seen.add(s);
    let count = 0;
    while (stack.length > 0) {
      const pid = stack.pop()!;
      count++;
      for (const f of famsOfPartner.get(pid) ?? []) {
        for (const q of [...f.partners, ...f.children]) {
          if (q === id || seen.has(q) || placed.has(q)) continue;
          seen.add(q);
          stack.push(q);
        }
      }
    }
    return count;
  };
  const hiddenAncestorsOf = (id: string): number => nodeOf.get(id)?.hiddenAncestorCount ?? 0;
  const up = (id: string, seen: Set<string>): OutlineNode => ({
    id,
    name: nameOf(id),
    hiddenAncestors: hiddenAncestorsOf(id),
    hiddenDescendants: countHiddenBelow(id),
    parents: (parentsOf.get(id) ?? [])
      .filter((pid) => placed.has(pid) && !seen.has(pid))
      .map((pid) => {
        seen.add(pid);
        return up(pid, seen);
      }),
    children: [],
  });
  const down = (id: string, seen: Set<string>): OutlineNode => ({
    id,
    name: nameOf(id),
    hiddenAncestors: hiddenAncestorsOf(id),
    hiddenDescendants: countHiddenBelow(id),
    parents: [],
    children: (kidsOf.get(id) ?? [])
      .filter((cid) => placed.has(cid) && !seen.has(cid))
      .map((cid) => {
        seen.add(cid);
        return down(cid, seen);
      }),
  });
  const focusSeenUp = new Set<string>([rootId]);
  const focusSeenDown = new Set<string>([rootId]);
  return {
    root: rootId,
    tree: {
      id: rootId,
      name: nameOf(rootId),
      hiddenAncestors: hiddenAncestorsOf(rootId),
      hiddenDescendants: countHiddenBelow(rootId),
      parents: (parentsOf.get(rootId) ?? [])
        .filter((pid) => placed.has(pid) && !focusSeenUp.has(pid))
        .map((pid) => {
          focusSeenUp.add(pid);
          return up(pid, focusSeenUp);
        }),
      children: (kidsOf.get(rootId) ?? [])
        .filter((cid) => placed.has(cid) && !focusSeenDown.has(cid))
        .map((cid) => {
          focusSeenDown.add(cid);
          return down(cid, focusSeenDown);
        }),
    },
  };
}
