// El JWT de la sesión (D-014): HS256 con jose, 8 horas exactas desde una sola lectura del reloj, y solo
// `sub` y `sesionVersion` (el rol sale de la base). Cualquier otra forma se rechaza.
import { SignJWT, UnsecuredJWT } from "jose";
import { describe, expect, it } from "vitest";
import { SESION_SEGUNDOS } from "@/auth/limites";
import { firmarToken, verificarToken } from "@/auth/token";

/** Claves inventadas para la prueba. */
const CLAVE = new TextEncoder().encode("k".repeat(32));
const OTRA_CLAVE = new TextEncoder().encode("q".repeat(32));
const AHORA = Date.UTC(2026, 10, 20, 15, 0, 0, 900);
const IAT = Math.floor(AHORA / 1000);

function decodificar(token: string): Record<string, unknown> {
  const cuerpo = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("firmarToken", () => {
  it("lleva solo sub, sesionVersion, iat y exp, con exp − iat = 8 h exactas", async () => {
    const token = await firmarToken({ sub: "u1", sesionVersion: 3 }, CLAVE, AHORA);
    const cuerpo = decodificar(token);
    expect(Object.keys(cuerpo).sort()).toEqual(["exp", "iat", "sesionVersion", "sub"]);
    expect(cuerpo).toEqual({ sub: "u1", sesionVersion: 3, iat: IAT, exp: IAT + SESION_SEGUNDOS });
    expect(SESION_SEGUNDOS).toBe(8 * 60 * 60);
  });

  it("la cabecera es HS256", async () => {
    const token = await firmarToken({ sub: "u1", sesionVersion: 1 }, CLAVE, AHORA);
    const cabecera = JSON.parse(Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8")) as { alg: string };
    expect(cabecera.alg).toBe("HS256");
  });
});

describe("verificarToken", () => {
  it("acepta un token propio dentro de las 8 h", async () => {
    const token = await firmarToken({ sub: "u1", sesionVersion: 2 }, CLAVE, AHORA);
    expect(await verificarToken(token, CLAVE, AHORA + 1000)).toEqual({ sub: "u1", sesionVersion: 2 });
  });

  it("rechaza un token vencido", async () => {
    const token = await firmarToken({ sub: "u1", sesionVersion: 1 }, CLAVE, AHORA);
    expect(await verificarToken(token, CLAVE, AHORA + (SESION_SEGUNDOS + 1) * 1000)).toBeNull();
  });

  it("rechaza un token firmado con otro secreto", async () => {
    const token = await firmarToken({ sub: "u1", sesionVersion: 1 }, OTRA_CLAVE, AHORA);
    expect(await verificarToken(token, CLAVE, AHORA)).toBeNull();
  });

  it("rechaza alg none y HS512", async () => {
    const sinFirma = new UnsecuredJWT({ sub: "u1", sesionVersion: 1 }).setIssuedAt(IAT).setExpirationTime(IAT + 60).encode();
    expect(await verificarToken(sinFirma, CLAVE, AHORA)).toBeNull();
    const hs512 = await new SignJWT({ sesionVersion: 1 }).setProtectedHeader({ alg: "HS512" }).setSubject("u1")
      .setIssuedAt(IAT).setExpirationTime(IAT + 60).sign(new TextEncoder().encode("k".repeat(64)));
    expect(await verificarToken(hs512, new TextEncoder().encode("k".repeat(64)), AHORA)).toBeNull();
  });

  it("rechaza claims de más (por ejemplo un rol) o sesionVersion que no es entero positivo", async () => {
    const firmar = (datos: Record<string, unknown>) =>
      new SignJWT(datos).setProtectedHeader({ alg: "HS256" }).setSubject("u1").setIssuedAt(IAT).setExpirationTime(IAT + 60).sign(CLAVE);
    expect(await verificarToken(await firmar({ sesionVersion: 1, rol: "DUENO" }), CLAVE, AHORA)).toBeNull();
    expect(await verificarToken(await firmar({ sesionVersion: 0 }), CLAVE, AHORA)).toBeNull();
    expect(await verificarToken(await firmar({ sesionVersion: "1" }), CLAVE, AHORA)).toBeNull();
    expect(await verificarToken(await firmar({}), CLAVE, AHORA)).toBeNull();
  });

  it("rechaza un token que dura más de 8 h", async () => {
    const largo = await new SignJWT({ sesionVersion: 1 }).setProtectedHeader({ alg: "HS256" }).setSubject("u1")
      .setIssuedAt(IAT).setExpirationTime(IAT + SESION_SEGUNDOS + 1).sign(CLAVE);
    expect(await verificarToken(largo, CLAVE, AHORA)).toBeNull();
  });

  it("rechaza basura y tokens enormes sin lanzar", async () => {
    expect(await verificarToken("no-es-un-jwt", CLAVE, AHORA)).toBeNull();
    expect(await verificarToken("a".repeat(5000), CLAVE, AHORA)).toBeNull();
    expect(await verificarToken("", CLAVE, AHORA)).toBeNull();
  });
});
