/**
 * Camino ÚNICO de escritura del valor de unidad diario de los fondos (FIC): lo usan `actualizar-fondo` (la SFC
 * directa, `actualizar.ts`) e `importar-valores-fondo` (el CSV que exporta el Mac, `importar.ts`). Candado:
 * tests/unit/fondo/camino-unico.test.ts.
 * - Versionado: si la SFC revisa un dato, el anterior queda con `reemplazadoEn` (historia) y se inserta el nuevo;
 *   un dato igual no se toca (reimportar el mismo CSV no escribe). Si no trae el valor del fondo, no se pierde el guardado.
 * - Por lotes de TAMANO_LOTE días, cada uno en una transacción: una lectura de los vigentes, la comparación en
 *   memoria, un reemplazo y una inserción. Nada de consultas por día.
 * - Carreras con otra corrida (el vigente ya fue reemplazado, o P2002 por el índice parcial único): se deshace el
 *   lote y se reintenta releyendo; lo que la otra corrida ya guardó igual queda «sin cambios».
 * - La fuente es siempre la SFC (`sfc:qhpu-8ixx`): se traiga directo o en el CSV, es el mismo dato.
 * - El fallo de un fondo o de un lote no aborta los demás: se informa con código, nombre y código del error, nunca
 *   su mensaje.
 * - El retraso normal (1 a 2 días hábiles) no es error. Se avisa atraso solo si el último dato vigente es anterior a
 *   `hasta` − DIAS_ATRASO_AVISO.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { detalleDeError } from "../precios/actualizar";
import { FUENTE_SFC, type ResultadoSfc, type ValorDia } from "./sfc";

export const DIAS_ATRASO_AVISO = 7;
export const TAMANO_LOTE = 500;
export const MAX_INTENTOS = 3;
const MS_POR_DIA = 86_400_000;

export interface FalloFondo {
  readonly instrumentoId: string;
  readonly codigo: string;
  /** Solo nombre y código del error (p. ej. «PrismaClientKnownRequestError P2002»); nunca el mensaje. */
  readonly detalle?: string;
  readonly guardados: number;
  readonly conError: number;
  readonly descartados: number;
}

export interface UltimoValor {
  readonly instrumentoId: string;
  readonly ultimaFecha: Date | null;
  readonly atrasado: boolean;
}

export interface ResultadoFondo {
  readonly fondos: number;
  readonly valoresNuevos: number;
  readonly valoresRevisados: number;
  readonly fallidos: readonly FalloFondo[];
  readonly ultimos: readonly UltimoValor[];
}

/** Un fondo y cómo traer sus valores (de la SFC o del CSV). `traer` puede lanzar (la base al leer la clase). */
export interface FondoAGuardar {
  readonly instrumentoId: string;
  readonly traer: () => Promise<ResultadoSfc>;
}

/** Los fondos a los que se les guardan valores: FIC activos con código de la SFC (y, si se dan, solo esos ids). */
export function dondeFondos(instrumentoIds?: readonly string[]): Prisma.InstrumentoWhereInput {
  return { tipo: "FIC", activo: true, codigoFic: { not: null }, ...(instrumentoIds ? { id: { in: [...instrumentoIds] } } : {}) };
}

interface Balance {
  readonly nuevos: number;
  readonly revisados: number;
  readonly fallo: FalloFondo | null;
}

interface Vigente {
  readonly id: string;
  readonly fechaValor: Date;
  readonly valorUnidad: Prisma.Decimal;
  readonly valorFondo: Prisma.Decimal | null;
}

/** Otra corrida reemplazó un vigente entre la lectura y el reemplazo: hay que releer. */
class ConflictoConcurrente extends Error {
  constructor() {
    super("conflicto");
    this.name = "ConflictoConcurrente";
  }
}

/** ¿El dato nuevo ya está? Un valor del fondo ausente (null) no cuenta como cambio. */
function mismoValor(vigente: Vigente, v: ValorDia): boolean {
  if (!vigente.valorUnidad.equals(v.valorUnidad)) return false;
  if (v.valorFondo === null) return true;
  return vigente.valorFondo !== null && vigente.valorFondo.equals(v.valorFondo);
}

/** En memoria: qué entra nuevo y qué reemplaza a un vigente distinto. Lo igual se omite. */
function clasificar(lote: readonly ValorDia[], vigentes: readonly Vigente[]): { nuevos: ValorDia[]; revisados: { valor: ValorDia; idVigente: string }[] } {
  const porDia = new Map(vigentes.map((v) => [v.fechaValor.getTime(), v]));
  const nuevos: ValorDia[] = [];
  const revisados: { valor: ValorDia; idVigente: string }[] = [];
  for (const valor of lote) {
    const vigente = porDia.get(valor.fecha.getTime());
    if (!vigente) nuevos.push(valor);
    else if (!mismoValor(vigente, valor)) revisados.push({ valor, idVigente: vigente.id });
  }
  return { nuevos, revisados };
}

const filaNueva = (fondoId: string, v: ValorDia) => ({
  fondoId,
  fechaValor: v.fecha,
  valorUnidad: new Prisma.Decimal(v.valorUnidad),
  valorFondo: v.valorFondo === null ? null : new Prisma.Decimal(v.valorFondo),
  fuente: FUENTE_SFC,
});

/** Un lote en una transacción: leer vigentes, reemplazar los distintos e insertar. Todo o nada. */
async function guardarLote(db: PrismaClient, fondoId: string, lote: readonly ValorDia[]): Promise<{ nuevos: number; revisados: number }> {
  return db.$transaction(async (tx) => {
    const vigentes = await tx.valorUnidadFondo.findMany({
      where: { fondoId, reemplazadoEn: null, fechaValor: { in: lote.map((v) => v.fecha) } },
      select: { id: true, fechaValor: true, valorUnidad: true, valorFondo: true },
    });
    const { nuevos, revisados } = clasificar(lote, vigentes);
    if (revisados.length > 0) {
      const { count } = await tx.valorUnidadFondo.updateMany({ where: { id: { in: revisados.map((r) => r.idVigente) }, reemplazadoEn: null }, data: { reemplazadoEn: new Date() } });
      if (count !== revisados.length) throw new ConflictoConcurrente();
    }
    const aInsertar = [...nuevos, ...revisados.map((r) => r.valor)];
    if (aInsertar.length > 0) await tx.valorUnidadFondo.createMany({ data: aInsertar.map((v) => filaNueva(fondoId, v)) });
    return { nuevos: nuevos.length, revisados: revisados.length };
  });
}

const esConflicto = (e: unknown): boolean => e instanceof ConflictoConcurrente || (e as { code?: unknown } | null)?.code === "P2002";

async function guardarConReintento(db: PrismaClient, fondoId: string, lote: readonly ValorDia[]): Promise<{ nuevos: number; revisados: number }> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await guardarLote(db, fondoId, lote);
    } catch (err) {
      if (!esConflicto(err) || intento >= MAX_INTENTOS) throw err;
    }
  }
}

const fallo = (instrumentoId: string, codigo: string, extra: Partial<FalloFondo> = {}): FalloFondo => ({
  instrumentoId, codigo, guardados: 0, conError: 0, descartados: 0, ...extra,
});

/** Guarda la serie de un fondo por lotes; un lote fallido no frena los demás. */
async function guardarSerie(db: PrismaClient, fondoId: string, valores: readonly ValorDia[], descartados: number): Promise<Balance> {
  let [nuevos, revisados, guardados, conError] = [0, 0, 0, 0];
  let detalle: string | undefined;
  for (let i = 0; i < valores.length; i += TAMANO_LOTE) {
    const lote = valores.slice(i, i + TAMANO_LOTE);
    try {
      const r = await guardarConReintento(db, fondoId, lote);
      nuevos += r.nuevos;
      revisados += r.revisados;
      guardados += lote.length;
    } catch (err) {
      conError += lote.length;
      detalle ??= detalleDeError(err);
    }
  }
  const conteos = { guardados, conError, descartados, ...(detalle ? { detalle } : {}) };
  if (conError > 0) return { nuevos, revisados, fallo: fallo(fondoId, "GUARDADO_ERROR", conteos) };
  if (descartados > 0) return { nuevos, revisados, fallo: fallo(fondoId, "SFC_VALOR_INVALIDO", conteos) };
  return { nuevos, revisados, fallo: null };
}

/** Trae y guarda un fondo. Nunca lanza: todo fallo vuelve en el balance (si traer lanza, BASE_ERROR). */
async function procesarFondo(db: PrismaClient, fondo: FondoAGuardar): Promise<Balance> {
  let r: ResultadoSfc;
  try {
    r = await fondo.traer();
  } catch (err) {
    return { nuevos: 0, revisados: 0, fallo: fallo(fondo.instrumentoId, "BASE_ERROR", { detalle: detalleDeError(err) }) };
  }
  if (!r.ok) return { nuevos: 0, revisados: 0, fallo: fallo(fondo.instrumentoId, r.codigo) };
  return guardarSerie(db, fondo.instrumentoId, r.valores, r.descartados);
}

/** Último dato vigente de cada fondo, en una sola consulta agrupada, y si está atrasado frente a `hasta`. */
async function ultimosDe(db: PrismaClient, ids: readonly string[], hasta: Date): Promise<UltimoValor[]> {
  if (ids.length === 0) return [];
  const grupos = await db.valorUnidadFondo.groupBy({ by: ["fondoId"], where: { fondoId: { in: [...ids] }, reemplazadoEn: null }, _max: { fechaValor: true } });
  const porFondo = new Map(grupos.map((g) => [g.fondoId, g._max.fechaValor]));
  const limite = hasta.getTime() - DIAS_ATRASO_AVISO * MS_POR_DIA;
  return ids.map((instrumentoId) => {
    const ultimaFecha = porFondo.get(instrumentoId) ?? null;
    return { instrumentoId, ultimaFecha, atrasado: ultimaFecha === null || ultimaFecha.getTime() < limite };
  });
}

/** Trae y guarda los fondos en serie (uno que falla no detiene los demás) y lee el último dato de cada uno. */
export async function guardarValoresDeFondos(db: PrismaClient, fondos: readonly FondoAGuardar[], rango: { readonly hasta: Date }): Promise<ResultadoFondo> {
  let valoresNuevos = 0;
  let valoresRevisados = 0;
  const fallidos: FalloFondo[] = [];
  for (const f of fondos) {
    const balance = await procesarFondo(db, f);
    valoresNuevos += balance.nuevos;
    valoresRevisados += balance.revisados;
    if (balance.fallo) fallidos.push(balance.fallo);
  }
  let ultimos: UltimoValor[] = [];
  try {
    ultimos = await ultimosDe(db, fondos.map((f) => f.instrumentoId), rango.hasta);
  } catch (err) {
    const conFallo = new Set(fallidos.map((x) => x.instrumentoId));
    for (const f of fondos) if (!conFallo.has(f.instrumentoId)) fallidos.push(fallo(f.instrumentoId, "BASE_ERROR", { detalle: detalleDeError(err) }));
  }
  return { fondos: fondos.length, valoresNuevos, valoresRevisados, fallidos, ultimos };
}
