import { describe, it, expect } from "vitest";
import { encryptParameter, decryptParameter, isEncryptedValue, verifyEncryptionKey } from "./param-encryption";

const KEY = Buffer.from("a".repeat(32), "utf8");

describe("param-encryption", () => {
    it("cifra y descifra un valor", () => {
        const original = "mi-secreto-super-secreto";
        const encrypted = encryptParameter(original, KEY);
        expect(isEncryptedValue(encrypted)).toBe(true);
        expect(encrypted).not.toContain(original);

        const decrypted = decryptParameter(encrypted, KEY);
        expect(decrypted).toBe(original);
    });

    it("produce ciphertext distinto en cada llamada", () => {
        const original = "secreto";
        const a = encryptParameter(original, KEY);
        const b = encryptParameter(original, KEY);
        expect(a).not.toBe(b);
    });

    it("descifra texto plano como identidad", () => {
        const plain = "no-cifrado";
        expect(isEncryptedValue(plain)).toBe(false);
        expect(decryptParameter(plain, KEY)).toBe(plain);
    });

    it("verifica clave correcta", () => {
        expect(verifyEncryptionKey(KEY)).toBe(true);
    });

    it("falla al descifrar con clave incorrecta", () => {
        const encrypted = encryptParameter("secreto", KEY);
        const wrongKey = Buffer.from("b".repeat(32), "utf8");
        expect(() => decryptParameter(encrypted, wrongKey)).toThrow();
    });
});
