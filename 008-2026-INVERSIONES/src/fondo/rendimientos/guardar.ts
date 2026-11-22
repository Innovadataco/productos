/**
 * Camino ÚNICO de escritura de rendimiento_fondo y de los ajustes de caja RENDIMIENTO_FIC (frente fondo-rendimientos).
 * Nada más en src/ ni en scripts/ crea un hecho de rendimiento ni un ajuste de esa categoría (candados
 * tests/unit/fondo/rendimientos/camino-unico.test.ts y tests/unit/fondo/camino-unico-movimiento.test.ts).
 * - Una sola transacción para todo el archivo: el candado consultivo del fondo (el mismo de la constitución:
 *   src/lib/candados.ts), y después se releen el fondo, su constitución y lo ya registrado y se vuelve a planificar. Si
 *   algo falla, no queda nada (tampoco la carga). Sin filas nuevas, no se escribe nada.
 * - Por cada fila nueva: su fila cruda, cifrada y atada a su llave natural (src/datos-oficiales/registro/carga.ts), y el
 *   hecho. Un RENDIMIENTO lleva además su ajuste de caja (+valor, RENDIMIENTO_FIC, fuente EXTRACTO, motivo fijo, el
 *   dueño como autor), creado antes que el hecho que lo enlaza. Una RETENCION es solo el hecho: el pago ya llega neto a
 *   la caja (restarla otra vez descontaría dos veces). La base exige la coherencia entre el hecho y su ajuste.
 * - La llave natural de una fila es (fondo, fecha, tipo): espejo del único de rendimiento_fondo. Una fila de más no se
 *   puede borrar (solo inserción); por eso el archivo no admite la misma fecha y tipo dos veces.
 * - El nombre del archivo del dueño no se guarda: la carga dice NOMBRE_ARCHIVO; la identifica su sha256.
 */
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Llavero } from "../../cifrado/llavero";
import { crearCarga, guardarFilaCruda, verFila } from "../../datos-oficiales/registro/carga";
import { enTodoElArchivo, type Hallazgo } from "../../datos-oficiales/registro/hallazgos";
import { candadoFondo } from "../../lib/candados";
import { diaIso } from "../../precios/horario";
import { claveFila, type FilaRendimiento, type TipoRendimiento } from "./csv";
import { contarRendimientos, hayNuevos, planificarRendimientos, type ConteosRendimientos, type HechoGuardado, type Planificado } from "./planificar";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export const TIPO_FUENTE = "REGISTRO_RENDIMIENTOS_FIC" as const;
export const NOMBRE_ARCHIVO = "rendimientos-fondo.csv";
/** Motivo fijo del ajuste: nunca texto libre (no lleva datos del encargo). */
export const MOTIVO_RENDIMIENTO = "Rendimiento del fondo pagado en efectivo, según el encargo del FIC (lo registra el dueño).";
const TRANSACCION = { timeout: 60_000, maxWait: 10_000 } as const;

export type CodigoContexto = "FONDO_NO_REGISTRADO" | "FONDO_INACTIVO" | "FONDO_SIN_CONSTITUCION";

export interface ContextoFondo {
  readonly fondoId: string;
  /** El día de su CONSTITUCION: ninguna fila puede ser anterior. */
  readonly constitucion: Date;
}

/** El fondo (un FIC activo) y su constitución; si no, el código. */
export async function leerContexto(db: Db, codigoFic: string): Promise<ContextoFondo | CodigoContexto> {
  const f = await db.instrumento.findUnique({ where: { codigoFic }, select: { id: true, tipo: true, activo: true } });
  if (!f || f.tipo !== "FIC") return "FONDO_NO_REGISTRADO";
  if (!f.activo) return "FONDO_INACTIVO";
  const c = await db.movimientoFondo.findFirst({ where: { fondoId: f.id, tipo: "CONSTITUCION" }, select: { fecha: true } });
  return c ? { fondoId: f.id, constitucion: c.fecha } : "FONDO_SIN_CONSTITUCION";
}

/** Los hechos ya registrados del fondo, por `claveFila` (fecha y tipo). */
export async function leerGuardados(db: Db, fondoId: string): Promise<ReadonlyMap<string, HechoGuardado>> {
  const filas = await db.rendimientoFondo.findMany({ where: { fondoId }, select: { fecha: true, tipo: true, valor: true, filaFuenteId: true } });
  return new Map(filas.map((h) => [claveFila(h), h]));
}

/** La llave natural de la fila cruda: el tipo de fuente, el fondo (su id), la fecha y el tipo de la operación. */
export function claveNaturalRendimiento(fondoId: string, fecha: Date, tipo: TipoRendimiento): string {
  return createHash("sha256").update(JSON.stringify([TIPO_FUENTE, fondoId, diaIso(fecha), tipo])).digest("hex");
}

async function crearAjuste(tx: Tx, fila: FilaRendimiento, usuarioId: string): Promise<string> {
  const { id } = await tx.ajusteCaja.create({
    data: { fecha: fila.fecha, monto: new Prisma.Decimal(fila.valor), categoria: "RENDIMIENTO_FIC", fuente: "EXTRACTO", motivo: MOTIVO_RENDIMIENTO, referenciaEvidencia: null, creadoPorId: usuarioId },
    select: { id: true },
  });
  return id;
}

async function escribir(tx: Tx, cargaId: string, fondoId: string, usuarioId: string, p: Planificado, llavero: Llavero): Promise<void> {
  const { fila, plan } = p;
  if (plan.accion === "SIN_CAMBIOS") return verFila(tx, cargaId, fila.linea, plan.filaFuenteId);
  const claveNatural = claveNaturalRendimiento(fondoId, fila.fecha, fila.tipo);
  const filaFuenteId = await guardarFilaCruda(tx, { cargaId, tipoFuente: TIPO_FUENTE, claveNatural, filaNo: fila.linea, crudo: fila.crudo }, llavero);
  const ajusteCajaId = fila.tipo === "RENDIMIENTO" ? await crearAjuste(tx, fila, usuarioId) : null;
  await tx.rendimientoFondo.create({
    data: { filaFuenteId, fondoId, fecha: fila.fecha, tipo: fila.tipo, valor: new Prisma.Decimal(fila.valor), ajusteCajaId },
    select: { id: true },
  });
}

export interface EntradaGuardar {
  readonly usuarioId: string;
  readonly codigoFic: string;
  readonly sha256: string;
  readonly filas: readonly FilaRendimiento[];
  readonly llavero: Llavero;
}

export type ResultadoGuardar =
  | { readonly estado: "APLICADO"; readonly fondoId: string; readonly cargaId: string; readonly conteos: ConteosRendimientos }
  | { readonly estado: "SIN_CAMBIOS"; readonly fondoId: string; readonly conteos: ConteosRendimientos }
  | { readonly estado: "RECHAZADO"; readonly hallazgos: readonly Hallazgo[] };

async function enTransaccion(tx: Tx, e: EntradaGuardar): Promise<ResultadoGuardar> {
  // Primero el candado consultivo, sin lock_timeout (que también lo cortaría): la espera de otra carga del fondo la
  // acota el timeout de la transacción. Después, lo más que se espera por un candado de tabla (una migración) son 10 s.
  await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${candadoFondo(e.codigoFic)}))`;
  await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`;
  const contexto = await leerContexto(tx, e.codigoFic);
  if (typeof contexto === "string") return { estado: "RECHAZADO", hallazgos: [enTodoElArchivo(contexto)] };
  const { planes, hallazgos } = planificarRendimientos(e.filas, await leerGuardados(tx, contexto.fondoId), contexto.constitucion);
  if (hallazgos.length > 0) return { estado: "RECHAZADO", hallazgos };
  const conteos = contarRendimientos(planes);
  if (!hayNuevos(conteos)) return { estado: "SIN_CAMBIOS", fondoId: contexto.fondoId, conteos };
  const cargaId = await crearCarga(tx, {
    tipoFuente: TIPO_FUENTE, nombreArchivo: NOMBRE_ARCHIVO, sha256: e.sha256, usuarioId: e.usuarioId,
    filasTotal: conteos.filas, filasNuevas: conteos.filas - conteos.sinCambios, filasRepetidas: conteos.sinCambios,
  });
  for (const p of planes) await escribir(tx, cargaId, contexto.fondoId, e.usuarioId, p, e.llavero);
  return { estado: "APLICADO", fondoId: contexto.fondoId, cargaId, conteos };
}

/**
 * Aplica las filas ya leídas. Con el candado del fondo tomado, un P2002 (el hecho, su fila cruda o su ajuste ya
 * existen) solo puede venir de un escritor fuera de este camino: CONFLICTO_CONCURRENTE, sin haber escrito nada. Los
 * rechazos vuelven como RECHAZADO; cualquier otro error sube (puede haber ocurrido al confirmar).
 */
export async function guardarRendimientos(db: PrismaClient, e: EntradaGuardar): Promise<ResultadoGuardar> {
  try {
    return await db.$transaction((tx) => enTransaccion(tx, e), TRANSACCION);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { estado: "RECHAZADO", hallazgos: [enTodoElArchivo("CONFLICTO_CONCURRENTE")] };
    }
    throw error;
  }
}
