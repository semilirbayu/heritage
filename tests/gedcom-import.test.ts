import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importGedcom } from "../src/gedcom/import";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

describe("gedcom importer", () => {
  test("imports the minimal 5.5.1 fixture with links resolved", () => {
    const { tree, report } = importGedcom(fixture("minimal-551.ged"));
    expect(report.version).toBe("5.5.1");
    expect(report.counts.individuals).toBe(2);
    expect(report.counts.families).toBe(1);
    expect(report.warnings).toEqual([]);
    const anne = tree.persons.find((p) => p.xref === "I1")!;
    const ada = tree.persons.find((p) => p.xref === "I2")!;
    expect(anne.names[0]).toMatchObject({ given: "Anne", surname: "Lovelace" });
    expect(anne.sex).toBe("F");
    expect(anne.fams).toHaveLength(1);
    expect(ada.famc.map((l) => l.familyId)).toEqual(anne.fams);
    expect(tree.families[0]?.children).toEqual([ada.id]);
  });

  test("NAME slash-parse, SEX normalize, DATE norm, NOTE join, extensions kept", () => {
    const { tree, report } = importGedcom(`0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME Robert "Bob" /Smith/
2 GIVN Robert
2 SURN Smith
2 NICK Bob
1 SEX X
1 BIRT
2 DATE ABT 1900
2 PLAC Leeds, Yorkshire
1 NOTE line one
2 CONT line two
1 _UID abc-123
1 ZZZ mystery
1 FAMS @F9@
0 TRLR
`);
    const p = tree.persons[0]!;
    expect(p.names[0]).toMatchObject({ given: "Robert", surname: "Smith", nick: "Bob" });
    expect(p.sex).toBe("X");
    expect(p.events[0]).toMatchObject({ type: "BIRT", dateRaw: "ABT 1900" });
    expect(p.events[0]?.dateNorm).toEqual({ qualifier: "ABT" });
    expect(p.events[0]?.place).toEqual({ raw: "Leeds, Yorkshire" });
    expect(p.researchNotes).toContain("line one\nline two");
    expect(p.extensions["INDI._UID"]).toBe("abc-123");
    expect(p.extensions["INDI.ZZZ"]).toBe("mystery");
    // dangling pointer dropped with warning; missing TRLR would warn too (present here)
    expect(p.fams).toEqual([]);
    expect(report.warnings.some((w) => w.code === "dangling-pointer")).toBe(true);
  });

  test("shared NOTE/SOUR/OBJE records resolve; PEDI maps; EVEN+TYPE custom", () => {
    const { tree } = importGedcom(`0 HEAD
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @N1@ NOTE shared note
0 @S1@ SOUR
1 TITL Census 1900
0 @M1@ OBJE
1 FILE photos/ada.jpg
2 FORM jpg
1 TITL Ada portrait
0 @I1@ INDI
1 NAME Ada /Lovelace/
1 SEX F
1 EVEN
2 TYPE GRADUATION
2 DATE 1840
1 SOUR @S1@
2 PAGE p3
1 OBJE @M1@
1 FAMC @F1@
2 PEDI ADOPTED
0 @F1@ FAM
1 WIFE @I1@
1 MARR
2 DATE 8 JUL 1835
0 TRLR
`);
    const ada = tree.persons[0]!;
    expect(ada.famc[0]).toMatchObject({ pedi: "adoptive" });
    expect(ada.events.find((e) => e.type === "GRADUATION")?.dateRaw).toBe("1840");
    expect(ada.sources).toEqual([{ sourceId: expect.any(String), page: "p3" }]);
    expect(tree.sources).toHaveLength(1);
    expect(tree.media[0]).toMatchObject({ path: "photos/ada.jpg" });
    expect(ada.mediaIds).toHaveLength(1);
    const fam = tree.families[0]!;
    expect(fam.partners).toEqual([ada.id]);
    expect(fam.marriage?.dateRaw).toBe("8 JUL 1835");
  });

  test("DEAT implies not living; one-sided links reconcile; missing TRLR warns", () => {
    const { tree, report } = importGedcom(`0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Old /Dead/
1 DEAT Y
0 @F1@ FAM
1 CHIL @I1@
`);
    const p = tree.persons[0]!;
    expect(p.isLiving).toBe(false);
    expect(p.famc.map((l) => l.familyId)).toHaveLength(1);
    expect(report.warnings.some((w) => w.code === "missing-trailer")).toBe(true);
  });

  test("duplicate xref: first wins with warning", () => {
    const { tree, report } = importGedcom(`0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME First /One/
0 @I1@ INDI
1 NAME Second /Two/
0 TRLR
`);
    expect(tree.persons).toHaveLength(1);
    expect(tree.persons[0]?.names[0]?.given).toBe("First");
    expect(report.warnings.some((w) => w.code === "duplicate-xref")).toBe(true);
  });
});
