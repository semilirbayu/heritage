import { describe, expect, test } from "bun:test";
import { addChild, createFamily, createPerson } from "../src/domain/tree";

describe("heritage domain — ticket 01 vertical path", () => {
  test("create a person with names/sex/living flags", () => {
    const ada = createPerson({
      given: "Ada",
      surname: "Lovelace",
      sex: "F",
    });
    expect(ada.names[0]?.given).toBe("Ada");
    expect(ada.names[0]?.surname).toBe("Lovelace");
    expect(ada.sex).toBe("F");
    expect(ada.isLiving).toBe(true);
    expect(typeof ada.id).toBe("string");
  });

  test("parent + child relationship links both sides (FAMC/FAMS mirror)", () => {
    const parent = createPerson({ given: "Anne", surname: "Lovelace", sex: "F" });
    const child = createPerson({ given: "Ada", surname: "Lovelace", sex: "F" });
    const family = createFamily({ partners: [parent.id] });
    const linked = addChild({ family, childId: child.id, parent });
    expect(linked.family.children).toContain(child.id);
    expect(linked.updatedParent.fams).toContain(family.id);
  });

  test("addChild records the child's FAMC link", () => {
    const parent = createPerson({ given: "Anne", surname: "Lovelace", sex: "F" });
    const child = createPerson({ given: "Ada", surname: "Lovelace", sex: "F" });
    const family = createFamily({ partners: [parent.id] });
    const linked = addChild({ family, childId: child.id, parent, child });
    expect(linked.updatedChild?.famc.map((l) => l.familyId)).toContain(
      family.id,
    );
  });
});
