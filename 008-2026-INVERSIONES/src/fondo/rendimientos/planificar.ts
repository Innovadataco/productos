/**
 * Qué hacer con cada fila del CSV de rendimientos frente a lo ya registrado del fondo (frente fondo-rendimientos). Puro.
 * - Una fila sin hecho registrado con su fecha y tipo es NUEVA; con el mismo valor (como decimal), SIN_CAMBIOS.
 * - Con otro valor, VALOR_DISTINTO: lo registrado no se corrige (solo inserción) ni se duplica; rechaza el archivo.
 * - Ninguna fila puede ser anterior a la constitución del fondo (FECHA_ANTES_DE_LA_CONSTITUCION); la del mismo día, sí.
 */
import type { Prisma } from "@prisma/client";
import type { Hallazgo } from "../../datos-oficiales/registro/hallazgos";
import { claveFila, type FilaRendimiento, type TipoRendimiento } from "./csv";

/** Un hecho de rendimiento_fondo ya registrado, con lo que hace falta para planificar. */
export interface HechoGuardado {
  readonly fecha: Date;
  readonly tipo: TipoRendimiento;
  readonly valor: Prisma.Decimal;
  readonly filaFuenteId: string;
}

export type Plan = { readonly accion: "NUEVO" } | { readonly accion: "SIN_CAMBIOS"; readonly filaFuenteId: string };

export interface Planificado {
  readonly fila: FilaRendimiento;
  readonly plan: Plan;
}

export interface ConteosRendimientos {
  readonly filas: number;
  /** RENDIMIENTO nuevos (cada uno con su ajuste de caja). */
  readonly rendimientos: number;
  /** RETENCION nuevas (sin ajuste de caja). */
  readonly retenciones: number;
  readonly sinCambios: number;
}

function planDe(fila: FilaRendimiento, guardado: HechoGuardado | undefined, constitucion: Date): Plan | Hallazgo {
  if (fila.fecha.getTime() < constitucion.getTime()) return { linea: fila.linea, columna: "fecha", codigo: "FECHA_ANTES_DE_LA_CONSTITUCION" };
  if (guardado === undefined) return { accion: "NUEVO" };
  return guardado.valor.equals(fila.valor) ? { accion: "SIN_CAMBIOS", filaFuenteId: guardado.filaFuenteId } : { linea: fila.linea, columna: "valor", codigo: "VALOR_DISTINTO" };
}

/** `guardados`: los hechos del fondo por `claveFila` (fecha y tipo); `constitucion`: el día de su CONSTITUCION. */
export function planificarRendimientos(
  filas: readonly FilaRendimiento[], guardados: ReadonlyMap<string, HechoGuardado>, constitucion: Date,
): { readonly planes: readonly Planificado[]; readonly hallazgos: readonly Hallazgo[] } {
  const planes: Planificado[] = [];
  const hallazgos: Hallazgo[] = [];
  for (const fila of filas) {
    const r = planDe(fila, guardados.get(claveFila(fila)), constitucion);
    if ("codigo" in r) hallazgos.push(r);
    else planes.push({ fila, plan: r });
  }
  return { planes, hallazgos };
}

export function contarRendimientos(planes: readonly Planificado[]): ConteosRendimientos {
  const nuevos = (tipo: TipoRendimiento) => planes.filter((p) => p.plan.accion === "NUEVO" && p.fila.tipo === tipo).length;
  return { filas: planes.length, rendimientos: nuevos("RENDIMIENTO"), retenciones: nuevos("RETENCION"), sinCambios: planes.filter((p) => p.plan.accion === "SIN_CAMBIOS").length };
}

export const hayNuevos = (c: ConteosRendimientos): boolean => c.rendimientos + c.retenciones > 0;
