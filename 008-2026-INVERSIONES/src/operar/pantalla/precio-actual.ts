/**
 * El precio actual de trii Pro que el dueño escribe en el simulador: la especie operada se valora con él en lugar de su
 * último cierre. Puro y sin mutar la entrada; no guarda nada (el precio vive solo en el pedido). Una especie que el
 * estado no conoce no cambia nada: el motor ya la rechaza como desconocida.
 */
import type { Prisma } from "@prisma/client";
import type { EstadoSimulado } from "../simulador/tipos";

export function conPrecioActual(estado: EstadoSimulado, instrumentoId: string, precio: Prisma.Decimal): EstadoSimulado {
  if (!estado.posiciones.some((p) => p.instrumentoId === instrumentoId)) return estado;
  return {
    ...estado,
    posiciones: estado.posiciones.map((p) => (p.instrumentoId === instrumentoId ? { ...p, cierre: { ...p.cierre, precio } } : p)),
  };
}
