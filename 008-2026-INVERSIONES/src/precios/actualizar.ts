/**
 * Guarda los cierres de Yahoo de las especies con posición (INV-SPEC-13).
 * - Versionado: si Yahoo revisa un cierre, el anterior queda con `reemplazadoEn` (historia) y se
 *   inserta el nuevo; un cierre igual no se toca.
 * - Candado: si hay certificación de A&V con fecha de corte igual, el cierre se compara con su
 *   precio de valoración: VERIFICADO si difiere ≤ 1 %, si no NO_VERIFICADO. Sin referencia oficial
 *   ese día, NO_VERIFICADO (nunca se presenta como verificado lo que no se comparó).
 * - Una fuente caída o un símbolo sin datos no escribe nada para esa especie: se informa.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { barraDefinitiva } from "./horario";
import { obtenerCierres, type Buscar, type Cierre } from "./yahoo";

export const TOLERANCIA_VERIFICACION = new Prisma.Decimal("0.01");
const FUENTE = "yahoo";

export interface FalloEspecie {
  readonly instrumentoId: string;
  readonly codigo: string;
  /** Solo nombre y código del error (p. ej. «PrismaClientKnownRequestError P2002»); nunca el mensaje. */
  readonly detalle?: string;
  readonly barrasGuardadas: number;
  readonly barrasFallidas: number;
}

/** Causa de un error sin exponer su mensaje (puede traer valores de la consulta). */
export function detalleDeError(e: unknown): string {
  if (!(e instanceof Error)) return "error";
  const codigo = (e as { code?: unknown }).code;
  return typeof codigo === "string" ? `${e.name} ${codigo}` : e.name;
}

export interface ResultadoActualizacion {
  readonly especies: number;
  readonly cierresNuevos: number;
  readonly cierresRevisados: number;
  readonly verificados: number;
  /** Barras de hoy no guardadas por no haber cerrado aún la BVC. */
  readonly omitidasPorHorario: number;
  readonly fallidas: readonly FalloEspecie[];
}

/** Símbolo de Yahoo vigente en la fecha, o `<NEMO>.CL` si no hay equivalencia registrada. */
async function simboloDe(db: PrismaClient, instrumentoId: string, nemotecnico: string, hoy: Date): Promise<string> {
  const mapa = await db.simboloPrecio.findFirst({
    where: { instrumentoId, proveedor: FUENTE, vigenteDesde: { lte: hoy }, OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: hoy } }] },
    select: { simbolo: true },
  });
  return mapa?.simbolo ?? `${nemotecnico}.CL`;
}

async function estadoDe(db: PrismaClient, instrumentoId: string, c: Cierre) {
  const ref = await db.certificacionPosicion.findFirst({
    where: { instrumentoId, certificacion: { fechaCorte: c.fecha } },
    select: { precioValoracion: true, certificacion: { select: { fechaCorte: true } } },
  });
  if (!ref) return { estado: "NO_VERIFICADO" as const, fuenteReferencia: null, precioReferencia: null, desviacionPct: null };
  const precio = new Prisma.Decimal(c.precio);
  const desviacion = precio.sub(ref.precioValoracion).abs().div(ref.precioValoracion);
  return {
    estado: desviacion.lte(TOLERANCIA_VERIFICACION) ? ("VERIFICADO" as const) : ("NO_VERIFICADO" as const),
    fuenteReferencia: `certificacion:${ref.certificacion.fechaCorte.toISOString().slice(0, 10)}`,
    precioReferencia: ref.precioValoracion,
    desviacionPct: desviacion.mul(100).toDecimalPlaces(6),
  };
}

/** Devuelve "nuevo", "revisado" o null (sin cambios). */
async function guardarCierre(db: PrismaClient, instrumentoId: string, c: Cierre): Promise<"nuevo" | "revisado" | null> {
  const vigente = await db.precioCierre.findFirst({ where: { instrumentoId, fecha: c.fecha, fuente: FUENTE, reemplazadoEn: null } });
  if (vigente?.precio.equals(c.precio)) return null;
  const verificacion = await estadoDe(db, instrumentoId, c);
  await db.$transaction(async (tx) => {
    if (vigente) await tx.precioCierre.update({ where: { id: vigente.id }, data: { reemplazadoEn: new Date() } });
    await tx.precioCierre.create({ data: { instrumentoId, fecha: c.fecha, precio: new Prisma.Decimal(c.precio), fuente: FUENTE, ...verificacion } });
  });
  return vigente ? "revisado" : "nuevo";
}

export async function actualizarPrecios(db: PrismaClient, opciones: { desde: Date; hasta: Date; buscar: Buscar; instrumentoIds?: readonly string[]; ahora?: Date }): Promise<ResultadoActualizacion> {
  const especies = await db.instrumento.findMany({
    where: { tipo: "ACCION", activo: true, nemotecnico: { not: null }, ...(opciones.instrumentoIds ? { id: { in: [...opciones.instrumentoIds] } } : { lotes: { some: {} } }) },
    select: { id: true, nemotecnico: true },
  });
  const ahora = opciones.ahora ?? new Date();
  const noHabiles = new Set(
    (await db.calendarioBvc.findMany({ where: { esHabil: false, dia: { gte: opciones.desde, lte: opciones.hasta } }, select: { dia: true } })).map((d) => d.dia.toISOString().slice(0, 10)),
  );
  let cierresNuevos = 0;
  let cierresRevisados = 0;
  let omitidasPorHorario = 0;
  const fallidas: FalloEspecie[] = [];
  for (const e of especies) {
    let r;
    try {
      r = await obtenerCierres(await simboloDe(db, e.id, e.nemotecnico!, opciones.hasta), opciones.desde, opciones.hasta, opciones.buscar);
    } catch (err) {
      fallidas.push({ instrumentoId: e.id, codigo: "GUARDADO_ERROR", detalle: detalleDeError(err), barrasGuardadas: 0, barrasFallidas: 0 });
      continue;
    }
    if (!r.ok) {
      fallidas.push({ instrumentoId: e.id, codigo: r.codigo, barrasGuardadas: 0, barrasFallidas: 0 });
      continue;
    }
    // Una barra que falla no aborta las demás de la especie ni las demás especies: se cuenta y se sigue.
    let barrasGuardadas = 0;
    let barrasFallidas = 0;
    let detalle: string | undefined;
    for (const c of r.cierres) {
      if (!barraDefinitiva(c.fecha, ahora, noHabiles)) {
        omitidasPorHorario += 1;
        continue;
      }
      try {
        const cambio = await guardarCierre(db, e.id, c);
        if (cambio === "nuevo") cierresNuevos += 1;
        if (cambio === "revisado") cierresRevisados += 1;
        barrasGuardadas += 1;
      } catch (err) {
        barrasFallidas += 1;
        detalle ??= detalleDeError(err);
      }
    }
    if (barrasFallidas > 0) fallidas.push({ instrumentoId: e.id, codigo: "GUARDADO_ERROR", ...(detalle ? { detalle } : {}), barrasGuardadas, barrasFallidas });
  }
  const verificados = await db.precioCierre.count({ where: { estado: "VERIFICADO", reemplazadoEn: null, fecha: { gte: opciones.desde, lte: opciones.hasta } } });
  return { especies: especies.length, cierresNuevos, cierresRevisados, verificados, omitidasPorHorario, fallidas };
}
