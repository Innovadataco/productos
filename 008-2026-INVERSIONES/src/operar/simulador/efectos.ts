/**
 * Los efectos de una orden ya validada sobre el portafolio. Puro y sin mutar la entrada.
 * - Cantidades: la operada sube (compra) o baja (venta); las demás, igual.
 * - Valor: cantidad × último cierre; 0 sin acciones; null con acciones y sin cierre (como el tablero).
 * - Peso: valor / valor de las acciones × 100, sin redondear (la misma cuenta del tablero, para que «antes» cuadre
 *   con él). Las especies sin cierre quedan fuera del total y sin peso; si el total es 0, no hay pesos.
 * - Caja: compra, caja − valor − comisión; venta, caja + valor − comisión; sin historia, sin comisión.
 * - Avisos: comprar por más de la caja (no es error: la caja puede estar atrasada) y las especies sin cierre.
 */
import { Prisma } from "@prisma/client";
import type { AvisoSimulacion, ComisionEstimada, EfectoEspecie, EspecieNombrada, EstadoSimulado, OperacionSimulada } from "./tipos";

type Decimal = Prisma.Decimal;
const CERO = new Prisma.Decimal(0);
const CIEN = new Prisma.Decimal(100);

export interface EfectosDeLaOrden {
  readonly especies: readonly EfectoEspecie[];
  readonly valorAccionesAntes: Decimal;
  readonly valorAccionesDespues: Decimal;
  readonly cajaDespues: Decimal;
  readonly avisos: readonly AvisoSimulacion[];
}

const valorDe = (cantidad: bigint, cierre: Decimal | null): Decimal | null => (cantidad === 0n ? CERO : cierre === null ? null : cierre.mul(cantidad.toString()));
const total = (valores: readonly (Decimal | null)[]): Decimal => valores.reduce<Decimal>((t, v) => (v === null ? t : t.add(v)), CERO);
const pesoDe = (valor: Decimal | null, totalAcciones: Decimal): Decimal | null => (valor === null || !totalAcciones.gt(0) ? null : valor.div(totalAcciones).mul(CIEN));

function cantidadesYValores(estado: EstadoSimulado, op: OperacionSimulada) {
  const delta = op.lado === "COMPRAR" ? op.cantidad : -op.cantidad;
  return estado.posiciones
    .map((p) => {
      const cantidadDespues = p.instrumentoId === op.instrumentoId ? p.cantidad + delta : p.cantidad;
      return { p, cantidadDespues, valorAntes: valorDe(p.cantidad, p.cierre), valorDespues: valorDe(cantidadDespues, p.cierre) };
    })
    .filter((f) => f.p.cantidad > 0n || f.cantidadDespues > 0n);
}

function avisosDe(op: OperacionSimulada, caja: Decimal, necesario: Decimal, comision: ComisionEstimada, sinCierre: readonly EspecieNombrada[]): AvisoSimulacion[] {
  const [primera, ...resto] = sinCierre;
  return [
    ...(op.lado === "COMPRAR" && necesario.gt(caja) ? [{ codigo: "COMPRA_SUPERA_CAJA", caja, necesario, conComision: comision.estado === "ESTIMADA" } as const] : []),
    ...(primera === undefined ? [] : [{ codigo: "ESPECIES_SIN_CIERRE", especies: [primera, ...resto] } as const]),
  ];
}

export function calcularEfectos(estado: EstadoSimulado, op: OperacionSimulada, valorOrden: Decimal, comision: ComisionEstimada): EfectosDeLaOrden {
  const filas = cantidadesYValores(estado, op);
  const valorAccionesAntes = total(filas.map((f) => f.valorAntes));
  const valorAccionesDespues = total(filas.map((f) => f.valorDespues));
  const especies = filas.map(
    (f): EfectoEspecie => ({
      instrumentoId: f.p.instrumentoId, nemotecnico: f.p.nemotecnico, cantidadAntes: f.p.cantidad, cantidadDespues: f.cantidadDespues,
      valorAntes: f.valorAntes, valorDespues: f.valorDespues,
      pesoAntesPct: pesoDe(f.valorAntes, valorAccionesAntes), pesoDespuesPct: pesoDe(f.valorDespues, valorAccionesDespues),
    }),
  );
  const valorComision = comision.estado === "ESTIMADA" ? comision.valor : CERO;
  const cajaDespues = op.lado === "COMPRAR" ? estado.caja.sub(valorOrden).sub(valorComision) : estado.caja.add(valorOrden).sub(valorComision);
  const sinCierre = filas.filter((f) => f.valorAntes === null || f.valorDespues === null).map((f) => ({ instrumentoId: f.p.instrumentoId, nemotecnico: f.p.nemotecnico }));
  const avisos = avisosDe(op, estado.caja, valorOrden.add(valorComision), comision, sinCierre);
  return { especies, valorAccionesAntes, valorAccionesDespues, cajaDespues, avisos };
}
