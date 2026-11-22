/**
 * Frescura de una serie oficial (fase C, C5a). ESQUEMA DEL ROJO: solo tipos y firmas; la implementación llega en el
 * commit verde.
 */
import { CATALOGO, type SerieCatalogo } from "../catalogo";
import type { CifraOficial } from "./consulta";

export type EstadoFrescura = "AL_DIA" | "ATRASADA" | "SIN_DATOS";

export interface Frescura {
  readonly estado: EstadoFrescura;
  readonly dias: number | null;
  readonly umbralDias: number;
  readonly cubreHoy: boolean;
}

export function frescura(codigo: string, ultimo: CifraOficial | null, hoy: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Frescura {
  void codigo;
  void ultimo;
  void hoy;
  void catalogo;
  throw new Error("NO_IMPLEMENTADO");
}
