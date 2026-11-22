/**
 * «Identificar modelos» (E8): lo que está instalado en el Ollama de un destino, con GET /api/tags y el mismo cliente de
 * la puerta local (destino solo de la tailnet, tope de bytes y de tiempo, sin redirecciones, solo esa ruta). Devuelve
 * el nombre, el tamaño y el digest de cada modelo; NO decide si se puede usar (eso es de la lista de PI, fuera de esta
 * carpeta). Lo llama la sonda del destino GUARDADO (src/ia/config/sonda-ollama.ts), nunca un destino del pedido.
 *
 * Nunca rechaza por la red: un Ollama inalcanzable vuelve como `FalloLocal` con su código, sin datos. Un destino o unas
 * opciones inválidos son un defecto del código y lanzan `ErrorLocal`, sin pedir nada.
 */
import { LIMITE_MAX_MS, LIMITE_MIN_MS, PATRON_MODELO } from "../generador";
import { esObjetoPlano } from "../formas";
import { leerDestinoLocal, urlLocal } from "./destino";
import { ErrorLocal, falloLocal, type FalloLocal } from "./errores";
import { BYTES_MAXIMOS_TAGS, pedirJsonLocal, type BuscarLocal } from "./http";
import { MAX_MODELOS_TAGS } from "./ollama";
import { abrirPlazo } from "./plazo";

/** Tope de entradas de /api/tags: el mismo de la verificación del modelo. Más es un cuerpo inválido (no se recorta). */
export const MAX_MODELOS_INSTALADOS = MAX_MODELOS_TAGS;

export interface ModeloInstalado {
  readonly nombre: string;
  /** Bytes, o null si no vino un entero no negativo. */
  readonly tamanoBytes: number | null;
  /** 64 hex en minúsculas (sin el prefijo «sha256:»), o null si no vino con esa forma. */
  readonly digest: string | null;
}

export type ResultadoIdentificacion = { readonly ok: true; readonly modelos: readonly ModeloInstalado[] } | FalloLocal;

export interface OpcionesIdentificacion {
  /** El límite de toda la consulta (entero, de LIMITE_MIN_MS a LIMITE_MAX_MS). */
  readonly limiteMs: number;
}

const DIGEST = /^(?:sha256:)?([0-9a-f]{64})$/;

function modeloDe(entrada: unknown): ModeloInstalado | null {
  if (!esObjetoPlano(entrada)) return null;
  const nombre = typeof entrada.name === "string" ? entrada.name : entrada.model;
  if (typeof nombre !== "string" || !PATRON_MODELO.test(nombre)) return null;
  const { size, digest } = entrada;
  const tamanoBytes = typeof size === "number" && Number.isSafeInteger(size) && size >= 0 ? size : null;
  const hex = typeof digest === "string" ? (DIGEST.exec(digest)?.[1] ?? null) : null;
  return Object.freeze({ nombre, tamanoBytes, digest: hex });
}

/** La lista de lo instalado, desde el cuerpo de /api/tags; null si no tiene la forma. */
export function leerModelosInstalados(datos: unknown): readonly ModeloInstalado[] | null {
  if (!esObjetoPlano(datos) || !Array.isArray(datos.models) || datos.models.length > MAX_MODELOS_INSTALADOS) return null;
  return Object.freeze((datos.models as readonly unknown[]).map(modeloDe).filter((m): m is ModeloInstalado => m !== null));
}

function revisarOpciones(opciones: OpcionesIdentificacion): number {
  const crudo: unknown = opciones;
  const limiteMs = esObjetoPlano(crudo) ? crudo.limiteMs : undefined;
  if (typeof limiteMs !== "number" || !Number.isInteger(limiteMs) || limiteMs < LIMITE_MIN_MS || limiteMs > LIMITE_MAX_MS) throw new ErrorLocal("LIMITE_INVALIDO");
  return limiteMs;
}

/** Lo instalado en el Ollama de `destino`. Lanza `ErrorLocal` solo con un destino o unas opciones inválidos. */
export async function identificarModelos(destino: string, dependencias: { readonly fetch: BuscarLocal }, opciones: OpcionesIdentificacion, senal?: AbortSignal): Promise<ResultadoIdentificacion> {
  const url = urlLocal(leerDestinoLocal(destino), "/api/tags");
  const limiteMs = revisarOpciones(opciones);
  if (senal?.aborted === true) return falloLocal("TIEMPO_AGOTADO", "SENAL_ABORTADA");
  const plazo = abrirPlazo(senal, limiteMs);
  try {
    const tags = await pedirJsonLocal(dependencias.fetch, url, { method: "GET" }, BYTES_MAXIMOS_TAGS, plazo);
    if (!tags.ok) return tags;
    const modelos = leerModelosInstalados(tags.datos);
    return modelos === null ? falloLocal("ERROR_PROVEEDOR", "CUERPO_INVALIDO") : Object.freeze({ ok: true, modelos });
  } finally {
    plazo.cerrar();
  }
}
