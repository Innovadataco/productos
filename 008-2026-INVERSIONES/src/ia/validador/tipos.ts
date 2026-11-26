/**
 * Tipos del resultado del validador. El resumen publicado lleva solo texto armado por el código: las frases del modelo
 * con cada `{Hnn}` reemplazado por la presentación del paquete construido, el aviso fijo y las cifras usadas con su
 * fuente, fecha y calidad. Un rechazo lleva solo códigos y, para calibrar, el id del control o del patrón y el número de
 * la frase: nunca texto del modelo ni datos del paquete.
 */
import type { Calidad, DiaIso, IdHecho, TipoResumen } from "../contrato";
import type { CodigoValidador, VersionValidador } from "./codigos";

export interface FraseResumen {
  /** La frase renderizada: la cifra la pone el código. */
  readonly texto: string;
  /** Los hechos citados en la frase, sin repetir, en el orden de su primera cita. */
  readonly citados: readonly IdHecho[];
}

/** Un hecho citado que no es un nombre: lo que muestra «Cifras usadas». */
export interface CifraUsada {
  readonly id: IdHecho;
  readonly etiqueta: string;
  readonly presentacion: string;
  readonly fuente: string;
  readonly fecha: DiaIso;
  /** La fecha en es-CO (`fecha()` de la pantalla). */
  readonly fechaPresentada: string;
  readonly calidad: Calidad;
  /** «fuente · fecha», armado por el código. */
  readonly fuenteFecha: string;
}

export interface ResumenValidado<T extends TipoResumen = TipoResumen> {
  readonly tipo: T;
  readonly frases: readonly FraseResumen[];
  /** Los ítems de «Para revisar» (solo SIMULACION; vacío en los tres de hoy). El encabezado y la numeración los pone el código. */
  readonly revisar: readonly FraseResumen[];
  /** Las frases unidas por un espacio. */
  readonly texto: string;
  /** Todos los hechos citados, sin repetir, en orden de aparición. */
  readonly citados: readonly IdHecho[];
  /** El aviso fijo del tipo: lo pone el código, va aparte del texto. */
  readonly aviso: string;
  readonly cifrasUsadas: readonly CifraUsada[];
  /** Las «fuente · fecha» distintas de las cifras usadas, en orden. */
  readonly fuentes: readonly string[];
  readonly hechosHash: string;
  readonly validadorVersion: VersionValidador;
}

export interface Hallazgo {
  readonly codigo: CodigoValidador;
  /** Índice de la frase (desde 0), o null si es de la salida entera. */
  readonly frase: number | null;
  /** Id del control o del patrón («RECOMENDACION.COMPRE»): sin dígitos ni texto del modelo. */
  readonly patron: string;
}

export type ResultadoValidacion<T extends TipoResumen = TipoResumen> =
  | { readonly ok: true; readonly resumen: ResumenValidado<T> }
  | { readonly ok: false; readonly motivos: readonly [CodigoValidador, ...CodigoValidador[]]; readonly hallazgos: readonly Hallazgo[] };
