/**
 * Estructura intermedia de la importación de la ficha de inversiones de ODIN (fase B, corte 2).
 * Lleva solo lo que se importa y, de lo demás, línea y código: nunca valores, porque la ficha es
 * real y privada. Los textos (motivo, detalle) viajan a la base, no a la salida.
 */
import type { AccionPlan, CondicionRegla } from "@prisma/client";

/** Lo que se lee pero no se importa: queda reportado con su línea (nunca se descarta en silencio). */
export const CODIGOS_NO_IMPORTADO = [
  "METADATOS",
  "POSICION", // las posiciones y su costo salen de Trii
  "OPERACION_EJECUTADA", // operación ya hecha, escrita en texto: se enlaza en el corte siguiente
  "CIFRA_AGREGADA",
  "CALENDARIO", // entra con la fase de datos oficiales
  "PENDIENTE_DE_DECISION",
  "CONTEXTO",
  "EXCEPCION_EN_DETALLE", // queda en el detalle de su regla; la decisión se registra después
  "SIN_CANTIDAD", // «no actuar» sin cantidad leíble en las posiciones: la regla entra, la decisión no
  "TEXTO_NO_RECONOCIDO",
] as const;

/*
 * Avisos (se importa, con una parte solo en el texto del detalle): PLAZO_EN_TEXTO, CANTIDAD_EN_TEXTO,
 * DESTINO_EN_DETALLE.
 * Bloqueos de lectura (impiden `--aplicar`; no se escribe nada): SIN_FECHA_DE_REFERENCIA, SIN_PLAN,
 * PLAN_SIN_FECHA, PLAN_DUPLICADO, FECHA_DEL_PLAN_INVALIDA, FILA_INCOMPLETA, ESPECIE_NO_RECONOCIDA,
 * DECISION_NO_RECONOCIDA, CANTIDAD_NO_RECONOCIDA (un «1,5» nunca se trunca a 1), CANTIDAD_AMBIGUA y
 * NIVEL_NO_RECONOCIDO. Al analizar se suman los de la base (DUENO_NO_AUTORIZADO, ESPECIE_SIN_INSTRUMENTO,
 * VERSION_EN_CONFLICTO, VIGENCIA_RETROCEDE, PLAN_POSTERIOR), DECISION_ANTES_DE_VIGENCIA y los de las
 * validaciones del corte 1 (con su campo).
 * Al aplicar: ERROR_INTERNO (con la clase del error, nunca su mensaje) si algo ya se escribió, y el
 * aviso CANDADO_NO_SOLTADO si el candado no se soltó limpio.
 */

export type CodigoNoImportado = (typeof CODIGOS_NO_IMPORTADO)[number];

/** Línea (1 = primera) e ítem dentro de la línea (1 = primero) cuando la línea se parte en « · ». */
export interface Hallazgo {
  readonly linea: number;
  readonly item: number | null;
  readonly codigo: string;
  /** Nombre del campo que falló (sin su valor), si aplica. */
  readonly campo?: string;
  /** Solo en ERROR_INTERNO: la clase del error (`Error.name`), nunca su mensaje. */
  readonly nombre?: string;
}

export type Destino = "ESTRUCTURA" | "IMPORTADA" | "NO_IMPORTADA";

export interface LineaClasificada {
  readonly linea: number;
  readonly destino: Destino;
}

export interface ReglaLeida {
  readonly linea: number;
  readonly item: number | null;
  /** Nemotécnico; nulo = regla de portafolio. */
  readonly especie: string | null;
  readonly condicion: CondicionRegla;
  readonly nivel: string | null;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  readonly plazoHasta: Date | null;
  readonly detalle: string;
}

export interface DecisionLeida {
  readonly linea: number;
  readonly especie: string;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  /** Índice en `PlanLeido.reglas` de la regla que cita. */
  readonly indiceRegla: number;
  readonly fechaDecision: Date;
  readonly motivo: string;
}

export interface PlanLeido {
  readonly linea: number;
  readonly vigenteDesde: Date;
  readonly motivo: string;
  readonly reglas: readonly ReglaLeida[];
  readonly decisiones: readonly DecisionLeida[];
}

export interface FichaLeida {
  /** Fecha del pie de la ficha: da el año a las fechas día-mes. */
  readonly referencia: Date | null;
  readonly plan: PlanLeido | null;
  readonly noImportados: readonly Hallazgo[];
  readonly avisos: readonly Hallazgo[];
  readonly bloqueos: readonly Hallazgo[];
  /** Cada línea no vacía, una sola vez. */
  readonly lineas: readonly LineaClasificada[];
}

/**
 * Códigos de no importado que quedan «pendientes de enlazar» (corte siguiente, con el dueño): una
 * operación ya ejecutada se enlaza a su orden de Trii, y una excepción se registra como decisión que
 * cita su regla. El CALENDARIO no va aquí: no se enlaza a nada, entra con la fase de datos oficiales
 * (dividendos decretados con fuente oficial y fecha ex), no como decisión del plan.
 */
export const PENDIENTES_DE_ENLAZAR: ReadonlySet<string> = new Set<CodigoNoImportado>(["OPERACION_EJECUTADA", "EXCEPCION_EN_DETALLE"]);
