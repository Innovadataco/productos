/**
 * Catálogo CERRADO de los puntos para revisar (fase E, A1). Puro.
 * Cada observación es un hecho que pide la atención del dueño: dice qué dato cruzó qué umbral y con qué ids. No es una
 * acción ni un juicio. Los umbrales son constantes nombradas con su razón; la pantalla los muestra tal cual.
 * Ninguno está calibrado con datos todavía: son el punto de partida de la v1 y se ajustan viéndolos en la pantalla.
 */
import type { Prisma } from "@prisma/client";
import type { HorizonteDias } from "../plan/resultado";
import { MINIMO_DIAS } from "../proyecciones/metodo";
import type { Dia } from "../proyecciones/tipos";
import type { MotivoSinHistoria } from "./tipos";

/** En el orden en que se devuelven. */
export const CLAVES_OBSERVACION = [
  "CONCENTRACION_ALTA",
  "CONCENTRACION_TOP_TRES",
  "CORRELACION_ALTA",
  "CONTRIBUCION_RIESGO_DESPROPORCIONADA",
  "REGLA_CUMPLIDA",
  "REGLA_CERCANA",
  "REGLA_VENCE_PRONTO",
  "REGLA_VENCIDA",
  "PRECIO_ATRASADO",
  "PRECIOS_SIN_ACTUALIZAR",
  "DECISION_RESULTADO_NEGATIVO",
  "EX_DIVIDENDO_PRONTO",
  "HISTORIA_INSUFICIENTE",
] as const;
export type ClaveObservacion = (typeof CLAVES_OBSERVACION)[number];

/** Peso de la especie de mayor valor (fracción). Más de un cuarto del valor en una sola especie: 0,25 = 1/4, el peso de
 * cada una en un portafolio de cuatro especies iguales. Dispara con peso estrictamente mayor. */
export const UMBRAL_PESO_PRIMERA = 0.25;
/** Peso de las tres primeras (fracción). Más de tres quintos en tres especies; con tres o menos la suma es siempre 1,
 * por eso solo se mide con MINIMO_ESPECIES_TOP_TRES o más. Dispara con peso estrictamente mayor. */
export const UMBRAL_PESO_TOP_TRES = 0.6;
export const MINIMO_ESPECIES_TOP_TRES = 4;
/** Correlación de los retornos diarios de precio, por par. Con ρ ≥ 0,8, ρ² ≥ 0,64: más de la mitad de la varianza diaria
 * de una se explica linealmente por la otra. Solo la positiva (dos que suben y bajan juntas). */
export const UMBRAL_CORRELACION = 0.8;
/** Contribución porcentual al riesgo sobre el peso cubierto (veces). La especie aporta al riesgo al menos 1,5 veces lo
 * que pesa; y solo si su contribución es al menos CONTRIBUCION_MINIMA, para no señalar diferencias que no mueven el total. */
export const FACTOR_CONTRIBUCION_DESPROPORCIONADA = 1.5;
export const CONTRIBUCION_MINIMA = 0.1;
/** Distancia al nivel de la regla (por ciento del cierre). La regla se toca cuando el cierre al día pasa el nivel
 * (src/plan/niveles.ts): distancia 0. El nivel lo puso el dueño; el motor no agrega un umbral propio. */
export const DISTANCIA_REGLA_CUMPLIDA_PCT = 0;
/** Distancia al nivel (por ciento del cierre, en valor absoluto) para decir que está cerca. 5 %: punto de partida sin
 * calibrar; se compara con la distancia redondeada a dos decimales, la misma que muestra /plan. */
export const UMBRAL_REGLA_CERCANA_PCT = 5;
/** Días calendario hasta el plazo de la regla: dos semanas para verla antes de que venza. */
export const DIAS_REGLA_VENCE_PRONTO = 14;
/** Días calendario desde que venció el plazo: desde el día siguiente al plazo. Sin tope: una regla vencida que sigue
 * en la versión vigente del plan es justo lo que hay que ver. */
export const DIAS_REGLA_VENCIDA = 1;
/** Ruedas de la BVC sin cierre de la especie antes de la fecha de referencia: con una ya no es el precio del día. */
export const RUEDAS_PRECIO_ATRASADO = 1;
/** Ruedas de la BVC entre la referencia y el último día hábil antes de hoy: con una, la carga de precios se detuvo. */
export const RUEDAS_PRECIOS_SIN_ACTUALIZAR = 1;
/** Días calendario desde que se conoció un resultado NO_FUNCIONO (src/plan/resultado.ts: pesos < 0): un mes, para que
 * la lista muestre lo reciente; el resumen de decisiones cuenta todos. */
export const DIAS_DECISION_RECIENTE = 30;
/** El resultado en pesos que hace NO_FUNCIONO una decisión (el veredicto de src/plan/resultado.ts): menor que cero. */
export const RESULTADO_PESOS_MENOR_QUE = 0;
/** Días calendario hasta la fecha ex de un decreto que cuenta: las mismas dos semanas de las reglas. */
export const DIAS_EX_DIVIDENDO_PRONTO = 14;
/** Días con cierre propio en la ventana común: el mínimo del motor de proyecciones (≈ un año de la BVC). */
export const DIAS_HISTORIA_SUFICIENTE = MINIMO_DIAS;

export type UnidadUmbral = "FRACCION" | "CORRELACION" | "VECES" | "PORCENTAJE" | "DIAS" | "RUEDAS";

/** Cómo se compara lo medido con el umbral (DE_CERO_HASTA: 0 ≤ medido ≤ umbral; PASA_EL_NIVEL: la condición de la regla). */
export type Comparacion = "MAYOR_QUE" | "MAYOR_O_IGUAL" | "MENOR_QUE" | "DE_CERO_HASTA" | "VALOR_ABSOLUTO_HASTA" | "PASA_EL_NIVEL";

export interface Criterio {
  readonly umbral: number;
  readonly unidad: UnidadUmbral;
  readonly comparacion: Comparacion;
  /** Los otros umbrales nombrados que también deben cumplirse. */
  readonly auxiliares: Readonly<Record<string, number>>;
}

const criterio = <const A extends Readonly<Record<string, number>>, const U extends number>(umbral: U, unidad: UnidadUmbral, comparacion: Comparacion, auxiliares: A) =>
  Object.freeze({ umbral, unidad, comparacion, auxiliares: Object.freeze(auxiliares) });

/** El registro único del catálogo: cada clave con su criterio completo. La pantalla lo muestra tal cual. */
export const CRITERIOS = Object.freeze({
  CONCENTRACION_ALTA: criterio(UMBRAL_PESO_PRIMERA, "FRACCION", "MAYOR_QUE", {}),
  CONCENTRACION_TOP_TRES: criterio(UMBRAL_PESO_TOP_TRES, "FRACCION", "MAYOR_QUE", { minimoEspecies: MINIMO_ESPECIES_TOP_TRES }),
  CORRELACION_ALTA: criterio(UMBRAL_CORRELACION, "CORRELACION", "MAYOR_O_IGUAL", {}),
  CONTRIBUCION_RIESGO_DESPROPORCIONADA: criterio(FACTOR_CONTRIBUCION_DESPROPORCIONADA, "VECES", "MAYOR_O_IGUAL", { contribucionMinima: CONTRIBUCION_MINIMA }),
  REGLA_CUMPLIDA: criterio(DISTANCIA_REGLA_CUMPLIDA_PCT, "PORCENTAJE", "PASA_EL_NIVEL", {}),
  REGLA_CERCANA: criterio(UMBRAL_REGLA_CERCANA_PCT, "PORCENTAJE", "VALOR_ABSOLUTO_HASTA", {}),
  REGLA_VENCE_PRONTO: criterio(DIAS_REGLA_VENCE_PRONTO, "DIAS", "DE_CERO_HASTA", {}),
  REGLA_VENCIDA: criterio(DIAS_REGLA_VENCIDA, "DIAS", "MAYOR_O_IGUAL", {}),
  PRECIO_ATRASADO: criterio(RUEDAS_PRECIO_ATRASADO, "RUEDAS", "MAYOR_O_IGUAL", {}),
  PRECIOS_SIN_ACTUALIZAR: criterio(RUEDAS_PRECIOS_SIN_ACTUALIZAR, "RUEDAS", "MAYOR_O_IGUAL", {}),
  DECISION_RESULTADO_NEGATIVO: criterio(DIAS_DECISION_RECIENTE, "DIAS", "DE_CERO_HASTA", { resultadoPesosMenorQue: RESULTADO_PESOS_MENOR_QUE }),
  EX_DIVIDENDO_PRONTO: criterio(DIAS_EX_DIVIDENDO_PRONTO, "DIAS", "DE_CERO_HASTA", {}),
  HISTORIA_INSUFICIENTE: criterio(DIAS_HISTORIA_SUFICIENTE, "DIAS", "MENOR_QUE", {}),
} as const satisfies Readonly<Record<ClaveObservacion, Criterio>>);

interface ObservacionDe<C extends ClaveObservacion, D> {
  readonly clave: C;
  /** CRITERIOS[clave].umbral. */
  readonly umbral: (typeof CRITERIOS)[C]["umbral"];
  /** Lo medido y los ids que la sostienen. */
  readonly datos: D;
}

export type Observacion =
  | ObservacionDe<"CONCENTRACION_ALTA", { readonly instrumentoId: string; readonly peso: number }>
  | ObservacionDe<"CONCENTRACION_TOP_TRES", { readonly instrumentoIds: readonly [string, string, string]; readonly peso: number }>
  | ObservacionDe<"CORRELACION_ALTA", { readonly instrumentoIds: readonly [string, string]; readonly correlacion: number }>
  | ObservacionDe<
      "CONTRIBUCION_RIESGO_DESPROPORCIONADA",
      { readonly instrumentoId: string; readonly pesoEnCubiertas: number; readonly contribucionPct: number; readonly veces: number }
    >
  | ObservacionDe<"REGLA_CUMPLIDA", { readonly reglaId: string; readonly instrumentoId: string; readonly lado: "BAJO" | "SOBRE" }>
  | ObservacionDe<"REGLA_CERCANA", { readonly reglaId: string; readonly instrumentoId: string; readonly distanciaPct: number }>
  /** instrumentoId null: la regla es de portafolio. */
  | ObservacionDe<"REGLA_VENCE_PRONTO", { readonly reglaId: string; readonly instrumentoId: string | null; readonly plazo: Dia; readonly dias: number }>
  | ObservacionDe<"REGLA_VENCIDA", { readonly reglaId: string; readonly instrumentoId: string | null; readonly plazo: Dia; readonly dias: number }>
  /** ultimoCierre null: la especie no tiene cierre. */
  | ObservacionDe<"PRECIO_ATRASADO", { readonly instrumentoId: string; readonly ultimoCierre: { readonly dia: Dia; readonly sinNegociacionDesde: Dia } | null }>
  | ObservacionDe<"PRECIOS_SIN_ACTUALIZAR", { readonly referencia: Dia }>
  | ObservacionDe<
      "DECISION_RESULTADO_NEGATIVO",
      { readonly decisionId: string; readonly horizonteDias: HorizonteDias; readonly resultadoPesos: Prisma.Decimal; readonly conocidoEl: Dia; readonly dias: number }
    >
  | ObservacionDe<"EX_DIVIDENDO_PRONTO", { readonly instrumentoId: string; readonly decretoId: string; readonly fechaEx: Dia; readonly dias: number }>
  | ObservacionDe<"HISTORIA_INSUFICIENTE", { readonly instrumentoId: string; readonly motivo: MotivoSinHistoria; readonly dias: number }>;

/** Cada clave del catálogo tiene su forma en la unión, y ninguna forma usa una clave de fuera (falla al compilar). */
type Iguales<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const UNION_CUBRE_EL_CATALOGO: Iguales<Observacion["clave"], ClaveObservacion> = true;
