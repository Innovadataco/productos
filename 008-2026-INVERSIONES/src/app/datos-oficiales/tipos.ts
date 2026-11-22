/**
 * La vista de /datos-oficiales (frente datos-oficiales-pantalla, C6a), ya serializada para la pantalla: solo textos y
 * números (ni Date ni Decimal), así cruza al componente de cliente de la gráfica sin cambiar. Los valores van como texto
 * decimal canónico (el de la base); el formato lo pone el componente.
 * Regla «nunca un dato viejo como si fuera de hoy»: el tipo la impone. Una serie sin datos o con error no tiene campo
 * de valor; «vale hoy» (valeHoy) sale solo de cubreHoy de la lectura (src/datos-oficiales/series/frescura.ts).
 */

/** Día «AAAA-MM-DD». */
export type DiaIso = string;
export type FormaVigencia = "DIA" | "TRAMO" | "MES";
/** Cuánto mira atrás la gráfica: un año en las diarias, cinco en el IPC (mensual). */
export type Ventana = "ANIO" | "CINCO_ANIOS";

/** Una vigencia publicada: del `desde` al `hasta` (los dos incluidos) vale `valor`. */
export interface PuntoVista {
  readonly desde: DiaIso;
  readonly hasta: DiaIso;
  readonly valor: string;
}

export interface UltimoVista extends PuntoVista {
  /** La fuente con su dataset, como la guarda la base (sfc:…, banrep:… o dane:…). */
  readonly fuente: string;
  /** Cuándo entró a la base, en Colombia: «AAAA-MM-DD HH:MM». */
  readonly traidoEn: string;
}

export interface FrescuraVista {
  readonly estado: "AL_DIA" | "ATRASADA";
  /** Días enteros del `hasta` del último a hoy (0 si su vigencia todavía corre). */
  readonly dias: number;
  readonly umbralDias: number;
  /** El último vale hoy (cubreHoy de la lectura): solo entonces la pantalla dice «hoy». */
  readonly valeHoy: boolean;
}

/** La variación en 12 meses de una serie índice (el IPC), CALCULADA por 008; nunca atribuida a la fuente. */
export type VariacionVista =
  | {
    readonly estado: "CALCULADA";
    /** Con «-» si es negativa y 2 decimales. */
    readonly valor: string;
    /** «% de variación (calculada por 008)» (UNIDAD_VARIACION). */
    readonly unidad: string;
    /** El primer día del mes base (el mismo mes del año anterior) y del mes final. */
    readonly mesBase: DiaIso;
    readonly mesFinal: DiaIso;
  }
  /** No hay índice del mismo mes del año anterior: no se calcula contra otro mes. */
  | { readonly estado: "SIN_BASE"; readonly mesBase: DiaIso }
  /** Los índices guardados no permiten calcularla (se registró el código). */
  | { readonly estado: "NO_SE_PUDO" };

/** Lo que dice el catálogo de cada serie (src/datos-oficiales/catalogo.ts). */
export interface SerieBase {
  readonly codigo: string;
  readonly nombre: string;
  readonly unidad: string;
  /** De dónde sale, en palabras (el texto del enlace). */
  readonly origen: string;
  /** La fuente del catálogo. */
  readonly fuente: string;
  /** Decimales que publica la fuente: la cifra se completa a esta escala (nunca se trunca). */
  readonly escala: number;
  readonly vigencia: FormaVigencia;
  readonly entrada: "VIA_B";
  readonly umbralDias: number;
  readonly ventana: Ventana;
}

export interface SerieConDatos extends SerieBase {
  readonly estado: "CON_DATOS";
  readonly ultimo: UltimoVista;
  readonly frescura: FrescuraVista;
  /** Las vigentes de la ventana, en orden y sin lo que empieza después de hoy. */
  readonly historia: readonly PuntoVista[];
  /** Solo en una serie índice; null en las demás. */
  readonly variacion: VariacionVista | null;
}

export interface SerieSinDatos extends SerieBase {
  readonly estado: "SIN_DATOS";
}

/** La lectura de esta serie falló (un valor que la base no debería tener): las demás se muestran. */
export interface SerieConError extends SerieBase {
  readonly estado: "ERROR";
}

export type SerieVista = SerieConDatos | SerieSinDatos | SerieConError;

export interface VistaDatosOficiales {
  /** El día de la consulta en Colombia. */
  readonly hoy: DiaIso;
  /** En el orden del catálogo. */
  readonly series: readonly SerieVista[];
}
