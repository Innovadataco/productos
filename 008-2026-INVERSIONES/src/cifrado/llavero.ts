/**
 * Claves AES-256 con versión (#11), como la KEK de PI:
 *   CIFRADO_CLAVE_ACTIVA=v<n>   con qué versión se cifra lo nuevo;
 *   CIFRADO_CLAVE_V<n>=<base64> una por versión (32 bytes); las anteriores siguen cargadas para descifrar.
 * Se lee al usarse, nunca al importar el módulo (next build corre sin secretos). No hay clave por
 * defecto en ningún entorno: la base local tiene datos reales y una clave pública no los protegería.
 */
import { createHash } from "node:crypto";
import { decodificarBase64Estricta } from "./base64";
import { ErrorCifrado } from "./errores";

export const LARGO_CLAVE = 32;
const PREFIJO = "CIFRADO_CLAVE_V";
/** Versiones v1…v999999: acotadas para que un `kid` ajeno no meta texto largo en un mensaje. */
const NOMBRE = /^CIFRADO_CLAVE_V([1-9][0-9]{0,5})$/;
const VERSION = /^v[1-9][0-9]{0,5}$/;

export interface Llavero {
  /** Versión con la que se cifra («v1», «v2», …). */
  readonly activa: string;
  /** Clave de 32 bytes por versión: la activa y las anteriores que sigan cargadas. */
  readonly claves: ReadonlyMap<string, Buffer>;
}

export type Entorno = Readonly<Record<string, string | undefined>>;

type Valores = readonly (readonly [nombre: string, valor: string])[];

/** Un solo llavero en caché, atado (por SHA-256, sin guardar los base64) a las variables que lo formaron. */
let enCache: { readonly firma: string; readonly llavero: Llavero } | null = null;

export const esVersion = (texto: string): boolean => VERSION.test(texto);

function construir(activa: string, valores: Valores): Llavero {
  if (activa === "") throw new ErrorCifrado("CLAVE_ACTIVA_AUSENTE");
  if (!esVersion(activa)) throw new ErrorCifrado("CLAVE_ACTIVA_INVALIDA");
  const claves = new Map<string, Buffer>();
  for (const [nombre, valor] of valores) {
    const numero = NOMBRE.exec(nombre)?.[1];
    if (!numero) throw new ErrorCifrado("CLAVE_NOMBRE_INVALIDO");
    const version = `v${numero}`;
    const bytes = decodificarBase64Estricta(valor);
    if (!bytes || bytes.length !== LARGO_CLAVE) throw new ErrorCifrado("CLAVE_INVALIDA", version);
    claves.set(version, bytes);
  }
  if (!claves.has(activa)) throw new ErrorCifrado("CLAVE_AUSENTE", activa);
  return { activa, claves };
}

/**
 * El llavero del entorno. Falla cerrado (ErrorCifrado) sin la activa, con la activa mal escrita o sin
 * su clave, o si cualquier CIFRADO_CLAVE_V<n> no es base64 estricta de 32 bytes. Un valor vacío no se carga.
 */
export function obtenerLlavero(entorno: Entorno = process.env): Llavero {
  const activa = entorno.CIFRADO_CLAVE_ACTIVA?.trim() ?? "";
  const valores: Valores = Object.entries(entorno)
    .filter(([nombre]) => nombre.startsWith(PREFIJO))
    .map(([nombre, valor]) => [nombre, valor?.trim() ?? ""] as const)
    .filter(([, valor]) => valor !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const firma = createHash("sha256").update(JSON.stringify([activa, valores])).digest("hex");
  if (enCache?.firma === firma) return enCache.llavero;
  const llavero = construir(activa, valores);
  enCache = { firma, llavero };
  return llavero;
}
