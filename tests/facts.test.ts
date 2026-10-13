import { describe, expect, test } from "bun:test";
import {
  addFact,
  createPerson,
  deleteFact,
  preferredEvent,
  preferredName,
  updateFact,
} from "../src/domain/tree";

describe("facts / events", () => {
  test("addFact records type/date/place/notes/media/sources with an id", () => {
    const p = createPerson({ given: "Ada" });
    const { person, fact } = addFact(p, {
      type: "BIRT",
      dateRaw: "10 DEC 1815",
      placeRaw: "London",
      noteIds: ["n1"],
      mediaIds: ["m1"],
    });
    expect(fact.type).toBe("BIRT");
    expect(typeof fact.id).toBe("string");
    expect(person.events).toHaveLength(1);
    expect(person.events[0]?.place?.raw).toBe("London");
    expect(person.events[0]?.mediaIds).toEqual(["m1"]);
    expect(p.events).toHaveLength(0);
  });

  test("custom fact types are accepted as-is (type picker fallback)", () => {
    const p = createPerson({ given: "Ada" });
    const { fact } = addFact(p, { type: "GRADUATION", dateRaw: "1840" });
    expect(fact.type).toBe("GRADUATION");
  });

  test("updateFact patches date/place, deleteFact removes only that fact", () => {
    const p = createPerson({ given: "Ada" });
    const r1 = addFact(p, { type: "BIRT", dateRaw: "1815" });
    const r2 = addFact(r1.person, { type: "DEAT", dateRaw: "1852" });
    const updated = updateFact(r2.person, r1.fact.id, {
      dateRaw: "10 DEC 1815",
      placeRaw: "London",
    });
    expect(
      updated.events.find((e) => e.id === r1.fact.id)?.dateRaw,
    ).toBe("10 DEC 1815");
    const afterDelete = deleteFact(updated, r1.fact.id);
    expect(afterDelete.events.some((e) => e.id === r1.fact.id)).toBe(false);
    expect(afterDelete.events.some((e) => e.type === "DEAT")).toBe(true);
  });

  test("updateFact also patches notes/media/sources evidence", () => {
    const p = createPerson({ given: "Ada" });
    const { person, fact } = addFact(p, { type: "BIRT" });
    const updated = updateFact(person, fact.id, {
      noteIds: ["n9"],
      mediaIds: ["m9"],
      sources: [{ sourceId: "s9", page: "p3" }],
    });
    const found = updated.events.find((e) => e.id === fact.id);
    expect(found?.noteIds).toEqual(["n9"]);
    expect(found?.mediaIds).toEqual(["m9"]);
    expect(found?.sources).toEqual([{ sourceId: "s9", page: "p3" }]);
  });

  test("conflicting opinions: first instance is preferred", () => {
    const p = createPerson({ given: "Ada" });
    const r1 = addFact(p, { type: "BIRT", dateRaw: "1815" });
    const r2 = addFact(r1.person, { type: "BIRT", dateRaw: "1816" });
    expect(r2.person.events.filter((e) => e.type === "BIRT")).toHaveLength(2);
    expect(preferredEvent(r2.person.events, "BIRT")?.dateRaw).toBe("1815");
  });

  test("preferredName is the first (primary) name", () => {
    const p = createPerson({ given: "Ada", surname: "Lovelace" });
    expect(preferredName(p)).toBe("Ada Lovelace");
  });
});
