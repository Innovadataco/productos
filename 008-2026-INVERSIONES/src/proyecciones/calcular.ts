/**
 * La proyección completa, pura: arma la historia de las entradas, simula el escenario y escribe los supuestos. El
 * resultado es JSON puro y lleva siempre el aviso «escenario ilustrativo, no es recomendación ni promesa».
 */
import { diaIso } from "../precios/horario";
import { armarHistoria } from "./historia";
import { VERSION_METODO } from "./metodo";
import { simular } from "./simulacion";
import { armarSupuestos } from "./supuestos";
import { AVISO, type EntradasProyeccion, type ParametrosProyeccion, type ResultadoProyeccion } from "./tipos";

export function calcularProyeccion(e: EntradasProyeccion, p: ParametrosProyeccion): ResultadoProyeccion {
  const armado = armarHistoria(e);
  const s = simular(armado.historia, { valores: Float64Array.from(armado.columnas.map((c) => c.valorHoy)), fijo: armado.valorFijo }, p);
  return {
    aviso: AVISO, versionMetodo: VERSION_METODO, parametros: { ...p }, hoy: diaIso(e.hoy), valorHoy: armado.valorHoy, puntos: s.puntos,
    probabilidadBajoAportado: s.probabilidadBajoAportado, caidaMaximaMediana: s.caidaMaximaMediana, supuestos: armarSupuestos(armado, p),
  };
}
