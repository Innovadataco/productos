// Contraseñas (D-014): bcrypt de costo 12, de 12 a 72 bytes, y comparación contra un hash señuelo
// cuando la cuenta no existe o no tiene clave (el tiempo de respuesta no revela qué usuarios existen).
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HASH_SENUELO, compararClave, hashClave, largoValido } from "@/auth/clave";

/** Contraseñas inventadas para la prueba. */
const CLAVE = "clave-ficticia-de-prueba";
const OTRA = "otra-clave-ficticia-008";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("largoValido", () => {
  it("admite de 12 a 72 bytes", () => {
    expect(largoValido("a".repeat(11))).toBe(false);
    expect(largoValido("a".repeat(12))).toBe(true);
    expect(largoValido("a".repeat(72))).toBe(true);
    expect(largoValido("a".repeat(73))).toBe(false);
  });

  it("cuenta bytes UTF-8: 36 «ñ» son 72 bytes y 37 ya no caben", () => {
    expect(largoValido("ñ".repeat(36))).toBe(true);
    expect(largoValido("ñ".repeat(37))).toBe(false);
    expect(largoValido("ñ".repeat(6))).toBe(true);
    expect(largoValido("ñ".repeat(5))).toBe(false);
  });
});

describe("hashClave y compararClave", () => {
  it("el hash es bcrypt de costo 12 y verifica solo la clave correcta", async () => {
    const hash = await hashClave(CLAVE);
    expect(hash).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    expect(await compararClave(CLAVE, hash)).toBe(true);
    expect(await compararClave(OTRA, hash)).toBe(false);
  });

  it("se niega a hashear una clave fuera de 12 a 72 bytes", async () => {
    await expect(hashClave("corta")).rejects.toThrow(/12 y 72 bytes/);
    await expect(hashClave("a".repeat(73))).rejects.toThrow(/12 y 72 bytes/);
  });

  it("el señuelo es un hash bcrypt de costo 12 válido", () => {
    expect(HASH_SENUELO).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
  });

  it("sin hash (cuenta inexistente o sin clave) igual corre bcrypt contra el señuelo y da false", async () => {
    const espia = vi.spyOn(bcrypt, "compare");
    expect(await compararClave(CLAVE, null)).toBe(false);
    expect(espia).toHaveBeenCalledWith(CLAVE, HASH_SENUELO);
  });

  it("una clave de largo inválido igual corre bcrypt (contra el señuelo) y da false", async () => {
    const hash = await hashClave(CLAVE);
    const espia = vi.spyOn(bcrypt, "compare");
    expect(await compararClave("a".repeat(73), hash)).toBe(false);
    expect(espia).toHaveBeenCalledTimes(1);
    expect(espia.mock.calls[0]?.[1]).toBe(HASH_SENUELO);
  });
});
