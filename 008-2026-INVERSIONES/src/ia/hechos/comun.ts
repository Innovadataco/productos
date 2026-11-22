/**
 * Piezas comunes de los tres armadores (E1b): el borrador de un hecho con sus marcas, la frescura con el calendario
 * que además avisa si el calendario no cubre, y el cierre del paquete (numerar, avisar el recorte y construir).
 */
import type { ClaveDe, ClaveHecho } from "../catalogo";
import type { DiaIso, Direccion, Frescura, PaqueteHechos, TipoResumen } from "../contrato";
import type { CalendarioBvc } from "../../precios/negociacion";
import { construirPaquete } from "../paquete";
import { ordenarAvisos, VERSION_ARMADORES, type CodigoAvisoArmado } from "./constantes";
import { calidadDe, frescuraPorCalendario, type OrigenDato } from "./derivar";
import { ErrorArmado } from "./errores";
import { numerarGrupos, type BorradorHecho, type Grupo } from "./grupos";

/** Lo que aporta cada parte de un armador: sus grupos y sus avisos. */
export interface Parte<C extends ClaveHecho> {
  readonly grupos: readonly Grupo<C>[];
  readonly avisos: readonly CodigoAvisoArmado[];
}

/** El día del dato, su frescura y de dónde sale (la calidad se deriva de los dos). */
export interface Marcas {
  readonly fecha: DiaIso;
  readonly frescura: Frescura;
  readonly origen: OrigenDato;
}

interface Extra {
  readonly ref?: string;
  readonly sujeto?: string;
  readonly direccion?: Direccion;
  readonly cercania?: "CERCA" | "LEJOS";
  readonly obligatorio?: boolean;
}

/** Un borrador de hecho: sin dirección ni cercanía (NO_APLICA) y no obligatorio, salvo que se diga. */
export function borrador<C extends ClaveHecho>(clave: C, valor: string, fuente: string, marcas: Marcas, extra: Extra = {}): BorradorHecho<C> {
  return {
    ...(extra.ref === undefined ? {} : { ref: extra.ref }),
    clave,
    ...(extra.sujeto === undefined ? {} : { sujeto: extra.sujeto }),
    valor,
    fuente,
    fecha: marcas.fecha,
    calidad: calidadDe(marcas.origen, marcas.frescura),
    direccion: extra.direccion ?? "NO_APLICA",
    cercania: extra.cercania ?? "NO_APLICA",
    frescura: marcas.frescura,
    obligatorio: extra.obligatorio ?? false,
  };
}

export interface FrescuraConAviso {
  readonly frescura: Frescura;
  readonly avisos: readonly CodigoAvisoArmado[];
}

/** La frescura con el calendario BVC y, si el calendario no cubría, el aviso CALENDARIO_NO_CUBRE. */
export function frescuraConAviso(fecha: DiaIso, hoy: DiaIso, calendario: CalendarioBvc): FrescuraConAviso {
  const { frescura, calendarioCubre } = frescuraPorCalendario(fecha, hoy, calendario);
  return { frescura, avisos: calendarioCubre ? [] : ["CALENDARIO_NO_CUBRE"] };
}

/** Un día que no puede ser posterior a hoy (FECHA_FUTURA si lo es). */
export function hastaHoy(dia: DiaIso, hoy: DiaIso): DiaIso {
  if (dia > hoy) throw new ErrorArmado("FECHA_FUTURA");
  return dia;
}

/** Numera los grupos de las partes, avisa si se recortó y construye el paquete con `construirPaquete`. */
export function cerrarPaquete<T extends TipoResumen>(
  tipo: T, hoy: DiaIso, partes: readonly Parte<ClaveDe<T>>[], versionesCalculo: Readonly<Record<string, string>> = {}, avisosPrevios: readonly string[] = [],
): PaqueteHechos<T> {
  const { hechos, recortados } = numerarGrupos(tipo, partes.flatMap((p) => p.grupos));
  const propios = ordenarAvisos([...partes.flatMap((p) => p.avisos), ...(recortados > 0 ? (["HECHOS_RECORTADOS"] as const) : [])]);
  const avisos = [...avisosPrevios, ...propios.filter((a) => !avisosPrevios.includes(a))];
  return construirPaquete({ tipo, hoy, versionesCalculo: { hechos: VERSION_ARMADORES, ...versionesCalculo }, avisos, hechos });
}
