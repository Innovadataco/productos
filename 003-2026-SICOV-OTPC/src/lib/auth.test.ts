// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  validarPassword,
} from "@/lib/auth";

describe("auth: contraseñas", () => {
  it("hashea y verifica una contraseña con bcrypt", async () => {
    const hash = await hashPassword("Admin123!");
    expect(hash).not.toBe("Admin123!");
    expect(await verifyPassword("Admin123!", hash)).toBe(true);
    expect(await verifyPassword("otra", hash)).toBe(false);
  });

  it("verifyPassword devuelve false ante hash vacío", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("auth: política de contraseña (regex del legacy)", () => {
  it.each([
    ["Admin123!", true],
    ["Vigilado123!", true],
    ["admin123!", false], // sin mayúscula
    ["ADMIN123!", false], // sin minúscula
    ["Adminabc!", false], // sin dígito
    ["Admin1234", false], // sin símbolo
    ["Ab1!", false], // < 8
  ])("valida %s => %s", (clave, esperado) => {
    expect(validarPassword(clave)).toBe(esperado);
  });
});

describe("auth: JWT (jose HS256)", () => {
  it("firma y verifica un token de sesión", async () => {
    const token = await createToken({ sub: 7, rol: 2, nit: "900853057" });
    const payload = await verifyToken(token);
    expect(payload?.sub).toBe(7);
    expect(payload?.rol).toBe(2);
    expect(payload?.nit).toBe("900853057");
  });

  it("verifyToken devuelve null ante un token inválido", async () => {
    expect(await verifyToken("no.es.un.jwt")).toBeNull();
  });
});
