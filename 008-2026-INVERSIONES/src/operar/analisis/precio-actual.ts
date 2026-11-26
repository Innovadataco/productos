/**
 * El tablero con el precio actual escrito para una especie: su valor, su peso y los totales se recalculan con ese precio
 * (la misma cuenta de `calcularTablero`), para que el análisis del antes y el después (pesos, concentración, riesgo)
 * cuadre con la tabla de pesos del simulador. Puro y sin mutar la entrada; una especie que no está no cambia nada.
 * No toca la historia de precios de los escenarios: esos se calibran con los cierres guardados.
 */
import { Prisma } from "@prisma/client";
import type { FilaTablero, Tablero } from "@/tablero/calculo";

const CERO = new Prisma.Decimal(0);
const CIEN = new Prisma.Decimal(100);
const suma = (xs: readonly Prisma.Decimal[]): Prisma.Decimal => xs.reduce((s, x) => s.add(x), CERO);

function conValor(f: FilaTablero, precio: Prisma.Decimal, fechaSinCierre: Date): FilaTablero {
  // Una especie sin acciones no se valora: su cierre no cuenta.
  if (f.cantidad === 0n) return f;
  const valor = f.cantidad > 0n ? precio.mul(f.cantidad.toString()) : CERO;
  const sinVender = valor.sub(f.costoVivo);
  return {
    ...f,
    cierre: f.cierre === null ? { precio, fecha: fechaSinCierre, verificado: false } : { ...f.cierre, precio },
    cierreAtrasado: false,
    valor,
    sinVender,
    rentabilidadPct: f.costoVivo.gt(0) ? sinVender.div(f.costoVivo).mul(CIEN) : null,
  };
}

export function tableroConPrecioActual(t: Tablero, instrumentoId: string, precio: Prisma.Decimal): Tablero {
  const todas = [...t.filas, ...t.cerradas];
  if (!todas.some((f) => f.instrumentoId === instrumentoId)) return t;
  const cambiar = (f: FilaTablero): FilaTablero => (f.instrumentoId === instrumentoId ? conValor(f, precio, t.fechaReferencia ?? new Date(0)) : f);
  const vivas = t.filas.map(cambiar);
  const valorAcciones = suma(vivas.map((f) => f.valor ?? CERO));
  const conPeso = (f: FilaTablero): FilaTablero => ({ ...f, pesoPct: f.valor !== null && valorAcciones.gt(0) && f.cantidad > 0n ? f.valor.div(valorAcciones).mul(CIEN) : null });
  const filas = vivas.map(conPeso).sort((a, b) => (b.valor ?? CERO).cmp(a.valor ?? CERO));
  const cerradas = t.cerradas.map(cambiar);
  const sinVender = suma([...filas, ...cerradas].map((f) => f.sinVender ?? CERO));
  return { ...t, filas, cerradas, valorAcciones, sinVender, especiesSinPrecio: filas.filter((f) => f.valor === null).length, gananciaTotal: sinVender.add(t.porVentas).add(t.dividendos).sub(t.comisiones) };
}
