/**
 * Catálogo de las series oficiales que guarda 008 (fase C; vive en el código, P4: una serie nueva no necesita
 * migración). Decisión P1 de la Fábrica: TRM, TPM, IBR_3M_EA e IPC_INDICE; la tasa de referencia de la fase D es
 * IBR_3M_EA y la TPM se guarda como contexto; TES y UVR quedan fuera de esta versión.
 *
 * Cada serie dice lo que la fuente publica, sin convertir (valor_serie_oficial guarda una vigencia por fila):
 * - `fuente`: el texto exacto que va en valor_serie_oficial.fuente (CHECK de la migración *_datos_oficiales). El CSV
 *   de series (series/csv-series.ts) solo acepta esta.
 * - `vigencia`: DIA (desde = hasta), TRAMO (de 1 a `maxDias` días, cerrada en los dos extremos) o MES (del día 1 al
 *   último del mes; el mes ya terminado).
 * - `escala`: decimales máximos del valor; `rango`: banda de cordura, cerrada, en texto decimal (nunca Number).
 * - `adelantoMaximoDias`: cuántos días después de hoy puede empezar una vigencia (la TRM se publica por adelantado).
 * - `umbralFrescuraDias`: días desde el `hasta` del último valor vigente a partir de los cuales la lectura (C5a) lo
 *   muestra atrasado.
 *
 * POR VERIFICAR (no se inventa: queda dicho aquí y en cada constante): las escalas se observaron en las descargas
 * públicas del plan (2026-11-21), no en la ficha de cada fuente; los rangos son bandas de cordura que fijó la Fábrica
 * (separan la unidad correcta de los errores típicos: fracción en vez de %, una cifra de más), no datos de la fuente; los
 * umbrales de frescura son los sugeridos por el plan; el largo máximo de la vigencia de la TRM y su adelanto salen
 * de un cálculo con el calendario, no de lo publicado en festivos.
 *
 * Sin imports a propósito: la pantalla (C6a) lo podrá usar desde src/app (tests/unit/datos-oficiales/catalogo.test.ts).
 */

export type Cadencia = "VIGENCIA_DIARIA" | "DIARIA_CALENDARIO" | "DIAS_HABILES" | "MENSUAL";

export type FormaVigencia =
  | { readonly tipo: "DIA" }
  | { readonly tipo: "TRAMO"; readonly maxDias: number }
  | { readonly tipo: "MES" };

export interface RangoCordura {
  /** Texto decimal canónico, incluido. */
  readonly min: string;
  /** Texto decimal canónico, incluido. */
  readonly max: string;
}

export interface SerieCatalogo {
  readonly codigo: string;
  readonly nombre: string;
  readonly unidad: string;
  readonly cadencia: Cadencia;
  readonly vigencia: FormaVigencia;
  readonly escala: number;
  readonly rango: RangoCordura;
  readonly adelantoMaximoDias: number;
  readonly umbralFrescuraDias: number;
  readonly fuente: string;
  /** De dónde sale, para la pantalla. */
  readonly origen: string;
  /** VIA_B: la carga el dueño con `importar-series` (§11 del runbook). El servicio de la TRM (C7) no está en esta versión. */
  readonly entrada: "VIA_B";
}

/** La tasa de referencia de la fase D (decisión P1 de la Fábrica). */
export const SERIE_TASA_REFERENCIA = "IBR_3M_EA";

/**
 * Largo máximo de una vigencia de la TRM (días, cerrada). Verificado: la del 21-nov-2026 va del 21 al 23 (3 días, un
 * fin de semana). Por cálculo con el calendario, un fin de semana con festivo da 4 y Semana Santa 5; lo publicado en
 * festivos está POR VERIFICAR (§12 del plan). 7 = una semana, con margen.
 */
export const MAX_DIAS_VIGENCIA_TRM = 7;
/**
 * La SFC publica la TRM por adelantado: la vigencia empieza el día siguiente al de su publicación. 1 día POR VERIFICAR
 * en festivos.
 */
export const ADELANTO_TRM_DIAS = 1;
/** Umbrales de frescura sugeridos por el plan (§5), POR VERIFICAR: TRM 3 días, TPM e IBR 7, IPC 45 después del fin del mes. */
export const FRESCURA_TRM_DIAS = 3;
export const FRESCURA_TASAS_DIAS = 7;
export const FRESCURA_IPC_DIAS = 45;
/**
 * Bandas de cordura (POR VERIFICAR con la Fábrica; no son datos de la fuente). Lo observado en las descargas públicas
 * del plan (2026-11-21: la TPM desde 2000, la IBR, la TRM de BanRep y el anexo del IPC) cae holgadamente dentro. Un %
 * escrito como fracción queda por debajo del piso; una cifra de más (separador de miles mal leído), por encima del techo.
 */
const RANGO_TASAS: RangoCordura = Object.freeze({ min: "0.5", max: "50" });
const RANGO_TRM: RangoCordura = Object.freeze({ min: "100", max: "50000" });
const RANGO_IPC: RangoCordura = Object.freeze({ min: "10", max: "1000" });

const serieCongelada = (s: SerieCatalogo): SerieCatalogo => Object.freeze({ ...s, vigencia: Object.freeze({ ...s.vigencia }), rango: Object.freeze({ ...s.rango }) });

export const CATALOGO: readonly SerieCatalogo[] = Object.freeze([
  serieCongelada({
    codigo: "TRM",
    nombre: "Tasa Representativa del Mercado",
    unidad: "COP por USD",
    cadencia: "VIGENCIA_DIARIA",
    vigencia: { tipo: "TRAMO", maxDias: MAX_DIAS_VIGENCIA_TRM },
    // POR VERIFICAR: 2 decimales observados en la TRM de BanRep (DF_TRM_DAILY_HIST), no en el dataset 32sa-8pi3.
    escala: 2,
    rango: RANGO_TRM,
    adelantoMaximoDias: ADELANTO_TRM_DIAS,
    umbralFrescuraDias: FRESCURA_TRM_DIAS,
    fuente: "sfc:32sa-8pi3",
    origen: "Superintendencia Financiera · datos.gov.co, dataset 32sa-8pi3",
    entrada: "VIA_B",
  }),
  serieCongelada({
    codigo: "TPM",
    nombre: "Tasa de política monetaria",
    unidad: "% anual",
    cadencia: "DIARIA_CALENDARIO",
    vigencia: { tipo: "DIA" },
    // Observado: hasta 2 decimales (POR VERIFICAR con la ficha de BanRep).
    escala: 2,
    rango: RANGO_TASAS,
    adelantoMaximoDias: 0,
    umbralFrescuraDias: FRESCURA_TASAS_DIAS,
    fuente: "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA",
    origen: "Banco de la República · SDMX DF_CBR_DAILY_HIST (IRCBRM01, PA)",
    entrada: "VIA_B",
  }),
  serieCongelada({
    codigo: "IBR_3M_EA",
    nombre: "IBR a 3 meses, efectiva anual",
    unidad: "% efectivo anual",
    cadencia: "DIAS_HABILES",
    vigencia: { tipo: "DIA" },
    // Observado: hasta 3 decimales. Que UNIT_MEASURE ER sea la efectiva anual: POR VERIFICAR con la ficha de BanRep.
    escala: 3,
    rango: RANGO_TASAS,
    adelantoMaximoDias: 0,
    umbralFrescuraDias: FRESCURA_TASAS_DIAS,
    fuente: "banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER",
    origen: "Banco de la República · SDMX DF_IBR_DAILY_HIST (IRIBRM03, ER)",
    entrada: "VIA_B",
  }),
  serieCongelada({
    codigo: "IPC_INDICE",
    nombre: "Índice de precios al consumidor",
    unidad: "índice (base dic-2018 = 100)",
    cadencia: "MENSUAL",
    vigencia: { tipo: "MES" },
    // El DANE publica 2 decimales (65.510000000000005 es un artefacto del xlsx; el lector de C2d lo redondea).
    escala: 2,
    rango: RANGO_IPC,
    adelantoMaximoDias: 0,
    umbralFrescuraDias: FRESCURA_IPC_DIAS,
    fuente: "dane:anex-IPC-Indices",
    origen: "DANE · anexo mensual anex-IPC-Indices (xlsx)",
    entrada: "VIA_B",
  }),
]);

const POR_CODIGO: ReadonlyMap<string, SerieCatalogo> = new Map(CATALOGO.map((s) => [s.codigo, s]));

/** La serie del catálogo con ese código exacto, o undefined. */
export function serieDelCatalogo(codigo: string): SerieCatalogo | undefined {
  return POR_CODIGO.get(codigo);
}
