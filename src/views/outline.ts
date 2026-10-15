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
  const base = (id: string): Omit<OutlineNode, "parents" | "children"> => ({
    id,
    name: nameOf(id),
    hiddenAncestors: hiddenAncestorsOf(id),
    hiddenDescendants: countHiddenBelow(id),
  });
  // One builder walks up for ancestors, down for descendants, or both from
  // the focus. The side decides which half stays empty.
  const listFrom = (ids: string[], seen: Set<string>, side: "up" | "down"): OutlineNode[] =>
    ids.filter((cid) => placed.has(cid) && !seen.has(cid)).map((cid) => {
      seen.add(cid);
      return one(cid, seen, side);
    });
  const one = (id: string, seen: Set<string>, side: "up" | "down"): OutlineNode => ({
    ...base(id),
    parents: side === "down" ? [] : listFrom(parentsOf.get(id) ?? [], seen, "up"),
    children: side === "up" ? [] : listFrom(kidsOf.get(id) ?? [], seen, "down"),
  });
  return {
    root: rootId,
    tree: {
      ...base(rootId),
      parents: listFrom(parentsOf.get(rootId) ?? [], new Set([rootId]), "up"),
      children: listFrom(kidsOf.get(rootId) ?? [], new Set([rootId]), "down"),
    },
  };
}
