/**
 * Constantes de los armadores de hechos (E1b): la versión (va en `versionesCalculo.hechos` de cada paquete), las
 * fuentes que se muestran en «fuente · fecha» y los avisos de lo que faltó o se recortó. Todo cerrado y sin datos.
 */
/** Cambia si cambia cómo se arma o se deriva un hecho: dos paquetes de versiones distintas no son comparables. */
export const VERSION_ARMADORES = "armadores-v1";

export const FUENTES = Object.freeze({
  /** Totales, ganancias, pesos y conteos del tablero (src/tablero/calculo.ts y movimiento.ts). */
  TABLERO: "cálculo de Inversiones sobre los cierres",
  /** El último cierre de cada especie. */
  CIERRES: "cierres de la BVC",
  /** El nombre de la especie. */
  REGISTRO: "registro de especies de Inversiones",
  CONCILIACION: "conciliación de Inversiones con la certificación de A&V",
  PLAN: "plan vigente de Inversiones",
  /** Tocada, en el nivel, distancia y días (src/plan/niveles.ts y cierre-frescura.ts). */
  NIVELES: "cálculo de Inversiones sobre el plan y los cierres",
  DECRETOS: "dividendos decretados registrados en Inversiones",
  PROYECCION: "proyección de Inversiones, escenario ilustrativo",
  /** El valor de unidad del fondo, en palabras: el identificador del conjunto de la SFC (`FUENTE_SFC` de src/fondo/sfc.ts) no se lee. */
  FONDO: "valor de unidad de la Superintendencia Financiera (SFC)",
});

/** Los avisos que agregan los armadores, en el orden en que salen en el paquete. */
export const CODIGOS_AVISO_ARMADO = Object.freeze([
  "SIN_CIERRES",
  "MOVIMIENTO_SIN_CIERRES", "MOVIMIENTO_CALENDARIO_NO_CUBRE", "MOVIMIENTO_REFERENCIA_NO_HABIL", "MOVIMIENTO_SIN_RUEDA_PREVIA",
  "CONCILIACION_PENDIENTE", "CONCILIACION_SIN_CORTE",
  "REGLA_SIN_NOMBRE", "PROXIMO_SIN_NOMBRE", "DIVIDENDOS_PROXIMOS_OMITIDOS",
  "CALENDARIO_NO_CUBRE", "HECHOS_RECORTADOS",
] as const);
export type CodigoAvisoArmado = (typeof CODIGOS_AVISO_ARMADO)[number];

/** Los avisos dados, sin repetir y en el orden de `CODIGOS_AVISO_ARMADO`. */
export function ordenarAvisos(avisos: Iterable<CodigoAvisoArmado>): readonly CodigoAvisoArmado[] {
  const dados = new Set(avisos);
  return CODIGOS_AVISO_ARMADO.filter((codigo) => dados.has(codigo));
}
