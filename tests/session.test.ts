import { describe, expect, test } from "bun:test";
import { SESSION_KEY, SESSION_SCRIPT, readStored, shouldRestore, writeStored, type StorageLike } from "../src/app/session";

function mockStorage(initial?: string, options?: { failOnSet?: boolean }): StorageLike & { data: string | null } {
  const data: string | null = initial ?? null;
  return {
    data,
    getItem: () => data,
    setItem: () => {
      if (options?.failOnSet) throw new Error("QuotaExceededError");
    },
  };
}

describe("session decision helpers", () => {
  test("restore only when the browser has a file and the server has no tree", () => {
    expect(shouldRestore(true, false)).toBe(true);
    expect(shouldRestore(true, true)).toBe(false);
    expect(shouldRestore(false, false)).toBe(false);
    expect(shouldRestore(false, true)).toBe(false);
  });

  test("readStored returns the stored value or null", () => {
    expect(readStored(mockStorage())).toBeNull();
    expect(readStored(mockStorage("data:text/plain;base64,AA=="))).toBe("data:text/plain;base64,AA==");
  });

  test("writeStored reports ok and reports full when storage refuses", () => {
    expect(writeStored(mockStorage(), "value")).toBe("ok");
    expect(writeStored(mockStorage(undefined, { failOnSet: true }), "value")).toBe("full");
  });

  test("the browser script covers status, import, and the storage key", () => {
    expect(SESSION_SCRIPT).toContain("/api/status");
    expect(SESSION_SCRIPT).toContain("/import");
    expect(SESSION_SCRIPT).toContain(SESSION_KEY);
  });
});
