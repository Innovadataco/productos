/**
 * Qué lee /alertas: las alertas de los últimos 30 días (con la especie y las fechas del decreto) y la marca de vista de cada
 * una, y el contador del menú (las de los últimos 7 días sin marcar). Solo lectura, con `select` explícito. `hoy` es el día de
 * Colombia (medianoche UTC): las alertas de días posteriores no se muestran.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { sumarDias } from "@/plan/fechas";
import { TOPE_ALERTAS, VENTANA_ALERTAS_DIAS, VENTANA_CONTADOR_DIAS } from "./parametros";
import { construirVista, type FilaAlerta, type VistaAlertas } from "./vista";

type Lector = Pick<PrismaClient, "alerta">;

const desdeDe = (hoy: Date, dias: number): Date => sumarDias(hoy, -(dias - 1));

export async function datosDeAlertas(db: Lector, hoy: Date): Promise<VistaAlertas> {
  const filas = await db.alerta.findMany({
    where: { dia: { gte: desdeDe(hoy, VENTANA_ALERTAS_DIAS), lte: hoy } },
    select: {
      id: true, dia: true, tipo: true, sentido: true, base: true, precio: true, referencia: true, variacionPct: true, umbral: true, instanteDato: true,
      traidoEn: true, fuente: true, conRetraso: true, minutosDeEdad: true, esFechaEx: true,
      instrumento: { select: { nemotecnico: true } },
      decreto: { select: { fechaEx: true, fechaPago: true } },
      vista: { select: { vistaEn: true } },
    },
    orderBy: [{ dia: "desc" }, { detectadaEn: "desc" }, { id: "asc" }],
    take: TOPE_ALERTAS,
  });
  const lista: FilaAlerta[] = filas.map(({ instrumento, decreto, vista, ...f }) => ({
    ...f,
    nemotecnico: instrumento?.nemotecnico ?? null,
    fechaExDecreto: decreto?.fechaEx ?? null,
    fechaPagoDecreto: decreto?.fechaPago ?? null,
    vistaEn: vista?.vistaEn ?? null,
  }));
  return construirVista(lista);
}

/** Las alertas de los últimos 7 días (hoy y los 6 anteriores) que nadie marcó como vistas. */
export async function contarPendientes(db: Lector, hoy: Date): Promise<number> {
  return db.alerta.count({ where: { dia: { gte: desdeDe(hoy, VENTANA_CONTADOR_DIAS), lte: hoy }, vista: { is: null } } });
}
