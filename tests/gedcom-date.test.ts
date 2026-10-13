import { describe, expect, test } from "bun:test";
import { parseGEDCOMDate } from "../src/gedcom/date";

describe("gedcom DATE parser", () => {
  test("exact and partial dates carry no qualifier", () => {
    expect(parseGEDCOMDate("2 JUN 1985")).toEqual({});
    expect(parseGEDCOMDate("JUN 1985")).toEqual({});
    expect(parseGEDCOMDate("1985")).toEqual({});
  });

  test("modifiers become qualifiers", () => {
    expect(parseGEDCOMDate("ABT 1985").qualifier).toBe("ABT");
    expect(parseGEDCOMDate("CAL JUN 1985").qualifier).toBe("CAL");
    expect(parseGEDCOMDate("EST 1985").qualifier).toBe("EST");
    expect(parseGEDCOMDate("BEF 2 JUN 1985").qualifier).toBe("BEF");
    expect(parseGEDCOMDate("AFT 1985").qualifier).toBe("AFT");
  });

  test("BET x AND y becomes a BET range", () => {
    expect(parseGEDCOMDate("BET 1980 AND 1985")).toEqual({
      qualifier: "BET",
      range: { from: "1980", to: "1985" },
    });
  });

  test("FROM/TO periods map to ranges", () => {
    expect(parseGEDCOMDate("FROM 1980 TO 1985")).toEqual({
      qualifier: "FROM",
      range: { from: "1980", to: "1985" },
    });
    expect(parseGEDCOMDate("FROM 1980")).toEqual({
      qualifier: "FROM",
      range: { from: "1980" },
    });
    expect(parseGEDCOMDate("TO 1985")).toEqual({
      qualifier: "TO",
      range: { to: "1985" },
    });
  });

  test("calendar escapes and dual years survive", () => {
    expect(parseGEDCOMDate("@#DJULIAN@ 3 APR 1750").calendar).toBe("JULIAN");
    expect(parseGEDCOMDate("JULIAN 3 APR 1750").calendar).toBe("JULIAN");
    expect(parseGEDCOMDate("1750/51")).toEqual({});
    expect(parseGEDCOMDate("")).toEqual({});
  });
});
