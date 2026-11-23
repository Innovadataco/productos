/**
 * Tipos del análisis del antes y el después de una operación simulada en /operar. Las cifras salen del motor de
 * src/analisis/ y de src/proyecciones/ sin cambiar sus cálculos: aquí solo se eligen y se comparan. Puro.
 */
import type { Observacion } from "@/analisis/catalogo";

export interface AntesDespues<T> {
  readonly antes: T;
  readonly despues: T;
}

/** La concentración del motor: la primera especie, el peso de las tres primeras y el HHI (fracciones de 0 a 1). */
export interface ConcentracionResumida {
  readonly primera: { readonly instrumentoId: string; readonly peso: number };
  readonly tresPrimeras: number;
  readonly hhi: number;
}

export interface ComparacionAnalisis {
  /** null sin especies con valor. */
  readonly concentracion: AntesDespues<ConcentracionResumida | null>;
  /** Volatilidad anual del portafolio (fracción); null sin historia común. */
  readonly volatilidad: AntesDespues<number | null>;
  /** Peso de la especie operada sobre el valor de las acciones (fracción); null si no tiene valor. */
  readonly pesoOperada: AntesDespues<number | null>;
  /** Contribución porcentual de la especie operada al riesgo (fracción); null si no se calcula. */
  readonly contribucionOperada: AntesDespues<number | null>;
  /** Los «puntos para revisar» que aparecen o desaparecen con la operación. */
  readonly puntos: { readonly aparecen: readonly Observacion[]; readonly desaparecen: readonly Observacion[] };
}

export interface PuntoEscenario {
  readonly mes: number;
  readonly p5: number;
  readonly p50: number;
  readonly p95: number;
}

/** El valor de partida de un escenario (pesos): las acciones y el fondo a su último valor y la caja, que es parte fija. */
export interface ValorPartida {
  readonly acciones: number;
  /** null si el fondo no entra (no hay fondo con valor). */
  readonly fondo: number | null;
  readonly caja: number;
  readonly total: number;
}

/** De dónde sale la caja de antes: la que escribió el dueño, la certificada por A&V o 0 si no hay certificación. */
export type FuenteCaja = "ESCRITA" | "AV" | "SIN_CERTIFICACION";

/**
 * De una simulación: el valor de partida, p5, p50 y p95 a 3, 6 y 12 meses (en pesos) y la probabilidad de quedar por
 * debajo de lo aportado (el valor de partida de antes: la operación no lo cambia).
 */
export interface ResumenEscenario {
  readonly partida: ValorPartida;
  readonly puntos: readonly PuntoEscenario[];
  readonly probabilidadBajoAportado: number;
}
