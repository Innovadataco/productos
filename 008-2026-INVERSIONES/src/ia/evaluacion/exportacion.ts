/**
 * El archivo de paquetes exportados (E7): lo imprime `scripts/exportar-hechos-ia.ts` (vía B, en producción) y lo lee el
 * arnés con `--paquetes` (en el Mac). Forma cerrada: `{ version: "exportacion-hechos-v1", paquetes: [<paquete>…] }`,
 * con un paquete por tipo como lo guarda `resumen_ia` (los campos de `PaqueteHechos`). Al leer, cada paquete vuelve a
 * entrar por `leerPaquete`: se reconstruye y su hash tiene que cuadrar; si no, el archivo entero se rechaza. Cierra en
 * fallo con códigos, sin repetir nada del archivo (trae cifras y nombres del portafolio).
 */
import { TIPOS_RESUMEN, type PaqueteHechos, type TipoResumen } from "../contrato";
import { esObjetoPlano, soloCampos } from "../formas";
import { esPaqueteConstruido, leerPaquete } from "../paquete";
import type { CasoEvaluacion } from "./tipos";

export const VERSION_EXPORTACION = "exportacion-hechos-v1";
/** Tres paquetes de hasta 99 hechos caben de sobra. */
export const MAX_BYTES_EXPORTACION = 2 * 1024 * 1024;

export const CODIGOS_ERROR_EXPORTACION = Object.freeze([
  "DEMASIADO_GRANDE", "JSON_INVALIDO", "FORMA_INVALIDA", "VERSION_DISTINTA", "SIN_PAQUETES", "TIPO_REPETIDO", "PAQUETE_INVALIDO",
] as const);
export type CodigoErrorExportacion = (typeof CODIGOS_ERROR_EXPORTACION)[number];

export class ErrorExportacion extends Error {
  override readonly name = "ErrorExportacion";
  constructor(readonly codigo: CodigoErrorExportacion) {
    super(`Paquetes exportados: ${codigo}.`);
  }
}

const CAMPOS: readonly string[] = Object.freeze(["version", "paquetes"]);

function exigirTiposUnicos(tipos: readonly TipoResumen[]): void {
  if (tipos.length === 0) throw new ErrorExportacion("SIN_PAQUETES");
  if (new Set(tipos).size !== tipos.length) throw new ErrorExportacion("TIPO_REPETIDO");
}

/** El JSON del export: los paquetes construidos, en el orden de los tipos del contrato. */
export function serializarExportacion(paquetes: readonly PaqueteHechos[]): string {
  if (!paquetes.every(esPaqueteConstruido)) throw new ErrorExportacion("PAQUETE_INVALIDO");
  exigirTiposUnicos(paquetes.map((p) => p.tipo));
  const ordenados = [...paquetes].sort((a, b) => TIPOS_RESUMEN.indexOf(a.tipo) - TIPOS_RESUMEN.indexOf(b.tipo));
  return `${JSON.stringify({ version: VERSION_EXPORTACION, paquetes: ordenados })}\n`;
}

function aJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new ErrorExportacion("JSON_INVALIDO");
  }
}

function reconstruir(guardado: unknown): PaqueteHechos {
  try {
    return leerPaquete(guardado);
  } catch {
    throw new ErrorExportacion("PAQUETE_INVALIDO");
  }
}

/** Los casos del archivo exportado (uno por tipo, con id = el tipo), con sus paquetes reconstruidos. */
export function leerExportacion(bytes: Uint8Array): readonly CasoEvaluacion[] {
  if (bytes.byteLength > MAX_BYTES_EXPORTACION) throw new ErrorExportacion("DEMASIADO_GRANDE");
  const raiz = aJson(bytes);
  if (!esObjetoPlano(raiz) || !soloCampos(raiz, CAMPOS)) throw new ErrorExportacion("FORMA_INVALIDA");
  if (raiz.version !== VERSION_EXPORTACION) throw new ErrorExportacion("VERSION_DISTINTA");
  if (!Array.isArray(raiz.paquetes)) throw new ErrorExportacion("FORMA_INVALIDA");
  const paquetes = (raiz.paquetes as readonly unknown[]).map(reconstruir);
  exigirTiposUnicos(paquetes.map((p) => p.tipo));
  return Object.freeze(paquetes.map((paquete) => Object.freeze({ id: paquete.tipo, tipo: paquete.tipo, paquete })));
}
