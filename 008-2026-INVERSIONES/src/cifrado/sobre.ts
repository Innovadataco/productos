/**
 * Sobre AES-256-GCM (#11): {"v":1,"kid":"v<n>","iv","tag","ct"} en base64.
 * - IV aleatorio de 12 bytes por sobre y etiqueta de 16 bytes (exigida también al descifrar).
 * - AAD = dominio + versión del sobre + contexto (tabla.campo y la llave de la fila): un sobre
 *   copiado a otra fila u otra columna no se autentica.
 * - `kid` es la versión de la clave: se cifra con la activa y se descifra con la que diga el sobre.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { decodificarBase64Estricta } from "./base64";
import { ErrorCifrado } from "./errores";
import { esVersion, obtenerLlavero, type Llavero } from "./llavero";

const ALGORITMO = "aes-256-gcm";
const LARGO_IV = 12;
const LARGO_ETIQUETA = 16;
const DOMINIO = "inv008";
const VERSION_SOBRE = 1;
const LLAVES_SOBRE = ["ct", "iv", "kid", "tag", "v"] as const;

export type Sobre = {
  readonly v: typeof VERSION_SOBRE;
  readonly kid: string;
  readonly iv: string;
  readonly tag: string;
  readonly ct: string;
};

/** Lo que ata el sobre a su lugar: `tabla.campo` y la llave de la fila. */
export type Contexto = readonly (string | number)[];

/** «sobre» válido; «anomalo»: tiene llaves de sobre pero no es válido; «otro»: no se parece a un sobre. */
export type ClaseSobre = "sobre" | "anomalo" | "otro";

const aad = (contexto: Contexto) => Buffer.from(JSON.stringify([DOMINIO, VERSION_SOBRE, ...contexto]), "utf8");
const esObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === "object" && valor !== null && !Array.isArray(valor);
const bytesDe = (valor: unknown): number | null => (typeof valor === "string" ? (decodificarBase64Estricta(valor)?.length ?? null) : null);

export function esSobre(valor: unknown): valor is Sobre {
  if (!esObjeto(valor)) return false;
  if (Object.keys(valor).sort().join(",") !== LLAVES_SOBRE.join(",")) return false;
  const { v, kid, iv, tag, ct } = valor;
  return v === VERSION_SOBRE && typeof kid === "string" && esVersion(kid) && bytesDe(iv) === LARGO_IV && bytesDe(tag) === LARGO_ETIQUETA && bytesDe(ct) !== null;
}

export function clasificarSobre(valor: unknown): ClaseSobre {
  if (esSobre(valor)) return "sobre";
  return esObjeto(valor) && LLAVES_SOBRE.some((llave) => llave in valor) ? "anomalo" : "otro";
}

export function cifrar(texto: string, contexto: Contexto, llavero: Llavero = obtenerLlavero()): Sobre {
  const clave = llavero.claves.get(llavero.activa);
  if (!clave) throw new ErrorCifrado("CLAVE_AUSENTE", llavero.activa);
  const iv = randomBytes(LARGO_IV);
  const cifrador = createCipheriv(ALGORITMO, clave, iv, { authTagLength: LARGO_ETIQUETA });
  cifrador.setAAD(aad(contexto));
  const ct = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  return { v: VERSION_SOBRE, kid: llavero.activa, iv: iv.toString("base64"), tag: cifrador.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}

/** Descifra con la clave de la versión del sobre. Falla cerrado: nunca devuelve un valor en claro sin autenticar. */
export function descifrar(valor: unknown, contexto: Contexto, llavero: Llavero = obtenerLlavero()): string {
  if (!esSobre(valor)) throw new ErrorCifrado("SOBRE_INVALIDO");
  const clave = llavero.claves.get(valor.kid);
  if (!clave) throw new ErrorCifrado("CLAVE_NO_DISPONIBLE", valor.kid);
  try {
    const descifrador = createDecipheriv(ALGORITMO, clave, Buffer.from(valor.iv, "base64"), { authTagLength: LARGO_ETIQUETA });
    descifrador.setAAD(aad(contexto));
    descifrador.setAuthTag(Buffer.from(valor.tag, "base64"));
    return Buffer.concat([descifrador.update(Buffer.from(valor.ct, "base64")), descifrador.final()]).toString("utf8");
  } catch {
    // El error de Node no se propaga (ni como causa): solo dice que la etiqueta no cuadró.
    throw new ErrorCifrado("AUTENTICACION_FALLIDA");
  }
}
