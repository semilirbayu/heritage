import { describe, expect, test } from "bun:test";
import {
  addResearchNote,
  createPerson,
  setDeceased,
  setLiving,
  updatePerson,
} from "../src/domain/tree";
describe("person CRUD", () => {
  test("update name pieces, sex, and biography", () => {
    const p = createPerson({ given: "Ann", surname: "Smith", sex: "U" });
    const updated = updatePerson(p, {
      given: "Anne",
      surname: "Lovelace",
      sex: "F",
      biography: "Mathematician.",
    });
    expect(updated.names[0]?.given).toBe("Anne");
    expect(updated.names[0]?.surname).toBe("Lovelace");
    expect(updated.names[0]?.display).toBe("Anne Lovelace");
    expect(updated.sex).toBe("F");
    expect(updated.biography).toBe("Mathematician.");
    // original untouched (pure)
    expect(p.names[0]?.given).toBe("Ann");
  });

  test("explicit display name wins over recomputed", () => {
    const p = createPerson({ given: "Ada", surname: "Lovelace" });
    const updated = updatePerson(p, { display: "Ada King" });
    expect(updated.names[0]?.display).toBe("Ada King");
    expect(updated.names[0]?.given).toBe("Ada");
  });

  test("setDeceased flags not living and records a DEAT fact", () => {
    const p = createPerson({ given: "Ada", surname: "Lovelace" });
    const dead = setDeceased(p, { dateRaw: "27 NOV 1852", placeRaw: "London" });
    expect(dead.isLiving).toBe(false);
    expect(dead.events.some((e) => e.type === "DEAT")).toBe(true);
    expect(
      dead.events.find((e) => e.type === "DEAT")?.place?.raw,
    ).toBe("London");
  });

  test("setLiving restores the flag and drops DEAT facts", () => {
    const p = setDeceased(createPerson({ given: "Ada" }), {});
    const living = setLiving(p);
    expect(living.isLiving).toBe(true);
    expect(living.events.some((e) => e.type === "DEAT")).toBe(false);
  });

  test("research notes append in order", () => {
    const p = createPerson({ given: "Ada" });
    const noted = addResearchNote(addResearchNote(p, "first"), "second");
    expect(noted.researchNotes).toEqual(["first", "second"]);
    expect(p.researchNotes).toEqual([]);
  });

  test("bio-only patch keeps a custom display name", () => {
    const p = updatePerson(createPerson({ given: "Ada" }), {
      display: "Ada King",
    });
    const updated = updatePerson(p, { biography: " bio " });
    expect(updated.names[0]?.display).toBe("Ada King");
    expect(updated.biography).toBe(" bio ");
  });

  test("name pieces prefix/suffix/nick are editable", () => {
    const p = createPerson({ given: "Ada", surname: "Lovelace" });
    const updated = updatePerson(p, {
      prefix: "Countess",
      suffix: "Jr",
      nick: "Numbers",
    });
    expect(updated.names[0]?.prefix).toBe("Countess");
    expect(updated.names[0]?.suffix).toBe("Jr");
    expect(updated.names[0]?.nick).toBe("Numbers");
  });

  test("setDeceased records cause when given", () => {
    const p = createPerson({ given: "Ada" });
    const dead = setDeceased(p, { cause: "cancer" });
    expect(dead.events.find((e) => e.type === "DEAT")?.cause).toBe("cancer");
  });
});
