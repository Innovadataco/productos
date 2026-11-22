/**
 * Cifras oficiales para la lectura (fase C, C5a). ESQUEMA DEL ROJO: solo tipos y firmas; la implementación llega en el
 * commit verde.
 */
import { esFechaDeNegocio } from "../../plan/fechas";

export type OrigenCifra = "OFICIAL" | "CALCULADA";

export interface CifraOficial {
  readonly serie: string;
  readonly valor: string;
  readonly unidad: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly fuente: string;
  readonly traidoEn: Date;
  readonly origen: OrigenCifra;
}

export type CodigoErrorSeries =
  | "SERIE_DESCONOCIDA" | "FECHA_INVALIDA" | "RANGO_INVALIDO" | "RANGO_DEMASIADO_LARGO" | "DEMASIADAS_FILAS" | "VALOR_INVALIDO"
  | "NO_ES_OFICIAL" | "SERIES_DISTINTAS" | "NO_ES_INDICE" | "BASE_NO_ANTERIOR" | "OTRA_SERIE" | "VIGENCIA_FUTURA";

export class ErrorLecturaSeries extends Error {
  readonly codigo: CodigoErrorSeries;
  constructor(codigo: CodigoErrorSeries) {
    super(codigo);
    this.name = "ErrorLecturaSeries";
    this.codigo = codigo;
  }
}

export const SERIES_INDICE: readonly string[] = Object.freeze(["IPC_INDICE"]);
export const UNIDAD_VARIACION = "% de variación (calculada por 008)";
export const DECIMALES_VARIACION = 2;

export function esValorOficial(texto: string): boolean {
  void texto;
  void esFechaDeNegocio;
  throw new Error("NO_IMPLEMENTADO");
}

export function variacionIndice(base: CifraOficial, final: CifraOficial): CifraOficial {
  void base;
  void final;
  throw new Error("NO_IMPLEMENTADO");
}
