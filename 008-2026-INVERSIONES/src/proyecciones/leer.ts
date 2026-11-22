import "server-only";
/**
 * Lector del motor de proyecciones: arma `EntradasProyeccion` desde la base. Solo lectura, con `select` explícito
 * (nunca crudos ni el encargo).
 * - Posiciones: las acciones vivas de `posiciones()` (las especies con ventas sin asignar quedan fuera y se nombran)
 *   y los fondos FIC con unidades netas > 0 hasta hoy (RETIRO resta, lo demás suma: la regla de
 *   src/conciliacion/esperado.ts). `posiciones()` abre su propia foto REPEATABLE READ y no puede ir dentro de la
 *   transacción interactiva: el resto se lee en otra foto de solo lectura (`enSoloLectura`). Para una proyección
 *   ilustrativa se acepta; una carga que confirme entre las dos fotos se ve en la siguiente consulta. Las cantidades
 *   son siempre las de hoy (`posiciones()` no recibe fecha): `hoy` solo acota la historia y los movimientos.
 * - Historia: cierres VIGENTES de Yahoo (la fuente de los diarios) de las acciones vivas y de los destinos de sus
 *   escisiones, valores de unidad vigentes de los fondos, de los últimos ANIOS_HISTORIA_MAX años y hasta hoy.
 * - Dividendos pagados (sin las fracciones de escisión), decretos VIGENTES y no anulados (DECRETOS_QUE_CUENTAN de
 *   src/datos-oficiales/decretos/vigentes.ts, el único filtro: una corrección es una versión nueva que retira a la
 *   anterior y una anulación es una versión `anulada`; también los de pago futuro, solo para contarlos), los movimientos
 *   de la tenencia, las escisiones y los días no hábiles de calendario_bvc. De cada decreto, su fecha ex (con ella se
 *   mide el pago de Trii que cruza, como en el plan). Los decretos se leen desde rangoDeDecretos de los pagos (desde
 *   VENTANA_PAGO_DESPUES_DIAS antes del primer día de la historia): así todo pago leído ve los decretos cuya ventana
 *   lo contiene. Sin cota superior a propósito: los de pago futuro se leen para contarlos (una fila por cuota).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { enSoloLectura } from "../conciliacion/leer";
import { DECRETOS_QUE_CUENTAN, rangoDeDecretos } from "../datos-oficiales/decretos/vigentes";
import { posiciones, type ResultadoPosiciones } from "../lotes/posiciones";
import { esFechaDeNegocio } from "../plan/fechas";
import { movimientosDeEspecies } from "../plan/resultados-lote";
import { FUENTE } from "../precios/guardar";
import { ANIOS_HISTORIA_MAX } from "./metodo";
import type { AccionEntrada, Cierre, EntradasProyeccion, FondoEntrada } from "./tipos";

type Lector = Prisma.TransactionClient;
const MAXIMO_EXACTO = BigInt(Number.MAX_SAFE_INTEGER);

/** BigInt → number solo si cabe exacto (las cantidades de acciones se guardan en BigInt). */
export function aNumeroExacto(b: bigint): number {
  if (b > MAXIMO_EXACTO || b < -MAXIMO_EXACTO) throw new RangeError("Cantidad fuera del rango exacto de un número.");
  return Number(b);
}

/** Igual que `signoFondo` de src/conciliacion/esperado.ts: el retiro resta y lo demás suma. */
const signoFondo = (tipo: string): number => (tipo === "RETIRO" ? -1 : 1);

function agrupar<T, R>(filas: readonly T[], clave: (f: T) => string, valor: (f: T) => R): Map<string, R[]> {
  const m = new Map<string, R[]>();
  for (const f of filas) {
    const k = clave(f);
    const lista = m.get(k);
    if (lista) lista.push(valor(f));
    else m.set(k, [valor(f)]);
  }
  return m;
}

async function fondosVivos(tx: Lector, hoy: Date): Promise<{ id: string; nombre: string; unidades: number }[]> {
  const movs = await tx.movimientoFondo.findMany({ where: { fecha: { lte: hoy }, fondo: { tipo: "FIC" } }, select: { fondoId: true, unidades: true, tipo: true } });
  const suma = new Map<string, Prisma.Decimal>();
  for (const m of movs) suma.set(m.fondoId, (suma.get(m.fondoId) ?? new Prisma.Decimal(0)).add(m.unidades.mul(signoFondo(m.tipo))));
  const vivos = [...suma].filter(([, u]) => u.gt(0));
  const nombres = await tx.instrumento.findMany({ where: { id: { in: vivos.map(([id]) => id) } }, select: { id: true, nombre: true } });
  const nombre = new Map(nombres.map((i) => [i.id, i.nombre]));
  return vivos
    .map(([id, u]) => ({ id, nombre: nombre.get(id) ?? id, unidades: u.toNumber() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre) || (a.id < b.id ? -1 : 1));
}

/** Lo que no depende de las especies: incompletas, fondos, escisiones y calendario. */
async function leerContexto(tx: Lector, hoy: Date, vivas: ResultadoPosiciones) {
  const [incompletas, fondos, eventos, noHabiles] = await Promise.all([
    tx.instrumento.findMany({ where: { id: { in: [...vivas.especiesIncompletas] } }, select: { nemotecnico: true } }),
    fondosVivos(tx, hoy),
    // Todas las escisiones (tabla chica): la de un destino que no se tiene hace falta para ver si es en cadena.
    tx.eventoCorporativo.findMany({ where: { tipo: "ESCISION", fecha: { lte: hoy } }, select: { origenId: true, destinoId: true, fecha: true, razon: true } }),
    tx.calendarioBvc.findMany({ where: { esHabil: false }, select: { dia: true } }),
  ]);
  return { incompletas, fondos, eventos, noHabiles };
}

/** La historia de las especies vivas (y de los destinos de sus escisiones) y de los fondos. */
async function leerHistoria(tx: Lector, hoy: Date, ids: readonly string[], destinos: readonly string[], fondos: readonly string[]) {
  const desde = new Date(Date.UTC(hoy.getUTCFullYear() - ANIOS_HISTORIA_MAX, hoy.getUTCMonth(), hoy.getUTCDate()));
  const [cierres, valores, dividendos, decretos, movimientos] = await Promise.all([
    tx.precioCierre.findMany({
      where: { instrumentoId: { in: [...ids, ...destinos] }, fuente: FUENTE, reemplazadoEn: null, fecha: { gte: desde, lte: hoy } },
      select: { instrumentoId: true, fecha: true, precio: true },
      orderBy: [{ instrumentoId: "asc" }, { fecha: "asc" }],
    }),
    tx.valorUnidadFondo.findMany({
      where: { fondoId: { in: [...fondos] }, reemplazadoEn: null, fechaValor: { gte: desde, lte: hoy } },
      select: { fondoId: true, fechaValor: true, valorUnidad: true },
      orderBy: [{ fondoId: "asc" }, { fechaValor: "asc" }],
    }),
    tx.dividendo.findMany({
      where: { instrumentoId: { in: [...ids] }, tipo: { not: "FRACCION_ESCISION" }, fechaPago: { gte: desde, lte: hoy } },
      select: { instrumentoId: true, fechaPago: true, montoNeto: true, decretadoId: true },
      orderBy: [{ fechaPago: "asc" }, { id: "asc" }],
    }),
    tx.dividendoDecretado.findMany({
      where: { instrumentoId: { in: [...ids] }, fechaPago: { gte: rangoDeDecretos({ desde, hasta: hoy }).desde }, ...DECRETOS_QUE_CUENTAN },
      select: { id: true, instrumentoId: true, fechaEx: true, fechaPago: true, valorPorAccion: true, _count: { select: { recibidos: true } } },
      orderBy: [{ fechaPago: "asc" }, { id: "asc" }],
    }),
    movimientosDeEspecies(tx, ids, hoy),
  ]);
  return {
    cierres: agrupar(cierres, (c) => c.instrumentoId, (c): Cierre => ({ dia: c.fecha, precio: c.precio.toNumber() })),
    valores: agrupar(valores, (v) => v.fondoId, (v) => ({ dia: v.fechaValor, valorUnidad: v.valorUnidad.toNumber() })),
    dividendos: agrupar(dividendos, (d) => d.instrumentoId, (d) => ({ fechaPago: d.fechaPago, montoNeto: d.montoNeto.toNumber(), decretadoId: d.decretadoId })),
    decretos: agrupar(decretos, (d) => d.instrumentoId, (d) => ({
      id: d.id, fechaEx: d.fechaEx, fechaPago: d.fechaPago, valorPorAccion: d.valorPorAccion.toNumber(), recibido: d._count.recibidos > 0,
    })),
    movimientos,
  };
}

async function leerEnFoto(tx: Lector, hoy: Date, vivas: ResultadoPosiciones): Promise<EntradasProyeccion> {
  const ids = vivas.posiciones.map((p) => p.instrumentoId);
  const { incompletas, fondos, eventos, noHabiles } = await leerContexto(tx, hoy, vivas);
  const deIds = new Set(ids);
  const destinos = [...new Set(eventos.filter((e) => deIds.has(e.origenId) && !deIds.has(e.destinoId)).map((e) => e.destinoId))];
  const h = await leerHistoria(tx, hoy, ids, destinos, fondos.map((f) => f.id));
  const acciones = vivas.posiciones.map((p): AccionEntrada => ({
    tipo: "ACCION", instrumentoId: p.instrumentoId, nombre: p.nemotecnico ?? p.instrumentoId, cantidad: aNumeroExacto(p.cantidad),
    cierres: h.cierres.get(p.instrumentoId) ?? [], dividendos: h.dividendos.get(p.instrumentoId) ?? [], decretos: h.decretos.get(p.instrumentoId) ?? [],
    movimientos: h.movimientos.get(p.instrumentoId) ?? [],
  }));
  const deFondos = fondos.map((f): FondoEntrada => ({ tipo: "FONDO", instrumentoId: f.id, nombre: f.nombre, unidades: f.unidades, valores: h.valores.get(f.id) ?? [] }));
  return {
    hoy, posiciones: [...acciones, ...deFondos],
    escisiones: eventos.map((e) => ({ origenId: e.origenId, destinoId: e.destinoId, fecha: e.fecha, razon: e.razon?.toNumber() ?? null })),
    cierresDestino: Object.fromEntries(destinos.map((id) => [id, h.cierres.get(id) ?? []])),
    noHabiles: noHabiles.map((d) => d.dia),
    incompletas: incompletas.map((i) => i.nemotecnico ?? "?").sort((a, b) => a.localeCompare(b)),
  };
}

/** `hoy`: fecha de negocio en Colombia (medianoche UTC); lo posterior no cuenta. */
export async function leerEntradas(db: PrismaClient, hoy: Date): Promise<EntradasProyeccion> {
  if (!esFechaDeNegocio(hoy)) throw new RangeError("hoy debe ser una fecha de negocio (medianoche UTC).");
  const vivas = await posiciones(db);
  return enSoloLectura(db, (tx) => leerEnFoto(tx, hoy, vivas));
}
