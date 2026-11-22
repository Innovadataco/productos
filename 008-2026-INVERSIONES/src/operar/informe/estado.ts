/**
 * Sección «Estado» del informe para operar: las especies vivas del tablero (`calcularTablero`), tal cual, con su
 * cantidad, su cierre y su fecha, el valor, el peso y la ganancia o pérdida sin vender, y los totales. Puro: no
 * recalcula nada; la frescura es la del tablero (cierre anterior a su fecha de referencia = atrasado).
 */
import type { FilaTablero, Tablero } from "@/tablero/calculo";
import type { EspecieInforme, EstadoInforme } from "./tipos";

const aEspecie = (f: FilaTablero): EspecieInforme => ({
  instrumentoId: f.instrumentoId,
  nemotecnico: f.nemotecnico,
  cantidad: f.cantidad,
  cierre: f.cierre ? { precio: f.cierre.precio, fecha: f.cierre.fecha, verificado: f.cierre.verificado } : null,
  valor: f.valor,
  pesoPct: f.pesoPct,
  sinVender: f.sinVender,
  sinVenderPct: f.rentabilidadPct,
  cierreAtrasado: f.cierreAtrasado,
});

export function estadoDelPortafolio(tablero: Tablero, incompletas: readonly string[]): EstadoInforme {
  return {
    especies: tablero.filas.map(aEspecie),
    valorAcciones: tablero.valorAcciones,
    sinVender: tablero.sinVender,
    especiesSinPrecio: tablero.especiesSinPrecio,
    especiesAtrasadas: tablero.especiesAtrasadas,
    incompletas: [...incompletas],
  };
}
