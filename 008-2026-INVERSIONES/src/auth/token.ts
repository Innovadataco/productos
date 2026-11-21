/**
 * JWT de la sesión (D-014): HS256 con `jose`. Lleva solo `sub` y `sesionVersion`; el rol y si la
 * cuenta está activa salen de la base en cada página y API. Módulo puro: lo usa también el proxy.
 */
import { SignJWT, jwtVerify } from "jose";
import { SESION_SEGUNDOS } from "./limites";

export interface DatosSesion {
  readonly sub: string;
  readonly sesionVersion: number;
}

const ALGORITMO = "HS256";
/** Un JWT propio mide ~200 caracteres: lo que pase de esto se descarta sin verificar. */
const TOKEN_MAX = 1024;
const SUB_MAX = 64;
const CLAIMS = ["exp", "iat", "sesionVersion", "sub"].join(",");

/** `iat` y `exp` salen de una sola lectura del reloj: la sesión dura 8 h exactas. */
export async function firmarToken(datos: DatosSesion, clave: Uint8Array, ahoraMs: number): Promise<string> {
  const iat = Math.floor(ahoraMs / 1000);
  return new SignJWT({ sesionVersion: datos.sesionVersion })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(datos.sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESION_SEGUNDOS)
    .sign(clave);
}

const esVersion = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 1;

/** Los datos de la sesión, o null si el token no es nuestro, venció o no tiene la forma exacta. */
export async function verificarToken(token: string, clave: Uint8Array, ahoraMs: number): Promise<DatosSesion | null> {
  if (!token || token.length > TOKEN_MAX) return null;
  try {
    const { payload } = await jwtVerify(token, clave, { algorithms: [ALGORITMO], currentDate: new Date(ahoraMs) });
    const { sub, sesionVersion, iat, exp } = payload;
    if (Object.keys(payload).sort().join(",") !== CLAIMS) return null;
    if (typeof sub !== "string" || sub.length === 0 || sub.length > SUB_MAX || !esVersion(sesionVersion)) return null;
    if (typeof iat !== "number" || typeof exp !== "number" || exp - iat > SESION_SEGUNDOS) return null;
    return { sub, sesionVersion };
  } catch {
    return null;
  }
}
