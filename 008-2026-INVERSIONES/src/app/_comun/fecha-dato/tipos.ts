import type { TipoDato } from "@/precios/fuentes";

/**
 * De dónde y de cuándo es un dato (frentes fecha-hora-datos y fuente-retraso), ya serializado para la pantalla: solo texto, así cruza del
 * servidor a un componente de cliente sin cambiar. La hora de Colombia la pone el servidor (hora.ts).
 */

/** Día «AAAA-MM-DD» (una columna DATE: el día del dato). */
export type DiaIso = string;
/** Instante en hora de Colombia (America/Bogota), «AAAA-MM-DD HH:MM». */
export type InstanteColombia = string;

export interface Procedencia {
  /** El día del dato: el del cierre, el del valor de unidad o el del corte. */
  readonly dia: DiaIso;
  /** Cuándo lo trajo 008 (el `traidoEn` de la fila), en hora de Colombia; null si la lectura no lo trae. */
  readonly traidoEn: InstanteColombia | null;
  /** La fuente como la guarda la base (yahoo, sfc:…, banrep:…, dane:…); null si la lectura no la trae. */
  readonly fuente: string | null;
  /** Cierre del día (por omisión) o precio tomado durante la rueda. */
  readonly tipo?: TipoDato;
  /** Solo en un precio de la rueda: la hora del precio, «HH:MM», en hora de Colombia. */
  readonly horaDato?: string | null;
  /**
   * Días hábiles de la BVC que lleva el cierre sin renovarse (src/precios/atraso.ts); lo calcula el servidor, que tiene
   * el calendario. Más de uno se avisa; ausente o null: no se sabe o no aplica.
   */
  readonly habilesAtras?: number | null;
  /** Años del tramo que el calendario no cubre: con ellos, `habilesAtras` es aproximado (una cota superior). Ausente: exacto. */
  readonly aniosSinFestivos?: readonly number[];
}

/** Un valor que suma varios datos (el valor del portafolio, un total): se muestra por su dato MÁS VIEJO. */
export interface ProcedenciaCompuesta {
  /** El dato de la fecha más vieja; con dos del mismo día, el traído antes (sin hora, ese). */
  readonly masVieja: Procedencia;
  /** El día del dato más reciente. */
  readonly masReciente: DiaIso;
  /** Hay datos de fechas distintas: se avisa. */
  readonly mezcladas: boolean;
  /** Las fuentes de los datos, sin repetir, en el orden de su código; sin fuente, al final. */
  readonly fuentes: readonly (string | null)[];
}
