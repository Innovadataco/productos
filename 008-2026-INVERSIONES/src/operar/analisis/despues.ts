/**
 * El portafolio simulado: el tablero y la historia con la cantidad de después de la especie operada; el resto, igual.
 * Así el motor de src/analisis/ y el de src/proyecciones/ calculan el «después» con sus propias cuentas, sin cambiarlas.
 * - Tablero: valor = cantidad × último cierre (null sin cierre, como el tablero); sin acciones pasa a las cerradas y
 *   con acciones vuelve a las vivas. El valor de las acciones es la suma de las vivas.
 * - Historia: la cantidad de la acción (si la historia la trae; si no, queda sin historia propia, como hoy).
 * Puro y sin mutar la entrada.
 */
import { Prisma } from "@prisma/client";
import type { EntradasProyeccion } from "@/proyecciones/tipos";
import type { FilaTablero, Tablero } from "@/tablero/calculo";

export interface PortafolioSimulado {
  readonly tablero: Tablero;
  readonly historia: EntradasProyeccion;
}

const CERO = new Prisma.Decimal(0);

function filaDespues(f: FilaTablero, cantidad: bigint): FilaTablero {
  return { ...f, cantidad, valor: f.cierre === null ? null : f.cierre.precio.mul(cantidad.toString()) };
}

function tableroDespues(t: Tablero, instrumentoId: string, cantidad: bigint): Tablero {
  const todas = [...t.filas, ...t.cerradas].map((f) => (f.instrumentoId === instrumentoId ? filaDespues(f, cantidad) : f));
  const filas = todas.filter((f) => f.cantidad > 0n);
  return {
    ...t,
    filas,
    cerradas: todas.filter((f) => f.cantidad === 0n),
    valorAcciones: filas.reduce((s, f) => s.add(f.valor ?? CERO), CERO),
  };
}

export function portafolioDespues(e: PortafolioSimulado, instrumentoId: string, cantidad: bigint): PortafolioSimulado {
  return {
    tablero: tableroDespues(e.tablero, instrumentoId, cantidad),
    historia: {
      ...e.historia,
      posiciones: e.historia.posiciones.map((p) => (p.tipo === "ACCION" && p.instrumentoId === instrumentoId ? { ...p, cantidad: Number(cantidad) } : p)),
    },
  };
}
