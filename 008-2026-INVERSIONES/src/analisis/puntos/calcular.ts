/**
 * Los puntos con rango de un análisis (peso, HHI, contribución al riesgo y efecto de una caída) y el de la probabilidad
 * de quedar por debajo de lo aportado. Sin punto con SIN_VALOR, SIN_HISTORIA ni contribución nula o menor que
 * CONTRIBUCION_MINIMA. Puro.
 */
import { CONTRIBUCION_MINIMA } from "../catalogo";
import { redondear } from "../numeros";
import type { Analisis, AnalisisEspecie } from "../tipos";
import { importanciaDe, rangoDe } from "./rangos";
import { identidadDe, type ClavePunto, type Punto, type Sujeto } from "./tipos";

const PORTAFOLIO: Sujeto = { tipo: "PORTAFOLIO" };

function punto(clave: ClavePunto, sujeto: Sujeto, medido: number): Punto[] {
  const tramo = rangoDe(clave, medido);
  return tramo === null ? [] : [{ clave, sujeto, rango: tramo.rango, importancia: importanciaDe(clave, tramo.rango), medido: redondear(medido) }];
}

function deLaEspecie(e: AnalisisEspecie): Punto[] {
  if (e.peso === null) return [];
  const sujeto: Sujeto = { tipo: "ESPECIE", instrumentoId: e.instrumentoId };
  const r = e.riesgo;
  const veces = r.estado === "CUBIERTA" && r.contribucion !== null && r.pesoEnCubiertas > 0 && r.contribucion.contribucionPct >= CONTRIBUCION_MINIMA ? r.contribucion.contribucionPct / r.pesoEnCubiertas : null;
  return [
    ...punto("PESO_ESPECIE", sujeto, e.peso),
    ...(veces === null ? [] : punto("PUNTO_CONTRIBUCION_RIESGO", sujeto, veces)),
    ...(e.efectoCaida === null ? [] : punto("PUNTO_EFECTO_CAIDA", sujeto, Math.abs(e.efectoCaida.fraccionPortafolio))),
  ];
}

export function puntosDelAnalisis(a: Analisis): readonly Punto[] {
  return [...(a.concentracion === null ? [] : punto("PUNTO_CONCENTRACION", PORTAFOLIO, a.concentracion.hhi)), ...a.especies.flatMap(deLaEspecie)];
}

/** null: no se calculó (sin escenarios). */
export function puntoBajoAportado(probabilidad: number | null): readonly Punto[] {
  return probabilidad === null ? [] : punto("PROBABILIDAD_BAJO_APORTADO", PORTAFOLIO, probabilidad);
}

/**
 * Las identidades (clave y sujeto) que el análisis NO pudo calcular: sin concentración, sin valor, sin historia
 * (el riesgo no es CUBIERTA), sin contribución o sin efecto de una caída. Que un punto falte por esto no es un cambio de
 * rango: `compararPuntos` las omite para no inventar «desaparece» ni «aparece». Una contribución por debajo del mínimo SÍ se calculó.
 */
export function sinCalcularDelAnalisis(a: Analisis): readonly string[] {
  const deLaEspecie = (e: AnalisisEspecie): string[] => {
    const sujeto: Sujeto = { tipo: "ESPECIE", instrumentoId: e.instrumentoId };
    const r = e.riesgo;
    const contribucion = r.estado === "CUBIERTA" && r.contribucion !== null && r.pesoEnCubiertas > 0;
    return [
      ...(e.peso === null ? [identidadDe("PESO_ESPECIE", sujeto)] : []),
      ...(contribucion ? [] : [identidadDe("PUNTO_CONTRIBUCION_RIESGO", sujeto)]),
      ...(e.efectoCaida === null ? [identidadDe("PUNTO_EFECTO_CAIDA", sujeto)] : []),
    ];
  };
  return [...(a.concentracion === null ? [identidadDe("PUNTO_CONCENTRACION", PORTAFOLIO)] : []), ...a.especies.flatMap(deLaEspecie)];
}

/** La identidad de la probabilidad cuando los escenarios no se calcularon. */
export const PROBABILIDAD_SIN_CALCULAR: string = identidadDe("PROBABILIDAD_BAJO_APORTADO", PORTAFOLIO);
