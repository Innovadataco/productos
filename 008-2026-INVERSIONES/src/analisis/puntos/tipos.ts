/**
 * Tipos de los puntos con rango y de sus cambios (paso 1 del simulador de /operar, sin IA). Todo es JSON puro: sin
 * Decimal, bigint, Date ni Map, para que el paso 2 lo reciba tal cual. Puro.
 */
export const VERSION_PUNTOS = "puntos-v1";

/** En el orden del catálogo (desempate del orden de los cambios). */
export const CLAVES_PUNTO = [
  "PESO_ESPECIE",
  "PUNTO_CONCENTRACION",
  "PUNTO_CONTRIBUCION_RIESGO",
  "PUNTO_EFECTO_CAIDA",
  "PROBABILIDAD_BAJO_APORTADO",
  "REGLA_TOCADA",
  "REGLA_EN_EL_NIVEL",
  "REGLA_DISTANCIA",
] as const;
export type ClavePunto = (typeof CLAVES_PUNTO)[number];

export type Importancia = "ALTA" | "MEDIA" | "BAJA";

export type Rango =
  | "ELEVADO"
  | "MUY_ELEVADO"
  | "MODERADA"
  | "ELEVADA"
  | "DESPROPORCIONADA"
  | "MUY_DESPROPORCIONADA"
  | "MEDIANO"
  | "GRANDE"
  | "INTERMEDIA"
  | "TOCADA"
  | "EN_EL_NIVEL"
  | "MUY_CERCA"
  | "CERCA"
  | "EN_RANGO";

export type Sujeto =
  | { readonly tipo: "PORTAFOLIO" }
  | { readonly tipo: "ESPECIE"; readonly instrumentoId: string }
  | { readonly tipo: "ORDEN"; readonly reglaId: string; readonly instrumentoId: string };

/** La identidad de un punto: su clave más su sujeto (no sus cifras, que cambian con la operación). */
export const identidadDe = (clave: ClavePunto, sujeto: Sujeto): string => `${clave}|${JSON.stringify(sujeto)}`;

/** Un punto medido en un lado (antes o después). */
export interface Punto {
  readonly clave: ClavePunto;
  readonly sujeto: Sujeto;
  readonly rango: Rango;
  readonly importancia: Importancia;
  /** El valor redondeado que se comparó con los límites (fracción, veces o por ciento de distancia, según la clave). */
  readonly medido: number;
}

export type TipoCambio = "APARECE" | "DESAPARECE" | "SUBE" | "BAJA";

export interface LadoDelCambio {
  readonly rango: Rango;
  readonly importancia: Importancia;
  readonly medido: number;
}

export interface PuntoCambio {
  readonly clave: ClavePunto;
  readonly sujeto: Sujeto;
  readonly cambio: TipoCambio;
  readonly antes: LadoDelCambio | null;
  readonly despues: LadoDelCambio | null;
  /** La mayor entre la de antes y la de después. */
  readonly importancia: Importancia;
  /** Peso de la especie en el después (o en el antes, si salió); 1 en los puntos del portafolio. */
  readonly pesoEspecie: number;
}
