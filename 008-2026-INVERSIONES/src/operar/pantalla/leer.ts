import "server-only";
/**
 * Lo que lee el simulador de /operar para una simulación. Solo lectura (inv_app), en el momento del pedido:
 * - las posiciones: las filas del tablero, vivas y cerradas (`obtenerResumen`, la misma cuenta del tablero), con su
 *   último cierre;
 * - la caja: la oficial, el saldo en efectivo de la última certificación de Acciones & Valores vigente (no retirada),
 *   con su fecha de corte, como dice el tablero («la caja llega con la certificación de A&V»). Sin certificación, la
 *   caja es 0 y la pantalla lo dice: no se inventa otra;
 * - las reglas del plan que rige hoy, la historia de órdenes y las tarifas vigentes del comisionista elegido.
 * No escribe nada ni importa módulos que escriban (tests/unit/auth/escrituras.candado.test.ts, regla 3).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { vigenteEn } from "@/app/plan/vista";
import { leerReglas, leerVersiones } from "@/plan/lectura";
import { obtenerResumen } from "@/tablero/datos";
import type { Comisionista, ContextoSimulacion, EstadoSimulado, PosicionSimulada, ReglaSimulada } from "../simulador/tipos";
import { leerOrdenesHistoricas, leerTarifasVigentes } from "../tarifa/leer";

export interface CajaLeida {
  /** Día de corte de la certificación de donde sale la caja; null si no hay ninguna vigente (la caja es 0). */
  readonly fechaCorte: Date | null;
}

export interface EntradasSimulador {
  readonly estado: EstadoSimulado;
  readonly contexto: ContextoSimulacion;
  readonly caja: CajaLeida;
}

const CERO = new Prisma.Decimal(0);

/** Las especies del tablero que se pueden simular (vivas y cerradas), con el nemotécnico y la cantidad. */
export async function leerPosiciones(db: PrismaClient): Promise<PosicionSimulada[]> {
  const { tablero } = await obtenerResumen(db);
  return [...tablero.filas, ...tablero.cerradas].map((f) => ({
    instrumentoId: f.instrumentoId,
    nemotecnico: f.nemotecnico,
    cantidad: f.cantidad,
    cierre: f.cierre === null ? null : { precio: f.cierre.precio, fecha: f.cierre.fecha },
  }));
}

async function leerCaja(db: PrismaClient): Promise<{ readonly caja: Prisma.Decimal; readonly fechaCorte: Date | null }> {
  const cert = await db.certificacion.findFirst({ where: { retiradaEn: null }, orderBy: { fechaCorte: "desc" }, select: { saldoEfectivo: true, fechaCorte: true } });
  return cert === null ? { caja: CERO, fechaCorte: null } : { caja: cert.saldoEfectivo, fechaCorte: cert.fechaCorte };
}

async function leerReglasDeHoy(db: PrismaClient, hoy: Date): Promise<ReglaSimulada[]> {
  const vigente = vigenteEn(await leerVersiones(db), hoy);
  if (vigente === null) return [];
  return (await leerReglas(db, vigente.id)).map((r) => ({
    id: r.id, instrumentoId: r.instrumentoId, condicion: r.condicion, nivel: r.nivel, accion: r.accion, cantidad: r.cantidad, plazoHasta: r.plazoHasta, detalle: r.detalle,
  }));
}

/** Todo lo del simulador, con el día de Colombia `hoy` (medianoche UTC) y el comisionista elegido. */
export async function leerEntradasSimulador(db: PrismaClient, hoy: Date, comisionista: Comisionista): Promise<EntradasSimulador> {
  // El tablero primero y solo (abre sus propias lecturas en paralelo): así no compite por el pool con el resto.
  const posiciones = await leerPosiciones(db);
  const [caja, reglas, ordenes, tarifas] = await Promise.all([leerCaja(db), leerReglasDeHoy(db, hoy), leerOrdenesHistoricas(db), leerTarifasVigentes(db, comisionista, hoy)]);
  return {
    estado: { posiciones, caja: caja.caja, reglas },
    contexto: { ordenes, hoy, tarifas },
    caja: { fechaCorte: caja.fechaCorte },
  };
}
