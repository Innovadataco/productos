/**
 * Tipos de la evaluación de la IA local (E7). Solo tipos y constantes cerradas: el arnés corre los modelos de Ollama
 * sobre paquetes de hechos (inventados en el CI; los del portafolio, exportados por la vía B, solo en el Mac) y mide
 * cuántos resúmenes publica el validador, por qué rechaza, cuánto tarda y si repite.
 *
 * Un registro de corrida NUNCA lleva el destino (IP y puerto) ni datos del pedido: el texto renderizado (con cifras) y
 * la salida cruda del modelo van solo a la carpeta de resultados (0700, fuera de todo repo), nunca a la terminal.
 */
import type { TipoResumen, PaqueteHechos } from "../contrato";
import type { CodigoValidador } from "../validador/codigos";
import type { Hallazgo } from "../validador/tipos";

/** Un paquete con su id estable: «DIARIO-01» (inventados) o «DIARIO» (exportados). */
export interface CasoEvaluacion {
  readonly id: string;
  readonly tipo: TipoResumen;
  readonly paquete: PaqueteHechos;
}

/** De dónde salen los casos: los 40 inventados del arnés o el archivo exportado del portafolio. */
export const ORIGENES_CASOS = Object.freeze(["INVENTADOS", "PAQUETES"] as const);
export type OrigenCasos = (typeof ORIGENES_CASOS)[number];

/**
 * El estado de una corrida:
 * - PUBLICADO / RECHAZADO: el modelo respondió y el validador decidió;
 * - FALLIDO: la puerta no dio salida (sin modelo, tiempo agotado, error del proveedor);
 * - CORTADO: se detuvo por la señal del operador (PARA): no cuenta en ninguna métrica.
 */
export const ESTADOS_CORRIDA = Object.freeze(["PUBLICADO", "RECHAZADO", "FALLIDO", "CORTADO"] as const);
export type EstadoCorrida = (typeof ESTADOS_CORRIDA)[number];

export const PASADAS = Object.freeze([1, 2] as const);
export type Pasada = (typeof PASADAS)[number];

export interface RegistroCorrida {
  readonly caso: string;
  readonly tipo: TipoResumen;
  readonly modelo: string;
  readonly pasada: Pasada;
  /** Posición de la corrida en la evaluación del modelo (desde 1): la primera es la carga en frío. */
  readonly orden: number;
  /** Instante de inicio (ISO), para cruzarlo con lo que hizo PI en el Mac. */
  readonly inicio: string;
  readonly estado: EstadoCorrida;
  /** RECHAZADO: los códigos del validador; FALLIDO o CORTADO: el motivo de la puerta; PUBLICADO: vacío. */
  readonly motivos: readonly string[];
  /** FALLIDO o CORTADO: el detalle de la puerta (un código); si no, null. */
  readonly detalle: string | null;
  readonly hallazgos: readonly Hallazgo[];
  /** La latencia que midió el cliente (tags y generate); null si no hubo salida. */
  readonly latenciaMs: number | null;
  /** Lo que tardó la corrida entera, medido por el arnés. */
  readonly duracionMs: number;
  /** Si la puerta agotó su límite (cuenta como «más que el límite» en el p95). */
  readonly agotado: boolean;
  readonly tokensEntrada: number | null;
  readonly tokensSalida: number | null;
  /** Caracteres del prompt del sistema más la vista ciega: para ver si Ollama recortó el contexto. */
  readonly caracteresPedido: number;
  readonly modeloDigest: string | null;
  /** La salida del modelo tal cual (solo citas «{Hnn}»: el modelo no ve cifras), o null si no hubo. */
  readonly salidaCruda: string | null;
  readonly salidaHash: string | null;
  /** El resumen renderizado por el código (con cifras), solo si se publicó. */
  readonly texto: string | null;
  /** Hechos citados (sin los nombres de especie) y hechos del paquete (sin los nombres). */
  readonly citados: number;
  readonly hechos: number;
  readonly hechosHash: string;
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly validadorVersion: string;
}

/** La plantilla sin IA de un caso (línea base), pasada por el mismo validador. */
export interface RegistroPlantilla {
  readonly caso: string;
  readonly tipo: TipoResumen;
  readonly estado: "PUBLICADO" | "RECHAZADO";
  readonly motivos: readonly CodigoValidador[];
  readonly texto: string | null;
}

/** Cómo terminó la evaluación de un modelo. */
export const ESTADOS_FIN = Object.freeze(["COMPLETA", "SIN_MODELO", "CORTADA_POR_SENAL", "CORTADA_POR_FALLOS"] as const);
export type EstadoFin = (typeof ESTADOS_FIN)[number];

export interface FinEvaluacion {
  readonly estado: EstadoFin;
  /** Corridas registradas (con las cortadas). */
  readonly corridas: number;
  /** SIN_MODELO o CORTADA_POR_FALLOS: el último motivo y detalle de la puerta (códigos). */
  readonly motivo: string | null;
  readonly detalle: string | null;
}
