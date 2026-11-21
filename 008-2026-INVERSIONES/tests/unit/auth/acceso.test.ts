// Enlace de un solo uso (D-014): token aleatorio de 32 bytes en base64url; en la base solo su sha256.
import { describe, expect, it } from "vitest";
import { formaDeToken, generarToken, hashToken } from "@/auth/acceso";

describe("generarToken", () => {
  it("son 32 bytes aleatorios en base64url (43 caracteres), distintos cada vez", () => {
    const a = generarToken();
    const b = generarToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(a).not.toBe(b);
    expect(formaDeToken(a)).toBe(true);
  });
});

describe("hashToken", () => {
  it("es el sha256 en hexadecimal (vector conocido de «abc»)", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("formaDeToken", () => {
  it("rechaza lo que no puede ser un token propio, sin tocar la base", () => {
    for (const malo of ["", "corto", "a".repeat(42), "a".repeat(129), `${"a".repeat(43)}=`, `${"a".repeat(42)}+`]) {
      expect(formaDeToken(malo), malo).toBe(false);
    }
  });
});
