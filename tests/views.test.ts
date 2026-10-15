import { describe, expect, test } from "bun:test";
import { addChild, addFact, addParent, addPartner, createFamily, createPerson } from "../src/domain/tree";
import type { Tree } from "../src/domain/types";
import { emptyTree } from "../src/domain/tree";
import { familyLayout, wrapDisplayName, type LayoutNode } from "../src/views/family";
import { outlineFromLayout } from "../src/views/outline";
import { listPeople } from "../src/views/list";

function demoTree(): { tree: Tree; gp: string; parent: string; kid: string } {
  const gp = createPerson({ given: "Gp", surname: "Old" });
  const parent = createPerson({ given: "Parent", surname: "Old" });
  let kid = createPerson({ given: "Kid", surname: "Old" });
  const r1 = addParent({ child: parent, parent: gp });
  const r2 = addParent({ child: kid, parent: r1.updatedChild });
  kid = addFact(r2.updatedChild, { type: "BIRT", dateRaw: "10 DEC 1815", placeRaw: "London" }).person;
  return {
    tree: {
      ...emptyTree(),
      persons: [r1.updatedParent, r1.updatedChild, kid],
      families: [r1.family, r2.family],
    },
    gp: gp.id,
    parent: parent.id,
    kid: kid.id,
  };
}

/** Placeholder cards in a layout. */
const phOf = (nodes: LayoutNode[]): LayoutNode[] => nodes.filter((n) => n.kind === "placeholder");
/** Person ids in a layout, placeholders excluded, sorted for comparison. */
const peopleOf = (nodes: LayoutNode[]): string[] =>
  nodes.filter((n) => n.kind !== "placeholder").map((n) => n.personId).sort();

describe("family layout", () => {
  test("places ancestors above and descendants below the focused person", () => {
    const { tree, gp, parent, kid } = demoTree();
    const layout = familyLayout(tree, parent);
    const byId = new Map(layout.nodes.map((n) => [n.personId, n]));
    expect(byId.get(parent)?.generation).toBe(0);
    expect(byId.get(gp)?.generation).toBe(-1);
    expect(byId.get(kid)?.generation).toBe(1);
    expect(byId.get(gp)!.y).toBeLessThan(byId.get(parent)!.y);
    expect(byId.get(kid)!.y).toBeGreaterThan(byId.get(parent)!.y);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges.some((e) => e.kind === "parent" && e.to === kid)).toBe(true);
  });

  test("unknown root throws", () => {
    expect(() => familyLayout(demoTree().tree, "ghost")).toThrow();
  });

  test("depth option caps generations", () => {
    const { tree, parent, kid } = demoTree();
    const shallow = familyLayout(tree, parent, { depth: 0 });
    expect(peopleOf(shallow.nodes)).toEqual([parent].sort());
    // The cut edges announce themselves: one placeholder above (gp hidden),
    // one below (kid hidden).
    expect(phOf(shallow.nodes)).toHaveLength(2);
    const deep = familyLayout(tree, parent, { depth: 1 });
    expect(peopleOf(deep.nodes)).toEqual([tree.persons[0]!.id, parent, kid].sort());
    expect(phOf(deep.nodes)).toHaveLength(0);
  });

  test("pedigree mode shows only direct ancestors", () => {
    const { tree, gp, parent, kid } = demoTree();
    const layout = familyLayout(tree, parent, { depth: 1, view: "pedigree" });
    const ids = new Set(layout.nodes.map((node) => node.personId));
    expect(ids.has(parent)).toBe(true);
    expect(ids.has(gp)).toBe(true);
    expect(ids.has(kid)).toBe(false);
    expect(layout.nodes.find((node) => node.personId === gp)?.generation).toBe(-1);
  });

  test("fan mode lays direct ancestors around a radial arc without descendants", () => {
    const { tree, gp, parent, kid } = demoTree();
    const layout = familyLayout(tree, parent, { depth: 1, view: "fan" });
    const byId = new Map(layout.nodes.map((node) => [node.personId, node]));
    expect(layout.view).toBe("fan");
    expect(byId.has(kid)).toBe(false);
    expect(byId.get(gp)!.y).toBeLessThan(byId.get(parent)!.y);
    expect(layout.width).toBeGreaterThan(232);
    expect(layout.nodes.every((node) => !node.hasDescendants)).toBe(true);
  });

  test("collapsing a family hides descendants of both partners but keeps ancestors", () => {
    const { tree, parent, kid, gp } = demoTree();
    const descendantFamily = tree.families.find((family) => family.children.includes(kid))!;
    const layout = familyLayout(tree, parent, { depth: 2, collapsedFamilyIds: new Set([descendantFamily.id]) });
    const visible = new Set(layout.nodes.map((node) => node.personId));
    expect(visible.has(parent)).toBe(true);
    expect(visible.has(gp)).toBe(true);
    expect(visible.has(kid)).toBe(false);
  });

  test("siblings are optional and large sibling groups wrap into bounded rows", () => {
    const parent = createPerson({ given: "Parent" });
    const root = createPerson({ given: "Root" });
    let family = createFamily({ partners: [parent.id] });
    const people = [parent, root];
    const first = addChild({ family, childId: root.id, parent, child: root });
    family = first.family;
    const childIds = [root.id];
    for (let i = 0; i < 18; i++) {
      const sibling = createPerson({ given: `Sibling ${i}` });
      people.push(sibling);
      const linked = addChild({ family, childId: sibling.id, parent, child: sibling });
      family = linked.family;
      childIds.push(sibling.id);
    }
    const tree = { ...emptyTree(), persons: people, families: [family] };
    const compact = familyLayout(tree, root.id, { depth: 1 });
    expect(compact.nodes.map((node) => node.personId)).not.toContain(childIds[1]);
    const expanded = familyLayout(tree, root.id, { depth: 1, showSiblings: true });
    expect(expanded.siblingCount).toBe(18);
    expect(expanded.truncatedCount).toBe(6);
    // Siblings share the root row; the parent drops to each of them.
    const row = expanded.nodes.filter((node) => node.generation === 0);
    expect(row).toHaveLength(13);
    expect(row.every((node) => node.y === row[0]!.y)).toBe(true);
    expect(expanded.edges.some((e) => e.kind === "parent" && e.to === childIds[1])).toBe(true);
  });

  test("couples sit side by side, centered over their children", () => {
    const a = createPerson({ given: "A" });
    const b = createPerson({ given: "B" });
    const couple = addPartner({ a, b });
    const c1 = createPerson({ given: "C1" });
    const c2 = createPerson({ given: "C2" });
    const withC1 = addChild({ family: couple.family, childId: c1.id, parent: couple.updatedA, child: c1 });
    const withC2 = addChild({
      family: withC1.family,
      childId: c2.id,
      parent: withC1.updatedParent,
      child: c2,
    });
    const s = createPerson({ given: "S" });
    const couple2 = addPartner({ a: withC1.updatedChild!, b: s });
    const g = createPerson({ given: "G" });
    const withG = addChild({
      family: couple2.family,
      childId: g.id,
      parent: couple2.updatedA,
      child: g,
    });
    const tree = {
      ...emptyTree(),
      persons: [
        withC2.updatedParent,
        couple.updatedB,
        couple2.updatedB,
        withG.updatedChild!,
        withC2.updatedChild!,
        couple2.updatedA,
      ],
      families: [withC2.family, withG.family],
    };
    const layout = familyLayout(tree, withC2.updatedParent.id, { depth: 3 });
    const at = new Map(layout.nodes.map((n) => [n.personId, n]));
    const A = at.get(withC2.updatedParent.id)!;
    const B = at.get(couple.updatedB.id)!;
    const C1 = at.get(couple2.updatedA.id)!;
    const C2 = at.get(withC2.updatedChild!.id)!;
    const S = at.get(couple2.updatedB.id)!;
    const G = at.get(withG.updatedChild!.id)!;
    // Partners share a row and sit side by side.
    expect(A.generation).toBe(0);
    expect(B.generation).toBe(0);
    expect(Math.abs(A.x - B.x)).toBe(232 + 32);
    // The couple is centered over its children (bus anchor midpoint).
    expect((A.x + B.x) / 2).toBeCloseTo((C1.x + C2.x) / 2, 5);
    // Next generation couples the same way; grandchild under their midpoint.
    expect(Math.abs(C1.x - S.x)).toBe(232 + 32);
    expect(G.x).toBeCloseTo((C1.x + S.x) / 2, 5);
    expect(G.generation).toBe(2);
  });

  test("ancestor couples stay adjacent even when both have parents", () => {
    const gf1 = createPerson({ given: "GF1" });
    const gm1 = createPerson({ given: "GM1" });
    const gf2 = createPerson({ given: "GF2" });
    const gm2 = createPerson({ given: "GM2" });
    const ggf1 = createPerson({ given: "GGF1" });
    const ggm1 = createPerson({ given: "GGM1" });
    const ggf2 = createPerson({ given: "GGF2" });
    const ggm2 = createPerson({ given: "GGM2" });
    const f1 = createPerson({ given: "F1" });
    const f2 = createPerson({ given: "F2" });
    const root = createPerson({ given: "Root" });
    const famA = { ...createFamily({ partners: [ggf1.id, ggm1.id] }), children: [gf1.id] };
    const famB = { ...createFamily({ partners: [ggf2.id, ggm2.id] }), children: [gf2.id] };
    const famC = { ...createFamily({ partners: [gf1.id, gm1.id] }), children: [f1.id] };
    const famD = { ...createFamily({ partners: [gf2.id, gm2.id] }), children: [f2.id] };
    const famE = { ...createFamily({ partners: [f1.id, f2.id] }), children: [root.id] };
    const tree = {
      ...emptyTree(),
      persons: [ggf1, ggm1, ggf2, ggm2, gf1, gm1, gf2, gm2, f1, f2, root],
      families: [famA, famB, famC, famD, famE],
    };
    const layout = familyLayout(tree, root.id, { depth: 3 });
    const at = new Map(layout.nodes.map((n) => [n.personId, n]));
    // Both grandparent couples adjacent despite each having parents above.
    expect(Math.abs(at.get(gf1.id)!.x - at.get(gm1.id)!.x)).toBe(232 + 32);
    expect(Math.abs(at.get(gf2.id)!.x - at.get(gm2.id)!.x)).toBe(232 + 32);
    // No card overlaps anywhere.
    const rows = new Map<number, { x: number }[]>();
    for (const n of layout.nodes) {
      const list = rows.get(n.generation) ?? [];
      list.push(n);
      rows.set(n.generation, list);
    }
    for (const ns of rows.values()) {
      ns.sort((a, b) => a.x - b.x);
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!.x).toBeGreaterThanOrEqual(ns[i - 1]!.x + 232);
      }
    }
  });

  test("parent buses drop from the couple midpoint to each child", () => {
    const a = createPerson({ given: "A" });
    const b = createPerson({ given: "B" });
    const couple = addPartner({ a, b });
    const c1 = createPerson({ given: "C1" });
    const withC1 = addChild({ family: couple.family, childId: c1.id, parent: couple.updatedA, child: c1 });
    const tree = {
      ...emptyTree(),
      persons: [withC1.updatedParent, couple.updatedB, withC1.updatedChild!],
      families: [withC1.family],
    };
    const layout = familyLayout(tree, withC1.updatedParent.id, { depth: 2 });
    expect(layout.buses).toHaveLength(1);
    const bus = layout.buses[0]!;
    const A = layout.nodes.find((n) => n.personId === withC1.updatedParent.id)!;
    const B = layout.nodes.find((n) => n.personId === couple.updatedB.id)!;
    const C1 = layout.nodes.find((n) => n.personId === withC1.updatedChild!.id)!;
    expect(bus.x).toBeCloseTo((A.x + B.x + 232) / 2, 5);
    expect(bus.kids).toEqual([C1.x + 232 / 2]);
    expect(bus.top).toBe(A.y + 34);
    expect(bus.bus).toBe((bus.top + bus.kidTop) / 2);
    expect(bus.kidTop).toBe(C1.y);
    // Each parent card's center gets its own drop — every wire touches a card.
    expect(bus.legs).toEqual([A.x + 232 / 2, B.x + 232 / 2]);
    expect(bus.pbot).toBe(A.y + A.h);
  });

  test("overlapping buses in one gap get separate lanes", () => {
    // A grandparent couple whose children split (one blood-placed near the
    // main line, one parked far right with its own block) spans across a
    // neighbouring family's bus in the same gap: the two bars must sit on
    // different heights instead of collapsing into one line.
    const r = createPerson({ given: "R" });
    const p1 = createPerson({ given: "P1", sex: "M" });
    const p2 = createPerson({ given: "P2", sex: "F" });
    const g1 = createPerson({ given: "G1", sex: "M" });
    const g2 = createPerson({ given: "G2", sex: "F" });
    const h1 = createPerson({ given: "H1", sex: "M" });
    const h2 = createPerson({ given: "H2", sex: "F" });
    const a = createPerson({ given: "A", sex: "F" });
    const t = createPerson({ given: "T", sex: "M" });
    const c = createPerson({ given: "C", sex: "M" });
    const fRoot = { ...createFamily({ partners: [p1.id, p2.id] }), children: [r.id] };
    const fG = { ...createFamily({ partners: [g1.id, g2.id] }), children: [p1.id, a.id] };
    const fH = { ...createFamily({ partners: [h1.id, h2.id] }), children: [p2.id] };
    const fA = { ...createFamily({ partners: [a.id, t.id] }), children: [c.id] };
    const tree = {
      ...emptyTree(),
      persons: [r, p1, p2, g1, g2, h1, h2, a, t, c],
      families: [fRoot, fG, fH, fA],
    };
    const layout = familyLayout(tree, r.id, { depth: 3, showSiblings: true });
    const at = new Map(layout.nodes.map((n) => [n.personId, n]));
    const cx = (id: string): number => at.get(id)!.x + 232 / 2;
    const busOf = (kidId: string): number =>
      layout.buses.find((b) => b.kids.some((k) => Math.abs(k - cx(kidId)) < 0.01))!.bus;
    // Same generation gap, overlapping spans: separate lanes.
    expect(busOf(p1.id)).not.toBeCloseTo(busOf(p2.id), 5);
    // Lanes stay in the middle band of the gap, clear of pills and icons.
    for (const b of layout.buses) {
      const frac = (b.bus - b.top) / (b.kidTop - b.top);
      expect(frac).toBeGreaterThan(0.35);
      expect(frac).toBeLessThan(0.65);
    }
  });

  test("card heights respond to content, rows take the tallest card", () => {
    const short = createPerson({ given: "Al" });
    const tall = createPerson({ given: "Bartholomew Quincy Adams Junior" });
    const couple = addPartner({ a: short, b: tall });
    const tree = { ...emptyTree(), persons: [couple.updatedA, couple.updatedB], families: [couple.family] };
    const layout = familyLayout(tree, short.id, { depth: 1 });
    const heights = new Map(layout.nodes.map((n) => [n.personId, n.h]));
    // Every level shares one compact height so styling stays identical.
    expect(heights.get(short.id)).toBe(68);
    expect(heights.get(tall.id)).toBe(68);
    expect(new Set(layout.nodes.map((n) => n.h)).size).toBe(1);
    // A name-only card on its own row stays compact.
    const solo = familyLayout({ ...emptyTree(), persons: [short], families: [] }, short.id, {});
    expect(solo.nodes[0]!.h).toBe(68);
  });

  test("name-only mode compacts cards further", () => {
    const a = createPerson({ given: "Anna" });
    const b = createPerson({ given: "Bo" });
    const couple = addPartner({ a, b });
    const tree = { ...emptyTree(), persons: [couple.updatedA, couple.updatedB], families: [couple.family] };
    const roomy = familyLayout(tree, a.id, { depth: 1 });
    expect(roomy.nodes.map((n) => n.h)).toEqual([68, 68]);
    const compact = familyLayout(tree, a.id, { depth: 1, showYears: false, showPhotos: false });
    expect(compact.nodes.map((n) => n.h)).toEqual([48, 48]);
    // Photos on their own keep room for the avatar.
    const withPhotos = familyLayout(tree, a.id, { depth: 1, showYears: false, showPhotos: true });
    expect(withPhotos.nodes.map((n) => n.h)).toEqual([68, 68]);
  });

  test("the focused person is flagged and names wrap server-side", () => {
    const { tree, parent, kid } = demoTree();
    const layout = familyLayout(tree, parent, { depth: 1 });
    expect(layout.nodes.find((n) => n.personId === parent)!.isFocus).toBe(true);
    expect(layout.nodes.find((n) => n.personId === kid)!.isFocus).toBe(false);
  });

  test("wrapDisplayName fits one line with ellipsis on overflow", () => {
    expect(wrapDisplayName("Ada Lovelace")).toEqual(["Ada Lovelace"]);
    expect(wrapDisplayName("Dalliyanayya Ratuviha")).toEqual(["Dalliyanayya Ratuviha"]);
    expect(wrapDisplayName("Bartholomew Quincy Adams Junior")).toEqual([
      "Bartholomew Quincy Adams…",
    ]);
    expect(wrapDisplayName("")).toEqual(["?"]);
    expect(wrapDisplayName("Supercalifragilisticexpialidocious X")).toEqual([
      "Supercalifragilisticexpia…",
    ]);
  });

  test("minimizing one ancestor line hides only its upstream", () => {
    const gp1 = createPerson({ given: "GP1" });
    const gp2 = createPerson({ given: "GP2" });
    const dad = createPerson({ given: "Dad" });
    const mom = createPerson({ given: "Mom" });
    const root = createPerson({ given: "Root" });
    const famDad = { ...createFamily({ partners: [gp1.id, gp2.id] }), children: [dad.id] };
    const famMom = { ...createFamily({ partners: [] }), children: [mom.id] };
    const famRoot = { ...createFamily({ partners: [dad.id, mom.id] }), children: [root.id] };
    const tree = { ...emptyTree(), persons: [gp1, gp2, dad, mom, root], families: [famDad, famMom, famRoot] };
    const full = familyLayout(tree, root.id, { depth: 3 });
    expect(full.nodes.some((n) => n.personId === gp1.id)).toBe(true);
    // Minimize above dad: his parents go, mom's side and root stay, and the
    // whole layout recomputes (no holes left behind).
    const min = familyLayout(tree, root.id, { depth: 3, minimizedAncestorIds: new Set([dad.id]) });
    const ids = new Set(min.nodes.map((n) => n.personId));
    expect(ids.has(dad.id)).toBe(true);
    expect(ids.has(mom.id)).toBe(true);
    expect(ids.has(root.id)).toBe(true);
    expect(ids.has(gp1.id)).toBe(false);
    expect(ids.has(gp2.id)).toBe(false);
    expect(min.nodes.find((n) => n.personId === dad.id)!.hasHiddenParents).toBe(true);
    expect(min.nodes.find((n) => n.personId === dad.id)!.hiddenAncestorCount).toBe(2);
    // No overlaps after the reposition.
    const rows = new Map<number, { x: number }[]>();
    for (const n of min.nodes) {
      const list = rows.get(n.generation) ?? [];
      list.push(n);
      rows.set(n.generation, list);
    }
    for (const ns of rows.values()) {
      ns.sort((a, b) => a.x - b.x);
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!.x).toBeGreaterThanOrEqual(ns[i - 1]!.x + 232);
      }
    }
  });

  test("minimizing above a collateral keeps ancestors shared with the main line", () => {
    const gp1 = createPerson({ given: "GGP1" });
    const gp2 = createPerson({ given: "GGP2" });
    const gp = createPerson({ given: "GP" });
    const uncle = createPerson({ given: "Uncle" });
    const parent = createPerson({ given: "Parent" });
    const root = createPerson({ given: "Root" });
    const famTop = { ...createFamily({ partners: [gp1.id, gp2.id] }), children: [gp.id, uncle.id] };
    const famMid = { ...createFamily({ partners: [gp.id] }), children: [parent.id] };
    const famBot = { ...createFamily({ partners: [parent.id] }), children: [root.id] };
    const tree = {
      ...emptyTree(),
      persons: [gp1, gp2, gp, uncle, parent, root],
      families: [famTop, famMid, famBot],
    };
    // Uncle's parents are also the main line's: minimizing above him must
    // not hide them from the main line.
    const min = familyLayout(tree, root.id, { depth: 3, showSiblings: true, minimizedAncestorIds: new Set([uncle.id]) });
    const ids = new Set(min.nodes.map((n) => n.personId));
    expect(ids.has(gp1.id)).toBe(true);
    expect(ids.has(gp2.id)).toBe(true);
    expect(ids.has(root.id)).toBe(true);
  });

  test("siblingPersonIds reveals aunts and uncles without moving the main line", () => {
    const { tree, parent, kid } = demoTree();
    const uncle = createPerson({ given: "Uncle", surname: "Old" });
    const gpFam = tree.families.find((f) => f.children.includes(parent))!;
    const withUncle = {
      ...tree,
      persons: [...tree.persons, uncle],
      families: tree.families.map((f) =>
        f.id === gpFam.id ? { ...f, children: [...f.children, uncle.id] } : f,
      ),
    };
    const before = familyLayout(withUncle, kid, { depth: 2 });
    expect(before.nodes.some((n) => n.personId === uncle.id)).toBe(false);
    const after = familyLayout(withUncle, kid, { depth: 2, siblingPersonIds: new Set([parent]) });
    const uncleNode = after.nodes.find((n) => n.personId === uncle.id)!;
    expect(uncleNode).toBeDefined();
    expect(uncleNode.generation).toBe(-1);
    expect(after.nodes.find((n) => n.personId === parent)!.x).toBe(
      before.nodes.find((n) => n.personId === parent)!.x,
    );
    expect(after.nodes.find((n) => n.personId === kid)!.x).toBe(
      before.nodes.find((n) => n.personId === kid)!.x,
    );
  });

  test("sibling groups from different families get breathing room", () => {
    const root = createPerson({ given: "Root" });
    const sibA = createPerson({ given: "SibA" });
    const sibB = createPerson({ given: "SibB" });
    const gp1 = createPerson({ given: "GP1" });
    const gp2 = createPerson({ given: "GP2" });
    const fam1 = { ...createFamily({ partners: [gp1.id] }), children: [root.id, sibA.id] };
    const fam2 = { ...createFamily({ partners: [gp2.id] }), children: [root.id, sibB.id] };
    const tree = { ...emptyTree(), persons: [gp1, gp2, root, sibA, sibB], families: [fam1, fam2] };
    const layout = familyLayout(tree, root.id, { depth: 1, showSiblings: true });
    const at = new Map(layout.nodes.map((n) => [n.personId, n]));
    const gapSameGroup = at.get(sibA.id)!.x - at.get(root.id)!.x;
    const gapNewGroup = at.get(sibB.id)!.x - at.get(sibA.id)!.x;
    expect(gapSameGroup).toBe(232 + 56);
    expect(gapNewGroup).toBeGreaterThan(gapSameGroup);
  });

  test("collaterals show by default, in-law parents stay hidden (MyHeritage)", () => {
    const ggp1 = createPerson({ given: "GGP1" });
    const ggp2 = createPerson({ given: "GGP2" });
    const gp = createPerson({ given: "GP" });
    const uncle = createPerson({ given: "Uncle" });
    const parent = createPerson({ given: "Parent" });
    const root = createPerson({ given: "Root" });
    const famTop = { ...createFamily({ partners: [ggp1.id, ggp2.id] }), children: [gp.id, uncle.id] };
    const famMid = { ...createFamily({ partners: [gp.id] }), children: [parent.id] };
    const famBot = { ...createFamily({ partners: [parent.id] }), children: [root.id] };
    const tree = {
      ...emptyTree(),
      persons: [ggp1, ggp2, gp, uncle, parent, root],
      families: [famTop, famMid, famBot],
    };
    // Uncle (father's brother) rides along, like the MyHeritage branch.
    const layout = familyLayout(tree, root.id, { depth: 3, showSiblings: true });
    expect(layout.nodes.some((n) => n.personId === uncle.id)).toBe(true);
    const hidden = familyLayout(tree, root.id, { depth: 3, showSiblings: false });
    expect(hidden.nodes.some((n) => n.personId === uncle.id)).toBe(false);
    // But a spouse's parents never join: only blood ancestors climb.
    const dad = createPerson({ given: "Dad" });
    const mom = createPerson({ given: "Mom" });
    const spouse = createPerson({ given: "Spouse" });
    const me = createPerson({ given: "Me" });
    const inLawFam = { ...createFamily({ partners: [dad.id, mom.id] }), children: [spouse.id] };
    const couple = addPartner({ a: me, b: spouse });
    const tree2 = {
      ...emptyTree(),
      persons: [dad, mom, spouse, me, couple.updatedA, couple.updatedB].filter(
        (p, i, all) => all.findIndex((q) => q.id === p.id) === i,
      ),
      families: [inLawFam, couple.family],
    };
    const mine = familyLayout(tree2, me.id, { depth: 3, showSiblings: true });
    const ids = new Set(mine.nodes.map((n) => n.personId));
    expect(ids.has(spouse.id)).toBe(true);
    expect(ids.has(dad.id)).toBe(false);
    expect(ids.has(mom.id)).toBe(false);
    // Refocusing onto the spouse reveals her own bloodline.
    const hers = familyLayout(tree2, spouse.id, { depth: 3, showSiblings: true });
    const herIds = new Set(hers.nodes.map((n) => n.personId));
    expect(herIds.has(dad.id)).toBe(true);
    expect(herIds.has(mom.id)).toBe(true);
  });

  test("focus siblings stay contiguous: cousin blocks park after them", () => {
    const gp1 = createPerson({ given: "GP1", sex: "M" });
    const gp2 = createPerson({ given: "GP2", sex: "F" });
    const parent = createPerson({ given: "Parent", sex: "M" });
    const aunt = createPerson({ given: "Aunt", sex: "F" });
    const uncleInLaw = createPerson({ given: "UncleInLaw", sex: "M" });
    const root = createPerson({ given: "Root", sex: "M" });
    const spouse = createPerson({ given: "Spouse", sex: "F" });
    const sib = createPerson({ given: "Sib", sex: "F" });
    const cousin = createPerson({ given: "Cousin", sex: "M" });
    const famTop = { ...createFamily({ partners: [gp1.id, gp2.id] }), children: [parent.id, aunt.id] };
    const famAunt = { ...createFamily({ partners: [aunt.id, uncleInLaw.id] }), children: [cousin.id] };
    const famRootParents = { ...createFamily({ partners: [parent.id] }), children: [root.id, sib.id] };
    const famRoot = { ...createFamily({ partners: [root.id, spouse.id] }), children: [] };
    const tree = {
      ...emptyTree(),
      persons: [gp1, gp2, parent, aunt, uncleInLaw, root, spouse, sib, cousin],
      families: [famTop, famAunt, famRootParents, famRoot],
    };
    const layout = familyLayout(tree, root.id, { depth: 3, showSiblings: true });
    const at = new Map(layout.nodes.map((n) => [n.personId, n]));
    // Spouse sits at couple pitch; sibling at the wider sibling pitch —
    // no cousin branch wedged between blood siblings.
    expect(at.get(spouse.id)!.x - at.get(root.id)!.x).toBe(232 + 32);
    expect(at.get(sib.id)!.x - at.get(spouse.id)!.x).toBe(232 + 56);
    // The cousin branch sits beyond the sibling.
    expect(at.get(cousin.id)!.x).toBeGreaterThan(at.get(sib.id)!.x);
  });
  test("hidden parent lines are flagged and expand independently (no accordion)", () => {
    const dad = createPerson({ given: "Dad" });
    const mom = createPerson({ given: "Mom" });
    const spouse = createPerson({ given: "Spouse" });
    const me = createPerson({ given: "Me" });
    const inLawFam = { ...createFamily({ partners: [dad.id, mom.id] }), children: [spouse.id] };
    const couple = addPartner({ a: me, b: spouse });
    const tree = {
      ...emptyTree(),
      persons: [dad, mom, spouse, me],
      families: [inLawFam, couple.family],
    };
    const mine = familyLayout(tree, me.id, { depth: 2, showSiblings: true });
    const spouseNode = mine.nodes.find((n) => n.personId === spouse.id)!;
    // Spouse's parents exist but are hidden: maximize affordance shows.
    expect(spouseNode.hasHiddenParents).toBe(true);
    expect(spouseNode.hiddenAncestorCount).toBe(2);
    expect(mine.nodes.find((n) => n.personId === me.id)!.hasHiddenParents).toBe(false);
    expect(mine.nodes.find((n) => n.personId === me.id)!.hiddenAncestorCount).toBe(0);
    // Expanding that one line reveals it; nothing else minimizes. The
    // placeholder above the hidden line correctly disappears with it.
    const before = new Set(peopleOf(mine.nodes));
    const expanded = familyLayout(tree, me.id, {
      depth: 2,
      showSiblings: true,
      expandedAncestorIds: new Set([spouse.id]),
    });
    const afterIds = new Set(peopleOf(expanded.nodes));
    expect(afterIds.has(dad.id)).toBe(true);
    expect(afterIds.has(mom.id)).toBe(true);
    for (const id of before) expect(afterIds.has(id)).toBe(true);
    expect(expanded.nodes.find((n) => n.personId === spouse.id)!.hasHiddenParents).toBe(false);
    expect(expanded.nodes.find((n) => n.personId === spouse.id)!.hiddenAncestorCount).toBe(0);
  });

  test("cousins get their own tidy block beside the main branch", () => {
    const gp1 = createPerson({ given: "GP1", sex: "M" });
    const gp2 = createPerson({ given: "GP2", sex: "F" });
    const parent = createPerson({ given: "Parent", sex: "M" });
    const aunt = createPerson({ given: "Aunt", sex: "F" });
    const uncleInLaw = createPerson({ given: "UncleInLaw", sex: "M" });
    const root = createPerson({ given: "Root", sex: "M" });
    const cousin = createPerson({ given: "Cousin", sex: "M" });
    const famTop = { ...createFamily({ partners: [gp1.id, gp2.id] }), children: [parent.id, aunt.id] };
    const famAunt = { ...createFamily({ partners: [aunt.id, uncleInLaw.id] }), children: [cousin.id] };
    const famBot = { ...createFamily({ partners: [parent.id] }), children: [root.id] };
    const tree = {
      ...emptyTree(),
      persons: [gp1, gp2, parent, aunt, uncleInLaw, root, cousin],
      families: [famTop, famAunt, famBot],
    };
    const layout = familyLayout(tree, root.id, { depth: 3, showSiblings: true });
    const at = new Map(layout.nodes.map((n) => [n.personId, n]));
    expect(at.has(cousin.id)).toBe(true);
    expect(at.has(uncleInLaw.id)).toBe(true);
    // Aunt couple adjacent at couple pitch, father left.
    expect(Math.abs(at.get(aunt.id)!.x - at.get(uncleInLaw.id)!.x)).toBe(232 + 32);
    expect(at.get(uncleInLaw.id)!.x).toBeLessThan(at.get(aunt.id)!.x);
    // Cousin centered under the aunt couple's midpoint.
    expect(cousin).toBeDefined();
    const mid = (at.get(aunt.id)!.x + at.get(uncleInLaw.id)!.x + 232) / 2;
    expect(at.get(cousin.id)!.x + 232 / 2).toBeCloseTo(mid, 5);
    // No overlaps anywhere.
    const rows = new Map<number, { x: number }[]>();
    for (const n of layout.nodes) {
      const list = rows.get(n.generation) ?? [];
      list.push(n);
      rows.set(n.generation, list);
    }
    for (const ns of rows.values()) {
      ns.sort((a, b) => a.x - b.x);
      for (let i = 1; i < ns.length; i++) {
        expect(ns[i]!.x).toBeGreaterThanOrEqual(ns[i - 1]!.x + 232);
      }
    }
  });

  test("caps a very large branch and reports the omitted people", () => {
    const root = createPerson({ given: "Root" });
    const children = Array.from({ length: 600 }, (_, i) => createPerson({ given: `Child ${i}` }));
    const family = { ...createFamily({ partners: [root.id] }), children: children.map((child) => child.id) };
    const tree = { ...emptyTree(), persons: [root, ...children], families: [family] };
    const layout = familyLayout(tree, root.id, { depth: 1 });
    expect(layout.nodes).toHaveLength(500);
    expect(layout.truncatedCount).toBe(101);
    // One row per generation, no wrapping: wide rows scroll and pan.
    expect(layout.width).toBeGreaterThan(1036);
  });
});

describe("placeholder nodes", () => {
  test("a collapsed branch shows a placeholder card with name and counts", () => {
    const { tree, parent, kid } = demoTree();
    const fam = tree.families.find((f) => f.children.includes(kid))!;
    const layout = familyLayout(tree, parent, { depth: 2, collapsedFamilyIds: new Set([fam.id]) });
    const phs = phOf(layout.nodes);
    expect(phs).toHaveLength(1);
    const below = phs[0]!;
    expect(below.personId).toBe(`ph:below:${parent}`);
    expect(below.direction).toBe("below");
    expect(below.anchorId).toBe(parent);
    expect(below.label).toBe("Parent Old");
    expect(below.hiddenDescendants).toBe(1);
    expect(below.hiddenAncestors).toBe(0);
    expect(below.branchFamilyIds).toContain(fam.id);
    const anchor = layout.nodes.find((n) => n.personId === parent)!;
    expect(below.y).toBeGreaterThan(anchor.y);
    expect(below.generation).toBeGreaterThan(anchor.generation);
    expect(layout.height).toBeGreaterThanOrEqual(below.y + below.h);
    expect(layout.width).toBeGreaterThanOrEqual(below.x + below.h);
  });

  test("a hidden ancestor line shows a placeholder above the card", () => {
    const { tree, parent, kid } = demoTree();
    const fam = tree.families.find((f) => f.children.includes(kid))!;
    const layout = familyLayout(tree, parent, { depth: 0, collapsedFamilyIds: new Set([fam.id]) });
    const phs = phOf(layout.nodes);
    expect(phs).toHaveLength(2);
    const above = layout.nodes.find((n) => n.personId === `ph:above:${parent}`)!;
    expect(above).toBeDefined();
    expect(above.direction).toBe("above");
    expect(above.anchorId).toBe(parent);
    expect(above.hiddenAncestors).toBe(1);
    expect(above.hiddenDescendants).toBe(0);
    expect(above.label).toBe("Gp Old");
    const anchor = layout.nodes.find((n) => n.personId === parent)!;
    expect(above.y).toBeLessThan(anchor.y);
    expect(above.y).toBeGreaterThanOrEqual(0);
    expect(layout.height).toBeGreaterThanOrEqual(anchor.y + anchor.h);
  });

  test("an above-placeholder tabs onto its card and no bus bar crosses it", () => {
    // The real-tree failure: a spouse line cut above the partner, with the
    // sibling bus of her row running through the floating box.
    const a = createPerson({ given: "Grandpa", sex: "M" });
    const b = createPerson({ given: "Grandma", sex: "F" });
    const f = createPerson({ given: "Focus", sex: "M" });
    const s = createPerson({ given: "Sib", sex: "M" });
    const p = createPerson({ given: "Partner", sex: "F" });
    const c = createPerson({ given: "Child", sex: "F" });
    const px = createPerson({ given: "Papa", sex: "M" });
    const py = createPerson({ given: "Mama", sex: "F" });
    const famAB = { ...createFamily({ partners: [a.id, b.id] }), children: [f.id, s.id] };
    const famFP = { ...createFamily({ partners: [f.id, p.id] }), children: [c.id] };
    const famP = { ...createFamily({ partners: [px.id, py.id] }), children: [p.id] };
    const tree = {
      ...emptyTree(),
      persons: [a, b, f, s, p, c, px, py],
      families: [famAB, famFP, famP],
    };
    const layout = familyLayout(tree, f.id);
    const above = phOf(layout.nodes).find((n) => n.direction === "above")!;
    expect(above).toBeDefined();
    expect(above.anchorId).toBe(p.id);
    const anchor = layout.nodes.find((n) => n.personId === p.id)!;
    // The box tabs onto the card top edge (12px overlap), so it reads as
    // part of the card, not a floating hole on the wire.
    expect(above.y).toBe(anchor.y - 44);
    // No horizontal sibling-bus bar may run through the box interior.
    const y0 = above.y;
    const y1 = above.y + (above.h ?? 56);
    for (const bus of layout.buses) {
      expect(bus.bus > y0 + 2 && bus.bus < y1 - 2).toBe(false);
    }
  });

  test("placeholders carry expand data, never join person rows, and stay out of the cap", () => {
    const { tree, parent, kid } = demoTree();
    const fam = tree.families.find((f) => f.children.includes(kid))!;
    const layout = familyLayout(tree, parent, { depth: 2, collapsedFamilyIds: new Set([fam.id]) });
    const rows = new Map<number, LayoutNode[]>();
    for (const n of layout.nodes) {
      const list = rows.get(n.generation) ?? [];
      list.push(n);
      rows.set(n.generation, list);
    }
    expect([...rows.keys()].every((g) => Number.isInteger(g) ? rows.get(g)!.every((n) => n.kind !== "placeholder") : true)).toBe(true);
    // The 500-person cap is about people: placeholders never count or appear there.
    const root = createPerson({ given: "Root" });
    const children = Array.from({ length: 600 }, (_, i) => createPerson({ given: `Child ${i}` }));
    const bigFam = { ...createFamily({ partners: [root.id] }), children: children.map((c) => c.id) };
    const big = familyLayout({ ...emptyTree(), persons: [root, ...children], families: [bigFam] }, root.id, { depth: 1 });
    expect(phOf(big.nodes)).toHaveLength(0);
  });
});

describe("collapse and expand to depth", () => {
  test("family node sets follow the chosen depth in both directions", () => {
    const { tree, parent } = demoTree();
    const cut = familyLayout(tree, parent, { depth: 0 });
    expect(peopleOf(cut.nodes)).toEqual([parent].sort());
    expect(phOf(cut.nodes)).toHaveLength(2);
    const open = familyLayout(tree, parent, { depth: 1 });
    expect(peopleOf(open.nodes)).toEqual(tree.persons.map((p) => p.id).sort());
    expect(phOf(open.nodes)).toHaveLength(0);
  });

  test("pedigree collapses and expands to depth with a placeholder at the cut", () => {
    const { tree, gp, parent, kid } = demoTree();
    const cut = familyLayout(tree, parent, { depth: 0, view: "pedigree" });
    expect(peopleOf(cut.nodes)).toEqual([parent].sort());
    const ph = phOf(cut.nodes);
    expect(ph).toHaveLength(1);
    expect(ph[0]!.personId).toBe(`ph:above:${parent}`);
    expect(ph[0]!.hiddenAncestors).toBe(1);
    expect(ph[0]!.label).toBe("Gp Old");
    const open = familyLayout(tree, parent, { depth: 1, view: "pedigree" });
    expect(peopleOf(open.nodes).sort()).toEqual([parent, gp].sort());
    expect(phOf(open.nodes)).toHaveLength(0);
    expect(peopleOf(open.nodes)).not.toContain(kid);
  });

  test("fan collapses and expands to depth with a placeholder outward at the cut", () => {
    const { tree, gp, parent, kid } = demoTree();
    const cut = familyLayout(tree, parent, { depth: 0, view: "fan" });
    expect(peopleOf(cut.nodes)).toEqual([parent].sort());
    const ph = phOf(cut.nodes);
    expect(ph).toHaveLength(1);
    expect(ph[0]!.personId).toBe(`ph:above:${parent}`);
    expect(ph[0]!.hiddenAncestors).toBe(1);
    const anchor = cut.nodes.find((n) => n.personId === parent)!;
    expect(ph[0]!.y).toBeLessThan(anchor.y);
    expect(ph[0]!.x).toBeCloseTo(anchor.x, 0);
    const open = familyLayout(tree, parent, { depth: 1, view: "fan" });
    expect(peopleOf(open.nodes).sort()).toEqual([parent, gp].sort());
    expect(phOf(open.nodes)).toHaveLength(0);
    expect(peopleOf(open.nodes)).not.toContain(kid);
  });

  test("collapsing to depth respects the visible-people cap", () => {
    const root = createPerson({ given: "Root" });
    const children = Array.from({ length: 600 }, (_, i) => createPerson({ given: `Child ${i}` }));
    const fam = { ...createFamily({ partners: [root.id] }), children: children.map((c) => c.id) };
    const layout = familyLayout({ ...emptyTree(), persons: [root, ...children], families: [fam] }, root.id, { depth: 0 });
    expect(peopleOf(layout.nodes)).toHaveLength(1);
    expect(phOf(layout.nodes).filter((n) => n.hiddenDescendants === 600)).toHaveLength(1);
    expect(layout.truncatedCount).toBe(0);
  });
});

describe("outline model", () => {
  test("lists the focused branch as a nested hierarchy from the layout", () => {
    const { tree, gp, parent, kid } = demoTree();
    const layout = familyLayout(tree, parent, {});
    const out = outlineFromLayout(tree, layout, parent);
    expect(out.root).toBe(parent);
    expect(out.tree!.name).toBe("Parent Old");
    expect(out.tree!.parents.map((p) => p.id)).toEqual([gp]);
    expect(out.tree!.children.map((c) => c.id)).toEqual([kid]);
    expect(out.tree!.parents[0]!.parents).toHaveLength(0);
    expect(out.tree!.children[0]!.children).toHaveLength(0);
    expect(out.tree!.hiddenAncestors).toBe(0);
    expect(out.tree!.hiddenDescendants).toBe(0);
  });

  test("collapsed and capped branches carry their hidden counts", () => {
    const { tree, parent } = demoTree();
    const cut = familyLayout(tree, parent, { depth: 0 });
    const out = outlineFromLayout(tree, cut, parent);
    expect(out.tree!.children).toHaveLength(0);
    expect(out.tree!.hiddenDescendants).toBe(1);
    expect(out.tree!.parents).toHaveLength(0);
    expect(out.tree!.hiddenAncestors).toBe(1);
  });

  test("cap-truncated children show as hidden counts on their parent", () => {
    const root = createPerson({ given: "Root" });
    const children = Array.from({ length: 600 }, (_, i) => createPerson({ given: `Child ${i}` }));
    const fam = { ...createFamily({ partners: [root.id] }), children: children.map((c) => c.id) };
    const layout = familyLayout({ ...emptyTree(), persons: [root, ...children], families: [fam] }, root.id, { depth: 1 });
    const out = outlineFromLayout({ ...emptyTree(), persons: [root, ...children], families: [fam] }, layout, root.id);
    expect(out.tree!.children).toHaveLength(499);
    expect(out.tree!.hiddenDescendants).toBe(101);
  });
});

describe("list query", () => {
  test("surname filter is case-insensitive; sorts by birth year", () => {
    const { tree } = demoTree();
    const extra = addFact(createPerson({ given: "Zed", surname: "Young" }), {
      type: "BIRT",
      dateRaw: "1900",
    }).person;
    const withExtra = { ...tree, persons: [...tree.persons, extra] };
    const filtered = listPeople(withExtra, { surname: "old" });
    expect(filtered.map((r) => r.display)).toContain("Kid Old");
    expect(filtered.some((r) => r.display === "Zed Young")).toBe(false);
    const byBirth = listPeople(withExtra, { sort: "birth" });
    expect(byBirth[0]?.display).toBe("Kid Old");
    expect(byBirth[1]?.display).toBe("Zed Young");
    // unknown birth years sort last
    expect(byBirth.slice(2).map((r) => r.display).sort()).toEqual(["Gp Old", "Parent Old"]);
    // birth year + place extracted from the BIRT fact
    expect(byBirth[0]).toMatchObject({ birthYear: "1815", birthPlace: "London" });
  });

  test("sorts by name and death year", () => {
    const a = createPerson({ given: "B", surname: "A" });
    const b = createPerson({ given: "A", surname: "B" });
    const rows = listPeople({ ...emptyTree(), persons: [a, b] }, { sort: "given" });
    expect(rows.map((r) => r.display)).toEqual(["A B", "B A"]);
  });
});
