import { describe, expect, test } from "bun:test";
import { SESSION_KEY, SESSION_SCRIPT, readStored, restoreMessage, shouldRestore, writeStored, type StorageLike } from "../src/app/session";

function mockStorage(initial?: string, options?: { failOnSet?: boolean; failOnGet?: boolean }): StorageLike & { data: string | null } {
  const data: string | null = initial ?? null;
  return {
    data,
    getItem: () => {
      if (options?.failOnGet) throw new Error("SecurityError");
      return data;
    },
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

  test("readStored returns the stored value or a failure flag", () => {
    expect(readStored(mockStorage())).toEqual({ value: null, failed: false });
    expect(readStored(mockStorage("data:text/plain;base64,AA=="))).toEqual({ value: "data:text/plain;base64,AA==", failed: false });
    expect(readStored(mockStorage(undefined, { failOnGet: true }))).toEqual({ value: null, failed: true });
  });

  test("writeStored reports ok and reports full when storage refuses", () => {
    expect(writeStored(mockStorage(), "value")).toBe("ok");
    expect(writeStored(mockStorage(undefined, { failOnSet: true }), "value")).toBe("full");
  });

  test("restoreMessage explains a failed restore and stays quiet otherwise", () => {
    expect(restoreMessage(true, false)).toContain("cannot restore");
    expect(restoreMessage(false, false)).toBeNull();
    expect(restoreMessage(true, true)).toBeNull();
  });

  test("the browser script covers status, import, and the storage key", () => {
    expect(SESSION_SCRIPT).toContain("/api/status");
    expect(SESSION_SCRIPT).toContain("/import");
    expect(SESSION_SCRIPT).toContain(SESSION_KEY);
  });

  test("the browser script uses the tested helpers and redirects home after restore", () => {
    expect(SESSION_SCRIPT).toContain("function shouldRestore");
    expect(SESSION_SCRIPT).toContain("function readStored");
    expect(SESSION_SCRIPT).toContain("function writeStored");
    expect(SESSION_SCRIPT).toContain("function restoreMessage");
    expect(SESSION_SCRIPT).toContain("location.href = '/'");
    expect(() => new Function(SESSION_SCRIPT)).not.toThrow();
  });
});
