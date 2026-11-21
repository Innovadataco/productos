/**
 * Argumentos de scripts/actualizar-fondo.ts. Dos modos:
 *   actualizar: [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]   (por defecto, los últimos 10 días hasta hoy en Bogotá)
 *   registrar:  --registrar --codigo <codigo_negocio> [--participacion <tipo_participacion>] --nombre "<nombre>"
 * Puro: no toca la base ni la red.
 */
import { parseArgs } from "node:util";
import { leerFechaIso } from "../importacion/trii/valores";
import { fechaEnBogota } from "../precios/horario";
import { validarRegistroFondo, type DatosRegistroFondo, type ErrorCampo } from "./registrar";

export const DIAS_POR_DEFECTO = 10;
const MS_POR_DIA = 86_400_000;

export type Argumentos =
  | { ok: true; modo: "actualizar"; desde: Date; hasta: Date }
  | { ok: true; modo: "registrar"; datos: DatosRegistroFondo; hoy: Date }
  | { ok: false; errores: ErrorCampo[] };

interface Valores {
  readonly desde?: string | undefined;
  readonly hasta?: string | undefined;
  readonly registrar?: boolean | undefined;
  readonly codigo?: string | undefined;
  readonly participacion?: string | undefined;
  readonly nombre?: string | undefined;
}

const invalidos = (): Argumentos => ({ ok: false, errores: [{ campo: "argumentos", codigo: "ARGUMENTOS_INVALIDOS" }] });

function leer(args: readonly string[]): Valores | null {
  try {
    return parseArgs({
      args: [...args],
      strict: true,
      allowPositionals: false,
      options: {
        desde: { type: "string" }, hasta: { type: "string" }, registrar: { type: "boolean" },
        codigo: { type: "string" }, participacion: { type: "string" }, nombre: { type: "string" },
      },
    }).values;
  } catch {
    return null;
  }
}

function rango(v: Valores, hoy: Date): Argumentos {
  const hasta = v.hasta === undefined ? { ok: true as const, valor: hoy } : leerFechaIso(v.hasta);
  if (!hasta.ok) return { ok: false, errores: [{ campo: "hasta", codigo: hasta.codigo }] };
  const desde = v.desde === undefined ? { ok: true as const, valor: new Date(hasta.valor.getTime() - DIAS_POR_DEFECTO * MS_POR_DIA) } : leerFechaIso(v.desde);
  if (!desde.ok) return { ok: false, errores: [{ campo: "desde", codigo: desde.codigo }] };
  if (desde.valor > hasta.valor) return { ok: false, errores: [{ campo: "rango", codigo: "RANGO_INVALIDO" }] };
  return { ok: true, modo: "actualizar", desde: desde.valor, hasta: hasta.valor };
}

export function interpretarArgumentos(args: readonly string[], ahora: Date): Argumentos {
  const v = leer(args);
  if (!v) return invalidos();
  const hoy = fechaEnBogota(ahora);
  const deRegistro = v.codigo !== undefined || v.participacion !== undefined || v.nombre !== undefined;
  if (v.registrar !== true) return deRegistro ? invalidos() : rango(v, hoy);
  if (v.desde !== undefined || v.hasta !== undefined) return invalidos();
  const datos = validarRegistroFondo({ codigo: v.codigo, participacion: v.participacion, nombre: v.nombre });
  return datos.ok ? { ok: true, modo: "registrar", datos: datos.valor, hoy } : { ok: false, errores: datos.errores };
}
