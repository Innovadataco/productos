import "server-only";
/**
 * De dónde y de cuándo es lo que calculó el sistema en la conciliación (frente fecha-hora-datos): para cada «Valor
 * sistema», el cierre del corte (o el valor de unidad del fondo de ese día) CON QUE SE CALCULÓ, cuándo lo trajo 008 y
 * de qué fuente. No es el vigente de hoy: es el vigente al instante de `calculadaEn` (traído antes y todavía no
 * retirado entonces). Las dos horas las pone `now()` de la base, así que se comparan entre sí. Entre los cierres de ese
 * día se elige con el MISMO orden que el cálculo (`primeroElegido`, src/conciliacion/esperado.ts: Yahoo primero, luego
 * el traído más recientemente); del fondo, el traído más recientemente. Límite conocido: una carga cuya transacción
 * empezó antes del cálculo y terminó después cuenta como vigente aunque el cálculo no la viera (las cargas y el
 * cálculo casi nunca se cruzan; si pasa, la frescura la marca DESACTUALIZADA al cambiar el valor).
 * Solo lectura, en una transacción REPEATABLE READ de solo lectura (enSoloLectura), con `select` explícito, y solo de
 * las especies y fondos cuyo valor se calculó. Lo corre la página (inv_app): lee `valor_unidad_fondo.fuente` y
 * `traidoEn`, que el rol de la IA no puede leer, por eso no va dentro de leerEntradas.
 */
import type { PrismaClient } from "@prisma/client";
import { primeroElegido } from "@/conciliacion/esperado";
import { enSoloLectura, type LecturaConciliacion } from "@/conciliacion/leer";
import { idsCalculados } from "./calculados";

export { idsCalculados } from "./calculados";

export interface Origen {
  readonly fuente: string;
  readonly traidoEn: Date;
}

export interface LecturaProcedencias {
  /** Por especie (instrumentoId): el cierre del corte con que se calculó su valor. */
  readonly cierres: ReadonlyMap<string, Origen>;
  /** Por fondo (instrumentoId): el valor de unidad del corte con que se calculó. */
  readonly fondos: ReadonlyMap<string, Origen>;
}

export const SIN_PROCEDENCIAS: LecturaProcedencias = Object.freeze({ cierres: new Map(), fondos: new Map() });

interface Pedido {
  readonly corte: Date;
  readonly calculadaEn: Date;
  readonly especies: readonly string[];
  readonly fondos: readonly string[];
}

/** Vigente al instante del cálculo: traído antes (o en ese instante) y no retirado todavía. */
const vigenteAl = (calculadaEn: Date) => ({ traidoEn: { lte: calculadaEn }, OR: [{ reemplazadoEn: null }, { reemplazadoEn: { gt: calculadaEn } }] });

/** El primero de cada clave, en el orden dado. */
function primeroPorClave<T>(filas: readonly T[], clave: (f: T) => string, orden: (a: T, b: T) => number): Map<string, T> {
  const elegidos = new Map<string, T>();
  for (const f of [...filas].sort(orden)) if (!elegidos.has(clave(f))) elegidos.set(clave(f), f);
  return elegidos;
}

const origen = (f: Origen): Origen => ({ fuente: f.fuente, traidoEn: f.traidoEn });
const masReciente = (a: Origen, b: Origen): number => b.traidoEn.getTime() - a.traidoEn.getTime();

export async function leerProcedencias(db: PrismaClient, p: Pedido): Promise<LecturaProcedencias> {
  if (p.especies.length === 0 && p.fondos.length === 0) return SIN_PROCEDENCIAS;
  return enSoloLectura(db, async (tx) => {
    const cierres = p.especies.length === 0 ? [] : await tx.precioCierre.findMany({
      where: { instrumentoId: { in: [...p.especies] }, fecha: p.corte, ...vigenteAl(p.calculadaEn) },
      select: { instrumentoId: true, fuente: true, traidoEn: true },
    });
    const valores = p.fondos.length === 0 ? [] : await tx.valorUnidadFondo.findMany({
      where: { fondoId: { in: [...p.fondos] }, fechaValor: p.corte, ...vigenteAl(p.calculadaEn) },
      select: { fondoId: true, fuente: true, traidoEn: true },
    });
    const porEspecie = primeroPorClave(cierres, (c) => c.instrumentoId, primeroElegido);
    const porFondo = primeroPorClave(valores, (v) => v.fondoId, masReciente);
    return {
      cierres: new Map([...porEspecie].map(([id, c]) => [id, origen(c)])),
      fondos: new Map([...porFondo].map(([id, v]) => [id, origen(v)])),
    };
  });
}

/** Las procedencias de la conciliación que se muestra; sin conciliación guardada, ninguna (no se lee nada). */
export function procedenciasDeLaLectura(db: PrismaClient, l: LecturaConciliacion): Promise<LecturaProcedencias> {
  const k = l.conciliacion;
  if (k === null) return Promise.resolve(SIN_PROCEDENCIAS);
  return leerProcedencias(db, { corte: l.fechaCorte, calculadaEn: k.calculadaEn, ...idsCalculados(k) });
}
