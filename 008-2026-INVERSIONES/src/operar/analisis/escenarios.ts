/**
 * Los escenarios del antes y el después con la CAJA dentro del portafolio, como parte fija (sin rendimiento): antes, la
 * caja vigente; después, esa caja con el valor de la orden y la comisión ya restados (compra) o sumado y restada
 * (venta). Sin esto, el «después» sumaba la compra sin restar la caja que sale y comprar siempre «mejoraba» el p50.
 *
 * Usa el motor de src/proyecciones/ tal cual (armarHistoria y simular), sin cambiar sus cálculos:
 * - la caja (y una especie operada que la historia no trae) va en `Cartera.fijo`, la parte fija del motor;
 * - lo aportado no cambia con la operación: es el valor de partida del ANTES en los dos escenarios. El motor toma lo
 *   aportado del total de la cartera y arranca cada trayectoria en total × (1 − caída inicial); por eso el después se
 *   pasa a la escala del antes (× aportado / total) con la caída inicial que lo devuelve a su valor real. Así los
 *   percentiles son los del portafolio de después y la probabilidad se mide contra lo aportado de antes.
 * Puro y sin mutar la entrada.
 */
import { armarHistoria, type ArmadoHistoria } from "@/proyecciones/historia";
import { simular } from "@/proyecciones/simulacion";
import type { EntradasProyeccion, ParametrosProyeccion } from "@/proyecciones/tipos";
import { resumenEscenario } from "./comparar";
import type { AntesDespues, ResumenEscenario, ValorPartida } from "./tipos";

export interface EntradaEscenario {
  readonly historia: EntradasProyeccion;
  /** La caja de este lado (antes o después), en pesos; puede ser negativa si la compra pasa de la caja. */
  readonly caja: number;
  /** El valor al cierre de la especie operada cuando la historia no la trae: entra como parte fija. */
  readonly accionesSinHistoria: number;
}

const CIEN = 100;

const suma = (a: ArmadoHistoria, tipo: "ACCION" | "FONDO"): number => a.posiciones.reduce((t, p) => (p.tipo === tipo ? t + (p.valorHoy ?? 0) : t), 0);

export function valorPartida(a: ArmadoHistoria, e: EntradaEscenario): ValorPartida {
  const acciones = suma(a, "ACCION") + e.accionesSinHistoria;
  const fondo = a.posiciones.some((p) => p.tipo === "FONDO" && p.valorHoy !== null) ? suma(a, "FONDO") : null;
  return { acciones, fondo, caja: e.caja, total: acciones + (fondo ?? 0) + e.caja };
}

function escenario(a: ArmadoHistoria, e: EntradaEscenario, partida: ValorPartida, aportado: number, p: ParametrosProyeccion): ResumenEscenario {
  const escala = partida.total > 0 && aportado > 0 ? aportado / partida.total : 1;
  const queda = (1 - p.caidaInicialPct / CIEN) / escala;
  const cartera = { valores: Float64Array.from(a.columnas, (c) => c.valorHoy * escala), fijo: (a.valorFijo + e.accionesSinHistoria + e.caja) * escala };
  return resumenEscenario(simular(a.historia, cartera, { ...p, caidaInicialPct: (1 - queda) * CIEN }), partida);
}

export function escenariosAntesDespues(antes: EntradaEscenario, despues: EntradaEscenario, p: ParametrosProyeccion): AntesDespues<ResumenEscenario> {
  const armadoAntes = armarHistoria(antes.historia);
  const armadoDespues = armarHistoria(despues.historia);
  const partidaAntes = valorPartida(armadoAntes, antes);
  const partidaDespues = valorPartida(armadoDespues, despues);
  return {
    antes: escenario(armadoAntes, antes, partidaAntes, partidaAntes.total, p),
    despues: escenario(armadoDespues, despues, partidaDespues, partidaAntes.total, p),
  };
}
