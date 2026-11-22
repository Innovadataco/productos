/**
 * Piezas comunes de los tres armadores (E1b): las marcas de un hecho (día, frescura y origen; la calidad se deriva de
 * los dos últimos), el borrador de un hecho y el cierre del paquete (numerar, avisar el recorte y construir).
 *
 * Las marcas solo salen de sus constructores (el tipo lleva una marca que nadie más puede poner), y ninguno deja que la
 * fecha y la frescura se contradigan: HOY solo con la fecha de hoy; un dato de mercado, con la frescura del calendario
 * BVC; lo atrasado a sabiendas, ATRASADO; nunca una fecha posterior a hoy.
 */
import type { ClaveDe, ClaveHecho } from "../catalogo";
import type { Cercania, DiaIso, Direccion, Frescura, PaqueteHechos, TipoResumen } from "../contrato";
import type { CalendarioBvc } from "../../precios/negociacion";
import { construirPaquete } from "../paquete";
import { ordenarAvisos, VERSION_ARMADORES, type CodigoAvisoArmado } from "./constantes";
import { calidadDe, frescuraPorCalendario, peorFrescura, type OrigenDato } from "./derivar";
import { ErrorArmado } from "./errores";
import { numerarGrupos, type BorradorHecho, type Grupo, type SujetoDe } from "./grupos";

/** Lo que aporta cada parte de un armador: sus grupos y sus avisos. */
export interface Parte<C extends ClaveHecho> {
  readonly grupos: readonly Grupo<C>[];
  readonly avisos: readonly CodigoAvisoArmado[];
}

declare const MARCA: unique symbol;

/** El día del dato, su frescura y de dónde sale. Solo la arman los constructores de abajo. */
export interface Marcas {
  readonly fecha: DiaIso;
  readonly frescura: Frescura;
  readonly origen: OrigenDato;
  readonly [MARCA]: true;
}

/** Un día que no puede ser posterior a hoy (FECHA_FUTURA si lo es). */
export function hastaHoy(dia: DiaIso, hoy: DiaIso): DiaIso {
  if (dia > hoy) throw new ErrorArmado("FECHA_FUTURA");
  return dia;
}

const marcas = (fecha: DiaIso, frescura: Frescura, origen: OrigenDato): Marcas => ({ fecha, frescura, origen }) as Marcas;

/** Lo vigente hoy (el plan, un decreto, un nombre, una proyección): la fecha es hoy y la frescura HOY. */
export const marcasDeHoy = (hoy: DiaIso, origen: OrigenDato): Marcas => marcas(hoy, "HOY", origen);

/** Lo que quien llama sabe atrasado (un cierre sin negociación al día): ATRASADO, con su fecha. */
export const marcasAtrasadas = (fecha: DiaIso, hoy: DiaIso, origen: OrigenDato): Marcas => marcas(hastaHoy(fecha, hoy), "ATRASADO", origen);

/** Con la frescura que dio su propio módulo (series oficiales, fondo): HOY solo si la fecha es hoy (FRESCURA_INCOHERENTE). */
export function marcasConFrescura(fecha: DiaIso, hoy: DiaIso, frescura: Frescura, origen: OrigenDato): Marcas {
  if (frescura === "HOY" && hastaHoy(fecha, hoy) !== hoy) throw new ErrorArmado("FRESCURA_INCOHERENTE");
  return marcas(hastaHoy(fecha, hoy), frescura, origen);
}

export interface MarcasConAviso {
  readonly marcas: Marcas;
  readonly avisos: readonly CodigoAvisoArmado[];
}

/**
 * Un dato de mercado (cierres, cortes): la frescura del calendario BVC (o ATRASADO si `atrasado`) y, si el calendario
 * no cubría un día que hacía falta mirar, el aviso CALENDARIO_NO_CUBRE.
 */
export function marcasDeMercado(fecha: DiaIso, hoy: DiaIso, calendario: CalendarioBvc, origen: OrigenDato, atrasado = false): MarcasConAviso {
  const { frescura, calendarioCubre } = frescuraPorCalendario(fecha, hoy, calendario);
  return { marcas: marcas(fecha, peorFrescura(frescura, atrasado ? "ATRASADO" : "HOY"), origen), avisos: calendarioCubre ? [] : ["CALENDARIO_NO_CUBRE"] };
}

/** Las mismas marcas con otro origen (el día y la frescura no cambian). */
export const conOrigen = (m: Marcas, origen: OrigenDato): Marcas => marcas(m.fecha, m.frescura, origen);

interface Extra<C extends ClaveHecho> {
  readonly sujeto?: BorradorHecho<SujetoDe<C>>;
  readonly direccion?: Direccion;
  readonly cercania?: Exclude<Cercania, "NO_APLICA">;
  readonly obligatorio?: boolean;
}

/** Un borrador de hecho: sin dirección ni cercanía (NO_APLICA) y no obligatorio, salvo que se diga. */
export function borrador<C extends ClaveHecho>(clave: C, valor: string, fuente: string, m: Marcas, extra: Extra<C> = {}): BorradorHecho<C> {
  return {
    clave,
    ...(extra.sujeto === undefined ? {} : { sujeto: extra.sujeto }),
    valor,
    fuente,
    fecha: m.fecha,
    calidad: calidadDe(m.origen, m.frescura),
    direccion: extra.direccion ?? "NO_APLICA",
    cercania: extra.cercania ?? "NO_APLICA",
    frescura: m.frescura,
    obligatorio: extra.obligatorio ?? false,
  };
}

/**
 * Numera los grupos de las partes, avisa si se recortó y construye el paquete con `construirPaquete`. La versión de los
 * armadores va siempre en `versionesCalculo.hechos`: nadie la pisa.
 */
export function cerrarPaquete<T extends TipoResumen>(
  tipo: T, hoy: DiaIso, partes: readonly Parte<ClaveDe<T>>[], versionesCalculo: Readonly<Record<string, string>> = {}, avisosPrevios: readonly string[] = [],
): PaqueteHechos<T> {
  const { hechos, recortados } = numerarGrupos(tipo, partes.flatMap((p) => p.grupos));
  const propios = ordenarAvisos([...partes.flatMap((p) => p.avisos), ...(recortados > 0 ? (["HECHOS_RECORTADOS"] as const) : [])]);
  const avisos = [...new Set([...avisosPrevios, ...propios])];
  return construirPaquete({ tipo, hoy, versionesCalculo: { ...versionesCalculo, hechos: VERSION_ARMADORES }, avisos, hechos });
}
