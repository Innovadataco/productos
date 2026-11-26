import "server-only";
/**
 * Los parámetros de la configuración de la IA (fase E, E8): las listas cerradas y los límites de lo que Jelk configura
 * en /edicion/ia, en un solo lugar. Las CHECK de `config_ia` (migración *_config_ia) los repiten y una prueba espejo
 * cuida que no se separen (tests/unit/ia/config/esquema.test.ts). Los modos, los modelos de la nube, los esfuerzos y
 * los modelos locales NO se definen aquí: son de `puertas.ts`, `nube/peticion.ts` y la lista que publica PI.
 *
 * Lo que NO se configura (y por qué, en la pantalla), como en PI: los JSON Schemas de salida, el validador (sus límites y
 * su vocabulario: cambiarlos es otra versión del validador), la vista ciega, la resolución del destino y la semilla fija
 * de la local; y, propio de 008, el `keep_alive` corto con un pedido a la vez y el `num_ctx` fijo (`NUM_CTX_LOCAL`, aprobado por PI: 008
 * no deja un modelo residente en el Mac de PI ni lo hace recargar). La temperatura de la local SÍ se configura (de 0 a 1,
 * 0 por omisión), como en PI.
 */
import { TIPOS_RESUMEN, type TipoResumen } from "../contrato";
import { TECHO_TOPE_MICRO_USD } from "../nube/config";
import { MODOS_PUERTAS, ordenDePuertas, type ModoPuertas } from "../puertas";

/** Las columnas de config_ia (la lista única de las pruebas de permisos). */
export const COLUMNAS_CONFIG_IA = Object.freeze([
  "id", "version", "modo", "ollamaHost", "ollamaPuerto", "temperaturaLocal", "tareas", "modeloNube", "topeMensualUsd", "horaResumen", "limiteSegundos",
  "analisisDemanda", "esfuerzoNube", "motivo", "autorId", "creadaEn",
] as const);

/**
 * Las tareas de la IA (como en PI, un modelo por tarea): hoy, los tres tipos de resumen. Una tarea futura (p. ej. OPERAR
 * o ANALISIS) se agrega aquí, a la CHECK `config_ia_tareas_chk` y a su prompt; la pantalla y el lector la toman de esta
 * lista, sin columnas nuevas.
 */
export const TAREAS_IA: readonly TipoResumen[] = TIPOS_RESUMEN;
export type TareaIa = TipoResumen;

/** La temperatura de la local, en centésimas: de 0 a 1 (0 por omisión: el mismo dato, el mismo texto). */
export const TEMPERATURA_MIN_CENTESIMAS = 0;
export const TEMPERATURA_MAX_CENTESIMAS = 100;
export const TEMPERATURA_POR_OMISION_CENTESIMAS = 0;

/** Las horas del resumen, en hora de Colombia (después de los precios de las 17:00). Por omisión, la que confirmó Jelk. */
export const HORAS_RESUMEN = Object.freeze(["18:00", "19:00", "20:00", "21:00"] as const);
export type HoraResumen = (typeof HORAS_RESUMEN)[number];
export const HORA_POR_OMISION: HoraResumen = "19:00";

/**
 * El límite de tiempo por pedido, en segundos: de 10 a 60 (condición de PI, 26-nov-2026: el análisis a demanda no puede
 * retener el Mac más de 60 s). La CHECK de la base queda en `LIMITE_MAX_BD_S` (120, el tope viejo de PI) porque la tabla
 * es de solo inserción y las versiones viejas pueden traer más de 60: el lector las acota a 60 (`filaAConfig`).
 */
export const LIMITE_MIN_S = 10;
export const LIMITE_MAX_S = 60;
export const LIMITE_POR_OMISION_S = 60;
export const LIMITE_MAX_BD_S = 120;

/** El tope mensual de la nube: de USD 1 al techo de cordura (TECHO_TOPE_MICRO_USD, USD 50). En micro-USD. */
export const TOPE_MIN_MICRO_USD = 1_000_000n;
export const TOPE_MAX_MICRO_USD = TECHO_TOPE_MICRO_USD;

export const MAX_LARGO_MOTIVO_CONFIG = 2000;

/** El modelo local recomendado para 008 y el de omisión, SOLO si está en la lista que leyó la app. */
export const MODELO_LOCAL_RECOMENDADO = "qwen2.5:14b";

/** Los modos que usan cada puerta (salen del orden de las puertas: una sola fuente). */
export const MODOS_CON_LOCAL: readonly ModoPuertas[] = Object.freeze(MODOS_PUERTAS.filter((m) => ordenDePuertas(m).includes("local")));
export const MODOS_CON_NUBE: readonly ModoPuertas[] = Object.freeze(MODOS_PUERTAS.filter((m) => ordenDePuertas(m).includes("nube")));

export const usaLocal = (modo: ModoPuertas): boolean => MODOS_CON_LOCAL.includes(modo);
export const usaNube = (modo: ModoPuertas): boolean => MODOS_CON_NUBE.includes(modo);
