// La pre-sesión del TOTP: la clave fue correcta y falta el segundo paso. Es otro JWT, con otra cookie
// (`__Host-presesion`), otra clave (derivada de AUTH_SECRET con HKDF), otros claims (aud y jti) y 5 min
// de vida. No sirve como sesión, ni la sesión sirve como pre-sesión: esa es la frontera que se prueba aquí.
import { SignJWT } from "jose";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PRESESION_SEGUNDOS } from "@/auth/limites";
import { AUDIENCIA_PRESESION, clavePresesion, firmarPresesion, generarJti, hashJti, verificarPresesion } from "@/auth/presesion";
import { firmarToken, verificarToken } from "@/auth/token";

/** Claves inventadas para la prueba. */
const CLAVE = new TextEncoder().encode("k".repeat(32));
const OTRA_CLAVE = new TextEncoder().encode("q".repeat(32));
const AHORA = Date.UTC(2026, 10, 21, 15, 0, 0, 400);
const IAT = Math.floor(AHORA / 1000);
const JTI = "j".repeat(43);
const DATOS = { sub: "u1", sesionVersion: 2, jti: JTI } as const;

const cuerpo = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;

/** Un JWT con la clave derivada y los claims que se quieran (para probar la forma exacta). */
const conClaims = (claims: Record<string, unknown>, iat = IAT, exp = IAT + PRESESION_SEGUNDOS) =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt(iat).setExpirationTime(exp).sign(clavePresesion(CLAVE));

describe("firmarPresesion", () => {
  it("lleva solo aud, jti, sub, sesionVersion, iat y exp, con 5 min exactos", async () => {
    const token = await firmarPresesion(DATOS, CLAVE, AHORA);
    expect(cuerpo(token)).toEqual({ aud: AUDIENCIA_PRESESION, jti: JTI, sub: "u1", sesionVersion: 2, iat: IAT, exp: IAT + PRESESION_SEGUNDOS });
    expect(PRESESION_SEGUNDOS).toBeLessThanOrEqual(300);
  });

  it("se verifica dentro de los 5 min y vence después", async () => {
    const token = await firmarPresesion(DATOS, CLAVE, AHORA);
    expect(await verificarPresesion(token, CLAVE, AHORA + 299_000)).toEqual(DATOS);
    expect(await verificarPresesion(token, CLAVE, AHORA + 301_000)).toBeNull();
  });
});

describe("la frontera entre sesión y pre-sesión", () => {
  it("la clave de la pre-sesión no es la de la sesión, y es estable", () => {
    expect(Buffer.from(clavePresesion(CLAVE)).equals(Buffer.from(CLAVE))).toBe(false);
    expect(Buffer.from(clavePresesion(CLAVE)).equals(Buffer.from(clavePresesion(CLAVE)))).toBe(true);
    expect(clavePresesion(CLAVE)).toHaveLength(32);
  });

  it("una pre-sesión no se acepta como sesión (ni con la clave de la sesión ni con la derivada)", async () => {
    const pre = await firmarPresesion(DATOS, CLAVE, AHORA);
    expect(await verificarToken(pre, CLAVE, AHORA)).toBeNull();
    expect(await verificarToken(pre, clavePresesion(CLAVE), AHORA)).toBeNull();
  });

  it("una sesión no se acepta como pre-sesión", async () => {
    const sesion = await firmarToken({ sub: "u1", sesionVersion: 2 }, CLAVE, AHORA);
    expect(await verificarPresesion(sesion, CLAVE, AHORA)).toBeNull();
  });

  it("una pre-sesión firmada con la clave de la sesión (sin derivar) no vale", async () => {
    const cruda = await new SignJWT({ aud: AUDIENCIA_PRESESION, jti: JTI, sesionVersion: 2 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuedAt(IAT)
      .setExpirationTime(IAT + PRESESION_SEGUNDOS)
      .sign(CLAVE);
    expect(await verificarPresesion(cruda, CLAVE, AHORA)).toBeNull();
  });
});

describe("verificarPresesion rechaza toda otra forma", () => {
  it("otra clave", async () => {
    expect(await verificarPresesion(await firmarPresesion(DATOS, OTRA_CLAVE, AHORA), CLAVE, AHORA)).toBeNull();
  });

  it("otra audiencia", async () => {
    expect(await verificarPresesion(await conClaims({ aud: "otra", jti: JTI, sub: "u1", sesionVersion: 2 }), CLAVE, AHORA)).toBeNull();
  });

  it("un claim de más o de menos", async () => {
    expect(await verificarPresesion(await conClaims({ aud: AUDIENCIA_PRESESION, jti: JTI, sub: "u1", sesionVersion: 2, rol: "DUENO" }), CLAVE, AHORA)).toBeNull();
    expect(await verificarPresesion(await conClaims({ aud: AUDIENCIA_PRESESION, sub: "u1", sesionVersion: 2 }), CLAVE, AHORA)).toBeNull();
  });

  it("una vida de más de 5 min, aunque no haya vencido", async () => {
    const larga = await conClaims({ aud: AUDIENCIA_PRESESION, jti: JTI, sub: "u1", sesionVersion: 2 }, IAT, IAT + PRESESION_SEGUNDOS + 1);
    expect(await verificarPresesion(larga, CLAVE, AHORA)).toBeNull();
  });

  it.each([
    ["un jti con otra forma", { aud: AUDIENCIA_PRESESION, jti: "corto", sub: "u1", sesionVersion: 2 }],
    ["una versión inválida", { aud: AUDIENCIA_PRESESION, jti: JTI, sub: "u1", sesionVersion: 0 }],
    ["un sub vacío", { aud: AUDIENCIA_PRESESION, jti: JTI, sub: "", sesionVersion: 2 }],
  ])("%s", async (_nombre, claims) => {
    expect(await verificarPresesion(await conClaims(claims), CLAVE, AHORA)).toBeNull();
  });

  it("un texto que no es JWT, vacío o enorme", async () => {
    expect(await verificarPresesion("", CLAVE, AHORA)).toBeNull();
    expect(await verificarPresesion("no.es.jwt", CLAVE, AHORA)).toBeNull();
    expect(await verificarPresesion("a".repeat(5000), CLAVE, AHORA)).toBeNull();
  });
});

describe("jti", () => {
  it("es de 32 bytes aleatorios en base64url y en la base va su sha256", () => {
    const a = generarJti();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generarJti()).not.toBe(a);
    expect(hashJti(a)).toBe(createHash("sha256").update(a, "utf8").digest("hex"));
  });
});
