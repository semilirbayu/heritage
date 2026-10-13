import { describe, expect, test } from "bun:test";
import { decodeGedcom } from "../src/gedcom/decode";
import { parseLines } from "../src/gedcom/lines";

describe("gedcom decode", () => {
  test("UTF-8 BOM is stripped and reported", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("0 HEAD\n0 TRLR\n")]);
    const { text, encoding, hadBom } = decodeGedcom(bytes);
    expect(hadBom).toBe(true);
    expect(encoding).toBe("UTF-8");
    expect(text.startsWith("0 HEAD")).toBe(true);
  });

  test("UTF-16LE BOM decodes", () => {
    const s = "0 HEAD\n0 TRLR\n";
    const buf = new Uint8Array(2 + s.length * 2);
    buf[0] = 0xff; buf[1] = 0xfe;
    for (let i = 0; i < s.length; i++) buf[2 + i * 2] = s.charCodeAt(i);
    const { text, encoding, hadBom } = decodeGedcom(buf);
    expect(hadBom).toBe(true);
    expect(encoding).toBe("UTF-16LE");
    expect(text).toContain("0 TRLR");
  });

  test("latin-1 bytes fall back without throwing", () => {
    // 0xE9 (é in windows-1252) is invalid lone UTF-8
    const bytes = new Uint8Array([0x30, 0x20, 0x48, 0x45, 0x41, 0x44, 0x0a, 0xe9, 0x0a]);
    const { text, encoding } = decodeGedcom(bytes);
    expect(text).toContain("0 HEAD");
    expect(encoding).not.toBe("UTF-8");
  });
});

describe("gedcom line lexer", () => {
  test("parses level/xref/tag/value", () => {
    const lines = parseLines("0 @I1@ INDI\n1 NAME John /Smith/\n1 SEX M\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ level: 0, xref: "I1", tag: "INDI", value: "" });
    expect(lines[1]).toMatchObject({ level: 1, tag: "NAME", value: "John /Smith/" });
  });

  test("CONC joins, CONT adds newline (5.x long-line split)", () => {
    const lines = parseLines("1 NOTE hello\n2 CONC  world\n2 CONT next\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.value).toBe("hello world\nnext");
  });

  test("blank lines skipped, leading whitespace tolerated, bad level clamped", () => {
    const lines = parseLines("0 @I1@ INDI\n\n   1 NAME x\n4 DATE y\n");
    expect(lines.map((l) => l.tag)).toEqual(["INDI", "NAME", "DATE"]);
    // jumped 1 -> 4 on a non-CONT line: clamped to parent+1, kept with warning
    expect(lines[2]?.level).toBe(2);
    expect(lines[2]?.clamped).toBe(true);
  });

  test("unknown and underscore tags survive with raw text", () => {
    const lines = parseLines("1 _UID ABC\n1 FOO bar\n");
    expect(lines.map((l) => l.tag)).toEqual(["_UID", "FOO"]);
    expect(lines[0]?.value).toBe("ABC");
  });
});
