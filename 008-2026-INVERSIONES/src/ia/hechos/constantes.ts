/**
 * Constantes de los armadores de hechos (E1b): la versión (va en `versionesCalculo.hechos` de cada paquete), las
 * fuentes que se muestran en «fuente · fecha» y los avisos de lo que faltó o se recortó. Todo cerrado y sin datos.
 */
/** Cambia si cambia cómo se arma o se deriva un hecho: dos paquetes de versiones distintas no son comparables. */
export const VERSION_ARMADORES = "armadores-v1";

export const FUENTES = Object.freeze({
  /** Totales, ganancias, pesos y conteos del tablero (src/tablero/calculo.ts y movimiento.ts). */
  TABLERO: "cálculo de 008 sobre los cierres",
  /** El último cierre de cada especie. */
  CIERRES: "cierres de la BVC",
  /** El nombre de la especie. */
  REGISTRO: "registro de especies de 008",
  CONCILIACION: "conciliación de 008 con la certificación de A&V",
  PLAN: "plan vigente de 008",
  /** Tocada, en el nivel, distancia y días (src/plan/niveles.ts y cierre-frescura.ts). */
  NIVELES: "cálculo de 008 sobre el plan y los cierres",
  DECRETOS: "dividendos decretados registrados en 008",
  PROYECCION: "proyección de 008, escenario ilustrativo",
  /** El valor de unidad del fondo: el mismo texto que `FUENTE_SFC` de src/fondo/sfc.ts (ese módulo llama a la red). */
  FONDO: "sfc:qhpu-8ixx",
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
