/**
 * Los dos campos cifrados del #11 (el esquema no cambia):
 * - fila_fuente.crudo (Json): guarda el sobre como objeto. Atado a (tipoFuente, claveNatural, ocurrencia).
 * - certificacion_fondo.encargo (String): guarda el sobre serializado. Atado a (certificacionId, instrumentoId).
 * Montos y cantidades en sus columnas NO se cifran.
 */
import { ErrorCifrado } from "./errores";
import type { Llavero } from "./llavero";
import { cifrar, clasificarSobre, descifrar, esSobre, type Contexto, type Sobre } from "./sobre";

export interface LlaveFilaFuente {
  readonly tipoFuente: string;
  readonly claveNatural: string;
  readonly ocurrencia: number;
}

export interface LlaveCertificacionFondo {
  readonly certificacionId: string;
  readonly instrumentoId: string;
}

/** Una fila cruda de CSV: encabezado → celda. */
export type Crudo = Readonly<Record<string, string>>;

/** Estado de un valor guardado: en claro (de antes del #11), sobre válido, o anómalo (no se toca). */
export type ClaseCampo = "claro" | "sobre" | "anomalo";

export const contextoCrudo = (l: LlaveFilaFuente): Contexto => ["fila_fuente.crudo", l.tipoFuente, l.claveNatural, l.ocurrencia];
export const contextoEncargo = (l: LlaveCertificacionFondo): Contexto => ["certificacion_fondo.encargo", l.certificacionId, l.instrumentoId];

export function esCrudo(valor: unknown): valor is Crudo {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor) && Object.values(valor).every((v) => typeof v === "string");
}

export function cifrarCrudo(crudo: Crudo, llave: LlaveFilaFuente, llavero?: Llavero): Sobre {
  return cifrar(JSON.stringify(crudo), contextoCrudo(llave), llavero);
}

export function descifrarCrudo(valor: unknown, llave: LlaveFilaFuente, llavero?: Llavero): Record<string, string> {
  const texto = descifrar(valor, contextoCrudo(llave), llavero);
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new ErrorCifrado("CONTENIDO_INVALIDO");
  }
  if (!esCrudo(crudo)) throw new ErrorCifrado("CONTENIDO_INVALIDO");
  return { ...crudo };
}

export function clasificarCrudo(valor: unknown): ClaseCampo {
  const clase = clasificarSobre(valor);
  if (clase !== "otro") return clase;
  return esCrudo(valor) ? "claro" : "anomalo";
}

export function cifrarEncargo(encargo: string, llave: LlaveCertificacionFondo, llavero?: Llavero): string {
  return JSON.stringify(cifrar(encargo, contextoEncargo(llave), llavero));
}

/** JSON.parse que no lanza: lo que no es JSON termina como SOBRE_INVALIDO al descifrar. */
function leerJson(texto: string): unknown {
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return undefined;
  }
}

export function descifrarEncargo(valor: string, llave: LlaveCertificacionFondo, llavero?: Llavero): string {
  return descifrar(leerJson(valor), contextoEncargo(llave), llavero);
}

/** Un encargo (identificador de cuenta) nunca empieza por «{»: si empieza y no es un sobre válido, es anómalo. */
export function clasificarEncargo(valor: string): ClaseCampo {
  if (!valor.trimStart().startsWith("{")) return "claro";
  return esSobre(leerJson(valor)) ? "sobre" : "anomalo";
}
