import type { TipoDividendo } from "@prisma/client";
import type { EstadoCruce, MotivoRevisar } from "@/datos-oficiales/decretos/cruce";

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

/** Lo único que va al navegador: lo que dibuja la gráfica (revisión react-reviewer, MEDIO: el payload). */
export type SerieGrafica = Pick<SerieConDatos, "codigo" | "nombre" | "unidad" | "escala" | "vigencia" | "ventana" | "historia">;

export interface SerieSinDatos extends SerieBase {
  readonly estado: "SIN_DATOS";
}

/** La lectura de esta serie falló (un valor que la base no debería tener): las demás se muestran. */
export interface SerieConError extends SerieBase {
  readonly estado: "ERROR";
}

export type SerieVista = SerieConDatos | SerieSinDatos | SerieConError;

// ───────────── Los dividendos decretados (frente datos-oficiales-decretos-pantalla, C6b) ─────────────
// Los montos van como texto decimal exacto (del Decimal de C5b); las tenencias, como texto entero con signo (del bigint).
// `clave` es el id de la fila en la base: solo sirve de clave de React, nunca se pinta.

/** Un decreto vigente y no anulado con ex ≥ hoy (C5b, proximos.ts). */
export interface ProximoVista {
  readonly clave: string;
  readonly especie: string;
  readonly tipo: TipoDividendo;
  readonly cuota: number;
  readonly valorPorAccion: string;
  readonly fechaEx: DiaIso;
  readonly fechaPago: DiaIso;
  /** Tal como la registró el dueño: https de la SFC o de la BVC, o sfc:<radicado> (la pantalla decide si es enlace). */
  readonly referencia: string;
  readonly version: number;
  /** La de hoy (o la del cierre de ayer si la ex es hoy); puede ser negativa si faltan órdenes cargadas. */
  readonly tenencia: string;
  /** valor × tenencia, ESTIMADO; null con la tenencia negativa (no se estima). */
  readonly brutoEstimado: string | null;
}

/** Un decreto de un grupo del cruce (C5b, cruce.ts), con su referencia y su versión. */
export interface DecretoDelCruceVista {
  readonly clave: string;
  readonly tipo: TipoDividendo;
  readonly cuota: number;
  readonly fechaEx: DiaIso;
  readonly valorPorAccion: string;
  /** Al cierre del día anterior a la ex, por operación; negativa si faltan órdenes cargadas. */
  readonly tenenciaAntesDeLaEx: string;
  /** valor × tenencia antes de la ex, ESTIMADO. */
  readonly bruto: string;
  readonly referencia: string;
  readonly version: number;
}

export interface PagoVista {
  readonly clave: string;
  readonly fechaPago: DiaIso;
  readonly montoNeto: string;
}

/** Una fila del cruce: un grupo (especie y fecha de pago) o, en SIN_DECRETO, un pago suelto. */
export interface FilaCruceVista {
  readonly clave: string;
  readonly estado: EstadoCruce;
  readonly especie: string;
  readonly fechaPago: DiaIso;
  /** Vacío en SIN_DECRETO. */
  readonly decretos: readonly DecretoDelCruceVista[];
  readonly pagos: readonly PagoVista[];
  /** null en SIN_DECRETO. */
  readonly brutoEsperado: string | null;
  /** null sin pagos. */
  readonly netoRecibido: string | null;
  /** «diferencia bruto − neto»; null si falta alguno de los dos. */
  readonly diferenciaBrutoNeto: string | null;
  /** Solo en REVISAR, en el orden de C5b. */
  readonly motivos: readonly MotivoRevisar[];
}

export interface DecretosVista {
  /** Desde qué fecha de pago se muestra el cruce (hoy − 365). */
  readonly desde: DiaIso;
  /** Por fecha ex, como los da C5b. */
  readonly proximos: readonly ProximoVista[];
  /** Lo más reciente primero. */
  readonly cruce: readonly FilaCruceVista[];
  /** Decretos con ex pasada que no esperaban pago (sin acciones antes de la ex, sin pagos y con las cargas hasta la ex). */
  readonly sinTenencia: number;
}

export interface VistaDatosOficiales {
  /** El día de la consulta en Colombia. */
  readonly hoy: DiaIso;
  /** En el orden del catálogo. */
  readonly series: readonly SerieVista[];
  /** La sección de los dividendos decretados (C6b). */
  readonly decretos: DecretosVista;
}
