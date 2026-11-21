/**
 * Pre-sesión del TOTP: la clave fue correcta y falta el segundo paso. NO da acceso a nada: el proxy y
 * `exigirSesion` solo leen `__Host-sesion`, y esto es otro JWT, distinto en todo:
 * - otra cookie (`__Host-presesion`, src/auth/cookie.ts);
 * - otra clave: HKDF-SHA256 de AUTH_SECRET con su propio `info` (una firma de sesión no la verifica);
 * - otros claims, exactos: aud, jti, sub, sesionVersion, iat y exp (el JWT de sesión rechaza aud y jti);
 * - 5 minutos de vida.
 * En la base va el sha256 del `jti` (`Usuario.presesionHash`): solo vale la pre-sesión más reciente y se
 * borra al pasar el segundo paso. Módulo puro (jose y node:crypto): no lee la base ni el entorno.
 */
import { SignJWT, jwtVerify } from "jose";
import { createHash, hkdfSync, randomBytes } from "node:crypto";
import { PRESESION_SEGUNDOS } from "./limites";

export interface DatosPresesion {
  readonly sub: string;
  readonly sesionVersion: number;
  readonly jti: string;
}

export const AUDIENCIA_PRESESION = "inv008:presesion";

const ALGORITMO = "HS256";
const INFO_HKDF = "inv008:presesion:v1";
const LARGO_CLAVE = 32;
const JTI_BYTES = 32;
const TOKEN_MAX = 1024;
const SUB_MAX = 64;
const FORMA_JTI = /^[A-Za-z0-9_-]{43}$/;
const CLAIMS = ["aud", "exp", "iat", "jti", "sesionVersion", "sub"].join(",");

/** La clave de la pre-sesión: HKDF-SHA256 de la de la sesión, sin sal y con su propio `info`. */
export const clavePresesion = (claveSesion: Uint8Array): Uint8Array =>
  new Uint8Array(hkdfSync("sha256", claveSesion, new Uint8Array(0), INFO_HKDF, LARGO_CLAVE));

export const generarJti = (): string => randomBytes(JTI_BYTES).toString("base64url");
export const hashJti = (jti: string): string => createHash("sha256").update(jti, "utf8").digest("hex");

export async function firmarPresesion(datos: DatosPresesion, claveSesion: Uint8Array, ahoraMs: number): Promise<string> {
  const iat = Math.floor(ahoraMs / 1000);
  return new SignJWT({ sesionVersion: datos.sesionVersion })
    .setProtectedHeader({ alg: ALGORITMO })
    .setAudience(AUDIENCIA_PRESESION)
    .setJti(datos.jti)
    .setSubject(datos.sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + PRESESION_SEGUNDOS)
    .sign(clavePresesion(claveSesion));
}

const esVersion = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 1;

/** Los datos de la pre-sesión, o null si no es nuestra, venció o no tiene la forma exacta. */
export async function verificarPresesion(token: string, claveSesion: Uint8Array, ahoraMs: number): Promise<DatosPresesion | null> {
  if (!token || token.length > TOKEN_MAX) return null;
  try {
    const { payload } = await jwtVerify(token, clavePresesion(claveSesion), {
      algorithms: [ALGORITMO],
      audience: AUDIENCIA_PRESESION,
      currentDate: new Date(ahoraMs),
    });
    const { sub, sesionVersion, jti, iat, exp } = payload;
    if (Object.keys(payload).sort().join(",") !== CLAIMS) return null;
    if (typeof sub !== "string" || sub.length === 0 || sub.length > SUB_MAX || !esVersion(sesionVersion)) return null;
    if (typeof jti !== "string" || !FORMA_JTI.test(jti)) return null;
    if (typeof iat !== "number" || typeof exp !== "number" || exp - iat > PRESESION_SEGUNDOS) return null;
    return { sub, sesionVersion, jti };
  } catch {
    return null;
  }
}
