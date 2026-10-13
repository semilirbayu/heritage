import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addFact, addParent, createPerson, setDeceased } from "../src/domain/tree";
import type { Tree } from "../src/domain/types";
import { exportGedcom } from "../src/gedcom/export";
import { importGedcom } from "../src/gedcom/import";

function buildTree(): Tree {
  const anne = createPerson({ given: "Anne", surname: "Lovelace", sex: "F" });
  const ada = createPerson({ given: "Ada", surname: "Lovelace", sex: "F" });
  const withBirth = addFact(ada, { type: "BIRT", dateRaw: "10 dec 1815", placeRaw: "London" });
  const { family, updatedChild, updatedParent } = addParent({
    child: withBirth.person,
    parent: anne,
  });
  return {
    persons: [updatedParent, updatedChild],
    families: [family],
    notes: [],
    sources: [],
    media: [],
  };
}

describe("gedcom exporter", () => {
  test("emits 5.5.1 HEAD, INDI/FAM records, upper-month DATEs, TRLR", () => {
    const ged = exportGedcom(buildTree());
    expect(ged).toContain("2 VERS 5.5.1");
    expect(ged).toContain("2 FORM LINEAGE-LINKED");
    expect(ged).toContain("1 CHAR UTF-8");
    expect(ged).toContain("1 NAME Anne /Lovelace/");
    expect(ged).toContain("2 DATE 10 DEC 1815");
    expect(ged).toMatch(/0 @F\d+@ FAM/);
    expect(ged.trimEnd().endsWith("0 TRLR")).toBe(true);
  });

  test("round-trip: import → export → re-import preserves counts and links", () => {
    const src = readFileSync(join(__dirname, "fixtures", "minimal-551.ged"), "utf-8");
    const first = importGedcom(src);
    const ged = exportGedcom(first.tree);
    const second = importGedcom(ged);
    expect(second.report.counts).toEqual(first.report.counts);
    const anne = second.tree.persons.find((p) => p.names[0]?.given === "Anne")!;
    const ada = second.tree.persons.find((p) => p.names[0]?.given === "Ada")!;
    expect(anne.names[0]?.surname).toBe("Lovelace");
    expect(ada.famc.map((l) => l.familyId)).toEqual(anne.fams);
  });

  test("round-trip preserves notes, _ tags, DATE norms, PEDI", () => {    const src = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME A /B/
1 SEX M
1 BIRT
2 DATE ABT 1900
1 NOTE a very long note that keeps going
2 CONT second line
1 _UID keep-me
1 FAMC @F1@
2 PEDI ADOPTED
0 @F1@ FAM
1 CHIL @I1@
0 TRLR
`;
    const first = importGedcom(src);
    const second = importGedcom(exportGedcom(first.tree));
    expect(second.report.counts).toEqual(first.report.counts);
    const p = second.tree.persons[0]!;
    expect(p.extensions["INDI._UID"]).toBe("keep-me");
    expect(p.events[0]?.dateNorm).toEqual({ qualifier: "ABT" });
    expect(p.famc[0]?.pedi).toBe("adoptive");
  });

  test("living redact keeps links, drops details", () => {
    const living = createPerson({ given: "Ada", surname: "Lovelace" });
    const dead = setDeceased(createPerson({ given: "Anne" }), { dateRaw: "1900" });
    const ged = exportGedcom(
      { persons: [living, dead], families: [], notes: [], sources: [], media: [] },
      { livingFilter: "redact" },
    );
    expect(ged).toContain("1 NAME Living");
    expect(ged).not.toContain("Lovelace");
    expect(ged).toContain("1 DEAT");
  });

  test("living exclude drops the person", () => {
    const living = createPerson({ given: "Ada" });
    const dead = setDeceased(createPerson({ given: "Anne" }), {});
    const ged = exportGedcom(
      { persons: [living, dead], families: [], notes: [], sources: [], media: [] },
      { livingFilter: "exclude" },
    );
    expect(importGedcom(ged).report.counts.individuals).toBe(1);
  });

  test("branch export keeps descendants + partners only", () => {
    const gp = createPerson({ given: "Gp" });
    const parent = createPerson({ given: "Parent" });
    const kid = createPerson({ given: "Kid" });
    const uncle = createPerson({ given: "Uncle" });
    const r1 = addParent({ child: parent, parent: gp });
    const r2 = addParent({ child: uncle, parent: gp });
    const r3 = addParent({ child: kid, parent: r1.updatedChild });
    const tree: Tree = {
      persons: [r1.updatedParent, r1.updatedChild, r2.updatedChild, r3.updatedChild],
      families: [r1.family, r2.family, r3.family],
      notes: [],
      sources: [],
      media: [],
    };
    const ged = exportGedcom(tree, { branchRootId: parent.id });
    const back = importGedcom(ged);
    const names = back.tree.persons.map((p) => p.names[0]?.given).sort();
    expect(names).toEqual(["Kid", "Parent"]);
  });

  test("includeMedia:false drops OBJE links and records", () => {
    const src = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @M1@ OBJE
1 FILE photos/a.jpg
2 FORM jpg
0 @I1@ INDI
1 NAME A /B/
1 OBJE @M1@
0 TRLR
`;
    const { tree } = importGedcom(src);
    expect(exportGedcom(tree)).toContain("OBJE");
    expect(exportGedcom(tree, { includeMedia: false })).not.toContain("OBJE");
  });

  test("relative media links export under the sidecar dir", () => {
    const src = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @M1@ OBJE
1 FILE photos/a.jpg
2 FORM jpg
0 @I1@ INDI
1 NAME A /B/
1 OBJE @M1@
0 TRLR
`;
    const { tree } = importGedcom(src);
    expect(exportGedcom(tree)).toContain("1 FILE media/photos/a.jpg");
  });

  test("round-trip is a fixed point for exotic tags (ZZZ, CHAN, inline SOUR, FAM NOTE, FORM, multi-NAME)", () => {
    const src = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME John /Smith/
1 NAME Johnny /Smith/
1 SEX M
1 BIRT
2 DATE 1 JAN 1900
2 SOUR a parish register
1 ZZZ kept
1 CHAN
2 DATE 2 JAN 2000
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I1@
1 NOTE family note
1 MARR
2 DATE 1920
0 TRLR
`;
    const once = importGedcom(src);
    const twice = importGedcom(exportGedcom(once.tree));
    const thrice = importGedcom(exportGedcom(twice.tree));
    expect(twice.report.counts).toEqual(once.report.counts);
    expect(thrice.report.counts).toEqual(twice.report.counts);
    const p1 = once.tree.persons[0]!;
    const p2 = twice.tree.persons[0]!;
    expect(p2.extensions["INDI.ZZZ"]).toBe("kept");
    expect(p2.names[0]?.alternates).toEqual(p1.names[0]?.alternates);
    expect(p2.events[0]?.extensions["BIRT.SOUR.inline"]).toBe("a parish register");
    expect(twice.tree.families[0]?.extensions["FAM.NOTE"]).toBe("family note");
    expect(exportGedcom(twice.tree)).toBe(exportGedcom(once.tree));
  });
});
