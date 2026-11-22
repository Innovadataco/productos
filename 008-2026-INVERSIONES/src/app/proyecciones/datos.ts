import "server-only";
/**
 * Los datos de la página /proyecciones (frente proyecciones-pantalla). Solo lectura.
 * - Historia: la evolución del tablero (src/tablero/datos-evolucion.ts, con el resumen del tablero) y el fondo (FIC)
 *   con sus movimientos y sus valores de unidad vigentes, hasta hoy y de los últimos ANIOS_HISTORIA_MAX años; un punto
 *   por mes (src/app/proyecciones/historia.ts). Si la evolución falla por un dato (no la base), la página sigue sin
 *   historia (ni la del fondo sola: una parcial engañaría) y se registra solo el nombre del error.
 * - Cálculo inicial (CONTROLES_INICIALES) bajo el MISMO turno que la API: ocupado, sale sin resultado («OCUPADO») y el
 *   navegador lo pide; un error que no es de la base, «FALLO» (el detalle no se registra: solo el nombre).
 * - Las dos lecturas van en paralelo y se esperan las dos (allSettled): así el turno queda libre antes de responder.
 * Un fallo de Prisma se propaga: lo muestra la página («No se pudo leer la base»).
 */
import type { PrismaClient } from "@prisma/client";
import { fechaEnBogota, diaIso } from "@/precios/horario";
import { ANIOS_HISTORIA_MAX } from "@/proyecciones/metodo";
import { obtenerResumen } from "@/tablero/datos";
import { obtenerEvolucion } from "@/tablero/datos-evolucion";
import { esErrorDeBase } from "../_comun/sin-base";
import { TRAYECTORIAS_PANTALLA, SEMILLA_PANTALLA } from "./controles";
import { historiaMensual, type FondoHistoria, type PuntoHistoria } from "./historia";
import { CONTROLES_INICIALES } from "./opciones";
import { calcularVista, nombreDelError } from "./servidor";
import { conTurno } from "./turno";
import type { VistaProyeccion } from "./vista";

export type EstadoInicial = "LISTO" | "OCUPADO" | "FALLO";

export interface DatosProyecciones {
  readonly hoy: string;
  readonly historia: readonly PuntoHistoria[];
  readonly inicial: VistaProyeccion | null;
  readonly estado: EstadoInicial;
}

/** El primer día de la historia que se lee: ANIOS_HISTORIA_MAX años antes de hoy, como el motor. */
const desdeDeHistoria = (hoy: Date): Date => new Date(Date.UTC(hoy.getUTCFullYear() - ANIOS_HISTORIA_MAX, hoy.getUTCMonth(), hoy.getUTCDate()));

/** El fondo por fondo: movimientos con signo (el retiro resta, como src/conciliacion/esperado.ts) y valores vigentes. */
export async function leerFondosHistoria(db: PrismaClient, hoy: Date): Promise<(FondoHistoria & { readonly fondoId: string })[]> {
  const movs = await db.movimientoFondo.findMany({
    where: { fecha: { lte: hoy }, fondo: { tipo: "FIC" } },
    select: { fondoId: true, fecha: true, unidades: true, tipo: true },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
  });
  const ids = [...new Set(movs.map((m) => m.fondoId))];
  if (ids.length === 0) return [];
  const desde = desdeDeHistoria(hoy);
  const valores = await db.valorUnidadFondo.findMany({
    where: { fondoId: { in: ids }, reemplazadoEn: null, fechaValor: { gte: desde, lte: hoy } },
    select: { fondoId: true, fechaValor: true, valorUnidad: true },
    orderBy: [{ fondoId: "asc" }, { fechaValor: "asc" }],
  });
  return ids.map((fondoId) => ({
    fondoId,
    movimientos: movs.filter((m) => m.fondoId === fondoId).map((m) => ({ dia: diaIso(m.fecha), unidades: m.unidades.toNumber() * (m.tipo === "RETIRO" ? -1 : 1) })),
    valores: valores.filter((v) => v.fondoId === fondoId).map((v) => ({ dia: diaIso(v.fechaValor), valor: v.valorUnidad.toNumber() })),
  }));
}

/** La evolución de las acciones; null si falló por un dato (entonces no hay historia: una parcial engañaría). */
async function accionesHistoria(db: PrismaClient): Promise<PuntoHistoria[] | null> {
  try {
    const evolucion = await obtenerEvolucion(db, await obtenerResumen(db));
    return evolucion.puntos.map((p) => ({ dia: diaIso(p.fecha), valor: p.valor.toNumber() }));
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    console.error(`[proyecciones] no se pudo leer la historia (${nombreDelError(error)})`);
    return null;
  }
}

export async function leerHistoria(db: PrismaClient, hoy: Date): Promise<PuntoHistoria[]> {
  const [acciones, fondos] = await Promise.all([accionesHistoria(db), leerFondosHistoria(db, hoy)]);
  return acciones === null ? [] : historiaMensual({ acciones, fondos, hoy: diaIso(hoy), desde: diaIso(desdeDeHistoria(hoy)) });
}

async function calculoInicial(db: PrismaClient, usuarioId: string): Promise<{ readonly inicial: VistaProyeccion | null; readonly estado: EstadoInicial }> {
  try {
    const turno = await conTurno(usuarioId, Date.now(), () => calcularVista(db, { ...CONTROLES_INICIALES, trayectorias: TRAYECTORIAS_PANTALLA, semilla: SEMILLA_PANTALLA }));
    if (!turno.ok) return { inicial: null, estado: "OCUPADO" };
    return turno.valor.ok ? { inicial: turno.valor.vista, estado: "LISTO" } : { inicial: null, estado: "FALLO" };
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    console.error(`[proyecciones] no se pudo calcular (${nombreDelError(error)})`);
    return { inicial: null, estado: "FALLO" };
  }
}

export async function datosDeProyecciones(db: PrismaClient, usuarioId: string): Promise<DatosProyecciones> {
  const hoy = fechaEnBogota(new Date());
  const [historia, calculo] = await Promise.allSettled([leerHistoria(db, hoy), calculoInicial(db, usuarioId)]);
  if (historia.status === "rejected") throw historia.reason;
  if (calculo.status === "rejected") throw calculo.reason;
  return { hoy: diaIso(hoy), historia: historia.value, ...calculo.value };
}
