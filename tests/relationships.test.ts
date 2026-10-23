import { describe, expect, test } from "bun:test";
import {
  addChild,
  addParent,
  addPartner,
  addSibling,
  createFamily,
  createPerson,
  detachChild,
  detachPartner,
  kinOf,
  relationLabel,
  setDivorce,
  setMarriage,
} from "../src/domain/tree";
import { emptyTree } from "../src/domain/tree";

describe("typed relationships", () => {
  test("addParent creates a family when absent, links both sides, records pedi", () => {
    const child = createPerson({ given: "Ada" });
    const parent = createPerson({ given: "Anne" });
    const { family, updatedChild, updatedParent } = addParent({
      child,
      parent,
      pedi: "adoptive",
    });
    expect(family.children).toContain(child.id);
    expect(family.partners).toContain(parent.id);
    expect(updatedParent.fams).toContain(family.id);
    expect(
      updatedChild.famc.find((l) => l.familyId === family.id)?.pedi,
    ).toBe("adoptive");
  });

  test("addParent into an existing family adds the partner without dupes", () => {
    const child = createPerson({ given: "Ada" });
    const p1 = createPerson({ given: "Anne" });
    const first = addParent({ child, parent: p1 });
    const p2 = createPerson({ given: "Byron" });
    const second = addParent({
      child: first.updatedChild,
      parent: p2,
      family: first.family,
    });
    expect(second.family.partners).toEqual(
      expect.arrayContaining([p1.id, p2.id]),
    );
    expect(second.family.children.filter((c) => c === child.id)).toHaveLength(
      1,
    );
    // re-attaching the same parent is a no-op
    const again = addParent({
      child: second.updatedChild,
      parent: p2,
      family: second.family,
    });
    expect(again.family.partners.filter((p) => p === p2.id)).toHaveLength(1);
  });

  test("addSibling shares the family without duplicating the child link", () => {
    const child = createPerson({ given: "Ada" });
    const parent = createPerson({ given: "Anne" });
    const { family, updatedChild } = addParent({ child, parent });
    const sib = createPerson({ given: "Ralph" });
    const res = addSibling({ family, siblingId: sib.id, sibling: sib });
    expect(res.family.children).toEqual(
      expect.arrayContaining([child.id, sib.id]),
    );
    expect(res.updatedSibling?.famc.map((l) => l.familyId)).toContain(
      family.id,
    );
    expect(updatedChild.famc.map((l) => l.familyId)).toContain(family.id);
  });

  test("detachChild removes links on both sides", () => {
    const child = createPerson({ given: "Ada" });
    const parent = createPerson({ given: "Anne" });
    const { family, updatedChild } = addParent({ child, parent });
    const res = detachChild({ family, childId: child.id, child: updatedChild });
    expect(res.family.children).not.toContain(child.id);
    expect(res.updatedChild?.famc.map((l) => l.familyId)).not.toContain(
      family.id,
    );
  });

  test("second partner creates a second family (multi-partner)", () => {
    const a = createPerson({ given: "Ada" });
    const b = createPerson({ given: "Byron" });
    const c = createPerson({ given: "Clara" });
    const first = addPartner({ a, b });
    const second = addPartner({ a: first.updatedA, b: c });
    expect(second.updatedA.fams).toHaveLength(2);
    expect(second.updatedA.fams).toEqual(
      expect.arrayContaining([first.family.id, second.family.id]),
    );
  });

  test("detachPartner removes links on both sides", () => {
    const a = createPerson({ given: "Ada" });
    const b = createPerson({ given: "Byron" });
    const { family, updatedB } = addPartner({ a, b });
    const res = detachPartner({ family, partnerId: b.id, partner: updatedB });
    expect(res.family.partners).not.toContain(b.id);
    expect(res.updatedPartner?.fams).not.toContain(family.id);
  });

  test("divorce is a couple fact: family + DIV on both partners", () => {
    const a = createPerson({ given: "Ada" });
    const b = createPerson({ given: "Byron" });
    const { family, updatedA, updatedB } = addPartner({ a, b });
    const res = setDivorce({
      family,
      partnerA: updatedA,
      partnerB: updatedB,
      dateRaw: "1 JAN 1850",
    });
    expect(res.family.divorce?.type).toBe("DIV");
    expect(
      res.updatedA.events.some((e) => e.type === "DIV"),
    ).toBe(true);
    expect(
      res.updatedB.events.some((e) => e.type === "DIV"),
    ).toBe(true);
    expect(res.family).not.toBe(family);
  });

  test("empty-partner family from ticket 01 still links children", () => {
    const parent = createPerson({ given: "Anne" });
    const child = createPerson({ given: "Ada" });
    const family = createFamily({ partners: [] });
    const res = addParent({ child, parent, family });
    expect(res.family.partners).toContain(parent.id);
    expect(res.family.children).toContain(child.id);
  });

  test("addPartner into an existing family keeps both partners (idempotent)", () => {
    const a = createPerson({ given: "Ada" });
    const b = createPerson({ given: "Byron" });
    const { family, updatedA, updatedB } = addPartner({ a, b });
    const again = addPartner({ a: updatedA, b: updatedB, family });
    expect(again.family.partners).toEqual(
      expect.arrayContaining([a.id, b.id]),
    );
    expect(again.family.partners).toHaveLength(2);
  });

  test("setDivorce shares one event id and is idempotent", () => {
    const a = createPerson({ given: "Ada" });
    const b = createPerson({ given: "Byron" });
    const { family, updatedA, updatedB } = addPartner({ a, b });
    const once = setDivorce({ family, partnerA: updatedA, partnerB: updatedB });
    const twice = setDivorce({
      family: once.family,
      partnerA: once.updatedA,
      partnerB: once.updatedB,
    });
    expect(once.family.divorce?.id).toBe(
      once.updatedA.events.find((e) => e.type === "DIV")?.id,
    );
    expect(
      twice.updatedA.events.filter((e) => e.type === "DIV"),
    ).toHaveLength(1);
  });

  test("setMarriage mirrors MARR on the family and both partners", () => {    const a = createPerson({ given: "Ada" });
    const b = createPerson({ given: "Byron" });
    const { family, updatedA, updatedB } = addPartner({ a, b });
    const res = setMarriage({
      family,
      partnerA: updatedA,
      partnerB: updatedB,
      dateRaw: "8 JUL 1835",
    });
    expect(res.family.marriage?.type).toBe("MARR");
    expect(res.updatedA.events.some((e) => e.type === "MARR")).toBe(true);
    expect(res.updatedB.events.some((e) => e.type === "MARR")).toBe(true);
  });

  test("kinOf returns de-duplicated parents/partners/children", () => {
    const gp = createPerson({ given: "Gp" });
    const parent = createPerson({ given: "Parent" });
    const kid = createPerson({ given: "Kid" });
    const r1 = addParent({ child: parent, parent: gp });
    const r2 = addParent({ child: kid, parent: r1.updatedChild });
    const tree = {
      ...emptyTree(),
      persons: [r1.updatedParent, r2.updatedParent, r2.updatedChild],
      families: [r1.family, r2.family],
    };
    const kin = kinOf(tree, r2.updatedChild);
    expect(kin.parents.map((p) => p.id)).toEqual([r2.updatedParent.id]);
    expect(kin.partners).toEqual([]);
    expect(kin.children).toEqual([]);
    const kinParent = kinOf(tree, r2.updatedParent);
    expect(kinParent.children.map((p) => p.id)).toEqual([r2.updatedChild.id]);
  });
});

describe("relation label", () => {
  test("names the common relations from the chart root", () => {
    const gp = addPartner({
      a: createPerson({ given: "Grandpa", sex: "M" }),
      b: createPerson({ given: "Grandma", sex: "F" }),
    });
    const parent = createPerson({ given: "Parent", sex: "M" });
    const withParent = addChild({
      family: gp.family,
      childId: parent.id,
      parent: gp.updatedA,
      child: parent,
    });
    const aunt = createPerson({ given: "Aunt", sex: "F" });
    const withAunt = addChild({
      family: withParent.family,
      childId: aunt.id,
      parent: withParent.updatedParent,
      child: aunt,
    });
    const root = createPerson({ given: "Root", sex: "F" });
    const withRoot = addParent({ child: root, parent: withParent.updatedChild! });
    const sibling = createPerson({ given: "Brother", sex: "M" });
    const withSibling = addSibling({
      family: withRoot.family,
      siblingId: sibling.id,
      sibling,
    });
    const spouse = createPerson({ given: "Husband", sex: "M" });
    const withSpouse = addPartner({ a: withRoot.updatedChild, b: spouse });
    const child = createPerson({ given: "Daughter", sex: "F" });
    const withChild = addChild({
      family: withSpouse.family,
      childId: child.id,
      parent: withSpouse.updatedA,
      child,
    });
    const grandchild = createPerson({ given: "Grandkid", sex: "F" });
    const withGrandchild = addParent({ child: grandchild, parent: withChild.updatedChild! });
    const niece = createPerson({ given: "Niece", sex: "F" });
    const withNiece = addParent({ child: niece, parent: withSibling.updatedSibling! });
    const cousin = createPerson({ given: "Cousin", sex: "M" });
    const withCousin = addParent({ child: cousin, parent: withAunt.updatedChild! });
    const tree = {
      ...emptyTree(),
      persons: [
        withAunt.updatedParent,
        gp.updatedB,
        withRoot.updatedParent,
        withCousin.updatedParent,
        withChild.updatedParent,
        withNiece.updatedParent,
        withSpouse.updatedB,
        withGrandchild.updatedParent,
        withGrandchild.updatedChild,
        withNiece.updatedChild,
        withCousin.updatedChild,
      ],
      families: [
        withAunt.family,
        withSibling.family,
        withChild.family,
        withGrandchild.family,
        withNiece.family,
        withCousin.family,
      ],
    };
    const rootId = withChild.updatedParent.id;
    expect(relationLabel(tree, rootId, rootId)).toBe("Main person");
    expect(relationLabel(tree, rootId, withSpouse.updatedB.id)).toBe("Husband");
    expect(relationLabel(tree, rootId, withRoot.updatedParent.id)).toBe("Father");
    expect(relationLabel(tree, rootId, withChild.updatedChild!.id)).toBe("Daughter");
    expect(relationLabel(tree, rootId, withSibling.updatedSibling!.id)).toBe("Brother");
    expect(relationLabel(tree, rootId, withAunt.updatedParent.id)).toBe("Grandfather");
    expect(relationLabel(tree, rootId, withGrandchild.updatedChild.id)).toBe("Granddaughter");
    expect(relationLabel(tree, rootId, withAunt.updatedChild!.id)).toBe("Aunt");
    expect(relationLabel(tree, rootId, withNiece.updatedChild.id)).toBe("Niece");
    expect(relationLabel(tree, rootId, withCousin.updatedChild.id)).toBe("Cousin");
    expect(relationLabel(tree, rootId, "ghost")).toBe("Relative");  });

  test("unknown sex reads neutral, and a missing root is safe", () => {
    const parent = createPerson({ given: "Parent" });
    const child = createPerson({ given: "Child" });
    const linked = addParent({ child, parent });
    const tree = {
      ...emptyTree(),
      persons: [linked.updatedParent, linked.updatedChild],
      families: [linked.family],
    };
    expect(relationLabel(tree, linked.updatedChild.id, linked.updatedParent.id)).toBe("Parent");
    expect(relationLabel(tree, "ghost", linked.updatedChild.id)).toBe("Relative");
  });
});
