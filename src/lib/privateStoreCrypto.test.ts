import { beforeAll, describe, expect, it } from "vitest";
import { createPrivateStore, unlockPrivateStore, encryptPrivateEntry, decryptPrivateEntry, generatePrivatePassword, type PrivateScope } from "./privateStoreCrypto";
import { privateConfigSchema, type PrivateConfig, type PrivateEnvelope, type PrivateEntry } from "@contracts/privateStore";

const scope: PrivateScope = { userId: 7, origin: "https://locat.example", module: "secrets" };
const passphrase = "a separate long store passphrase";
const entry: PrivateEntry = { kind: "credential", name: "Private account", folder: "Personal", username: "secret-user", password: "secret-password", url: "https://example.com", note: "Private note", createdAt: 1 };
let key: CryptoKey; let config: PrivateConfig; let envelope: PrivateEnvelope; let id: string;
beforeAll(async () => {
  ({ key, config } = await createPrivateStore(passphrase, scope));
  id = crypto.randomUUID();
  envelope = await encryptPrivateEntry(key, config, scope, id, entry);
});
describe("private store authenticated client encryption", () => {
  it("restores a nonextractable master key and never uploads plaintext metadata", async () => {
    const restored = await unlockPrivateStore(passphrase, config, scope);
    expect(restored.extractable).toBe(false);
    expect(await decryptPrivateEntry(restored, config, scope, id, envelope)).toEqual(entry);
    for (const secret of [entry.name, entry.username, entry.password, entry.note]) expect(JSON.stringify({ config, envelope })).not.toContain(secret);
    await expect(crypto.subtle.exportKey("raw", restored)).rejects.toThrow();
    const second = await encryptPrivateEntry(key, config, scope, id, entry);
    expect(second.iv).not.toBe(envelope.iv);
  });
  it("rejects wrong passphrases, tampering and cross-account/server/module/object substitution", async () => {
    await expect(unlockPrivateStore("wrong", config, scope)).rejects.toThrow();
    for (const changed of [{ ...scope, userId: 8 }, { ...scope, origin: "https://other.example" }, { ...scope, module: "vault" as const }]) {
      await expect(decryptPrivateEntry(key, config, changed, id, envelope)).rejects.toThrow();
    }
    await expect(decryptPrivateEntry(key, config, scope, crypto.randomUUID(), envelope)).rejects.toThrow();
    const data = (envelope.data[0] === "A" ? "B" : "A") + envelope.data.slice(1);
    await expect(decryptPrivateEntry(key, config, scope, id, { ...envelope, data })).rejects.toThrow();
  });
  it("bounds derivation parameters and requires a strong creation passphrase", async () => {
    expect(privateConfigSchema.safeParse({ ...config, iterations: 1 }).success).toBe(false);
    expect(privateConfigSchema.safeParse({ ...config, v: 2 }).success).toBe(false);
    expect(privateConfigSchema.safeParse({ ...config, wrappedKey: { ...config.wrappedKey, data: "A".repeat(100000) } }).success).toBe(false);
    await expect(createPrivateStore("short", scope)).rejects.toThrow("15");
  });
  it("validates encrypted file lengths and module contents", async () => {
    const vaultScope = { ...scope, module: "vault" as const };
    const file: PrivateEntry = { kind: "file", name: "../a.bin", folder: "", mime: "text/html", bytes: 3, data: "YWJj", createdAt: 1 };
    const fileEnvelope = await encryptPrivateEntry(key, config, vaultScope, id, file);
    expect(await decryptPrivateEntry(key, config, vaultScope, id, fileEnvelope)).toEqual(file);
    const incorrect = await encryptPrivateEntry(key, config, vaultScope, id, { ...file, bytes: 4 });
    await expect(decryptPrivateEntry(key, config, vaultScope, id, incorrect)).rejects.toThrow("length");
    await expect(encryptPrivateEntry(key, config, scope, id, file)).rejects.toThrow("module");
  });
  it("generates bounded random password-manager friendly passwords", () => {
    const generated = generatePrivatePassword();
    expect(generated).toHaveLength(24);
    expect(generatePrivatePassword()).not.toBe(generated);
    expect(() => generatePrivatePassword(8)).toThrow();
    expect(() => generatePrivatePassword(129)).toThrow();
  });
});
