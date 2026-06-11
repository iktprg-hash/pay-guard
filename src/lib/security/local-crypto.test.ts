import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.stubGlobal("crypto", webcrypto);
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});
vi.stubGlobal("btoa", (value: string) => Buffer.from(value, "binary").toString("base64"));
vi.stubGlobal(
  "atob",
  (value: string) => Buffer.from(value, "base64").toString("binary")
);

beforeEach(() => {
  storage.clear();
  vi.resetModules();
});

describe("local-crypto", () => {
  it("encrypts and decrypts payloads", async () => {
    const { encryptLocalPayload, decryptLocalPayload, isEncryptedPayload } =
      await import("@/lib/security/local-crypto");

    const encrypted = await encryptLocalPayload(
      JSON.stringify({ debts: [{ creditor: "Bank", amount: 1000 }] })
    );

    expect(isEncryptedPayload(encrypted)).toBe(true);
    expect(encrypted).not.toContain("Bank");

    const decrypted = await decryptLocalPayload(encrypted);
    expect(decrypted).toContain("Bank");
  });

  it("returns legacy plaintext unchanged", async () => {
    const { decryptLocalPayload } = await import("@/lib/security/local-crypto");
    const legacy = '{"messages":[]}';
    expect(await decryptLocalPayload(legacy)).toBe(legacy);
  });

  it("clearLocalCryptoKey forces new key on next encrypt", async () => {
    const mod = await import("@/lib/security/local-crypto");
    const first = await mod.encryptLocalPayload("secret-a");
    mod.clearLocalCryptoKey();
    const second = await mod.encryptLocalPayload("secret-b");
    expect(first).not.toBe(second);
  });
});
