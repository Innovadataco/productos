/**
 * Los textos de la procedencia de cada dato (frente fecha-hora-datos), en el estilo de /datos-oficiales:
 * «Cierre del 22-nov-2024 · traído el 22-nov-2024 a las 18:04 (hora de Colombia) · BVC por Yahoo».
 * Se arman por piezas: las que son fechas llevan el atributo de <time>, y el texto plano (las barras de las gráficas)
 * sale de las MISMAS piezas, así los dos dicen lo mismo. Puro y determinista (sin Intl ni Date): lo pintan el servidor
 * y el navegador. Sin comandos y sin recomendar comprar ni vender (tests/unit/fecha-dato/textos.test.ts).
 */
import { fecha } from "@/app/tablero/formato";
import { porCodigo } from "./componer";
import { dateTimeColombia } from "./hora";
import type { DiaIso, InstanteColombia, Procedencia, ProcedenciaCompuesta } from "./tipos";

/** Un trozo del texto; con `dateTime`, se pinta como <time>. */
export interface Pieza {
  readonly texto: string;
  readonly dateTime?: string;
}

export const SIN_FUENTE = "fuente sin dato";
export const SIN_HORA = "sin la hora en que se trajo";

const YAHOO = "yahoo";
const POR_PREFIJO: readonly (readonly [string, string])[] = [["sfc:", "SFC"], ["banrep:", "BanRep"], ["dane:", "DANE"]];
const DIA_ISO = /^\d{4}-(\d{2})-(\d{2})$/;
const INSTANTE = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/;
const DIA_MAX = 31;
const HORA_MAX = 23;
const MINUTO_MAX = 59;

/** El nombre de la fuente: BVC por Yahoo, SFC, BanRep o DANE; una que no conoce, tal cual (no se inventa un nombre). */
export function nombreFuente(codigo: string | null): string {
  if (codigo === null || codigo === "") return SIN_FUENTE;
  if (codigo === YAHOO) return "BVC por Yahoo";
  return POR_PREFIJO.find(([prefijo]) => codigo.startsWith(prefijo))?.[1] ?? codigo;
}

/** «A», «A y B», «A, B y C»: los nombres sin repetir, en el orden del código de su fuente. */
export function nombresDeFuentes(codigos: readonly (string | null)[]): string {
  const nombres = [...new Set([...codigos].sort(porCodigo).map(nombreFuente))];
  if (nombres.length === 0) return SIN_FUENTE;
  return nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)!}`;
}

/** El día, como pieza con su <time> si es un día válido. */
function piezaDia(dia: DiaIso): Pieza {
  const texto = fecha(dia);
  const m = DIA_ISO.exec(dia);
  const valido = m !== null && texto !== "fecha no válida" && Number(m[2]) >= 1 && Number(m[2]) <= DIA_MAX;
  return valido ? { texto, dateTime: dia } : { texto };
}

/** La hora de Colombia como pieza con su <time> (día válido, de 00:00 a 23:59); null si no se puede leer. */
function piezaHora(t: InstanteColombia | null): Pieza | null {
  const m = t === null ? null : INSTANTE.exec(t);
  const dateTime = t === null ? null : dateTimeColombia(t);
  if (!m || dateTime === null || Number(m[2]) > HORA_MAX || Number(m[3]) > MINUTO_MAX) return null;
  const dia = piezaDia(m[1]!);
  return dia.dateTime === undefined ? null : { texto: `${dia.texto} a las ${m[2]}:${m[3]}`, dateTime };
}

/** «traído el 17-mar-2027 a las 18:04 (hora de Colombia)», o que no se sabe (nunca se inventa una hora). */
function piezasTraido(t: InstanteColombia | null): Pieza[] {
  const hora = piezaHora(t);
  return hora === null ? [{ texto: SIN_HORA }] : [{ texto: "traído el " }, hora, { texto: " (hora de Colombia)" }];
}

export interface OpcionesProcedencia {
  /** Qué es el dato: «Cierre», «Valor de unidad»… Va antes de «del <fecha>». Por defecto, «Dato». */
  readonly etiqueta?: string;
  /** Sin la fecha del dato, cuando la celda ya la dice. */
  readonly sinFecha?: boolean;
}

const SEPARADOR: Pieza = { texto: " · " };

export function piezasProcedencia(p: Procedencia, o: OpcionesProcedencia = {}): Pieza[] {
  const fechaDato = o.sinFecha ? [] : [{ texto: `${o.etiqueta ?? "Dato"} del ` }, piezaDia(p.dia), SEPARADOR];
  return [...fechaDato, ...piezasTraido(p.traidoEn), SEPARADOR, { texto: nombreFuente(p.fuente) }];
}

/** Un valor que suma cierres: el más antiguo que lo compone, si hay fechas distintas; si no, el cierre de ese día. */
export function piezasCompuesta(c: ProcedenciaCompuesta): Pieza[] {
  const inicio = c.mezcladas ? "Con el cierre más antiguo del " : "Cierre del ";
  return [{ texto: inicio }, piezaDia(c.masVieja.dia), SEPARADOR, ...piezasTraido(c.masVieja.traidoEn), SEPARADOR, { texto: nombresDeFuentes(c.fuentes) }];
}

/** El aviso de fechas distintas, con las dos puntas; null si todos los datos son del mismo día. */
export function piezasAviso(c: ProcedenciaCompuesta): Pieza[] | null {
  if (!c.mezcladas) return null;
  return [{ texto: "Cierres de fechas distintas: del " }, piezaDia(c.masVieja.dia), { texto: " al " }, piezaDia(c.masReciente), { texto: "." }];
}

const unir = (piezas: readonly Pieza[]): string => piezas.map((p) => p.texto).join("");

export const textoProcedencia = (p: Procedencia, o: OpcionesProcedencia = {}): string => unir(piezasProcedencia(p, o));
export const textoCompuesta = (c: ProcedenciaCompuesta): string => unir(piezasCompuesta(c));
export function avisoMezcladas(c: ProcedenciaCompuesta): string | null {
  const piezas = piezasAviso(c);
  return piezas === null ? null : unir(piezas);
}
