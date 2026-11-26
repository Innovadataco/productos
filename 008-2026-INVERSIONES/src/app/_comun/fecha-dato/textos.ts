/**
 * Los textos de la procedencia de cada dato (frentes fecha-hora-datos y fuente-retraso). La línea, corta para 375 px:
 * «Cierre 25-nov · traído 18:00 · Yahoo (BVC)» (o «Precio de las 11:42 · …» en la rueda). El detalle, aparte: la fuente,
 * su retraso conocido y cuándo se trajo en hora de Colombia; la tabla de fuentes vive en src/precios/fuentes.ts. El
 * aviso de dato viejo («dato de hace 3 días hábiles») y el de fechas distintas salen de sus propias funciones.
 * Se arman por piezas: las que son fechas u horas llevan el atributo de <time>, y el texto plano sale de las MISMAS
 * piezas. Puro y determinista (sin Intl ni Date): lo pintan el servidor y el navegador. Sin comandos y sin recomendar
 * comprar ni vender (tests/unit/fecha-dato/textos.test.ts).
 */
import { fecha } from "@/app/tablero/formato";
import { MINIMO_AVISO } from "@/precios/atraso";
import { fuenteDe, nombreDeFuente, retrasoDe, SIN_FUENTE } from "@/precios/fuentes";
import { porCodigo } from "./componer";
import { dateTimeColombia } from "./hora";
import type { DiaIso, InstanteColombia, Procedencia, ProcedenciaCompuesta } from "./tipos";

/** Un trozo del texto; con `dateTime`, se pinta como <time>. */
export interface Pieza {
  readonly texto: string;
  readonly dateTime?: string;
}

export { SIN_FUENTE };
export const SIN_HORA = "sin la hora en que se trajo";
export const SIN_RETRASO = "sin dato de esta fuente";

const DIA_ISO = /^\d{4}-(\d{2})-(\d{2})$/;
const INSTANTE = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/;
const HORA_DEL_DATO = /^(\d{2}):(\d{2})$/;
const ANIO_FINAL = /-\d{4}$/;
const DIA_MAX = 31;
const HORA_MAX = 23;
const MINUTO_MAX = 59;

/** El nombre de la fuente (tabla de src/precios/fuentes.ts); una que no conoce, tal cual (no se inventa un nombre). */
export const nombreFuente = nombreDeFuente;

/** «A», «A y B», «A, B y C»: los nombres sin repetir, en el orden del código de su fuente. */
export function nombresDeFuentes(codigos: readonly (string | null)[]): string {
  const nombres = [...new Set([...codigos].sort(porCodigo).map(nombreFuente))];
  if (nombres.length === 0) return SIN_FUENTE;
  return nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)!}`;
}

const diaValido = (dia: DiaIso): boolean => {
  const m = DIA_ISO.exec(dia);
  return m !== null && fecha(dia) !== "fecha no válida" && Number(m[2]) >= 1 && Number(m[2]) <= DIA_MAX;
};

/** El día como se dice: «22-nov», o «22-nov-2024» cuando `conAnio`. */
const diaTexto = (dia: DiaIso, conAnio: boolean): string => (conAnio ? fecha(dia) : fecha(dia).replace(ANIO_FINAL, ""));

/** El día, como pieza con su <time> si es un día válido. */
const piezaDia = (dia: DiaIso, conAnio: boolean): Pieza => (diaValido(dia) ? { texto: diaTexto(dia, conAnio), dateTime: dia } : { texto: diaTexto(dia, conAnio) });

/** El año del dato se dice solo si cambia respecto del año en que se trajo (o si no se sabe cuándo se trajo). */
function conAnioDe(dia: DiaIso, traidoEn: InstanteColombia | null): boolean {
  const h = leerInstante(traidoEn);
  return h === null || h.dia.slice(0, 4) !== dia.slice(0, 4);
}

interface HoraLeida { readonly dia: DiaIso; readonly hhmm: string; readonly dateTime: string }

/** La hora de Colombia leída (día válido, de 00:00 a 23:59); null si no se puede leer. */
function leerInstante(t: InstanteColombia | null): HoraLeida | null {
  const m = t === null ? null : INSTANTE.exec(t);
  const dateTime = t === null ? null : dateTimeColombia(t);
  if (!m || dateTime === null || Number(m[2]) > HORA_MAX || Number(m[3]) > MINUTO_MAX || !diaValido(m[1]!)) return null;
  return { dia: m[1]!, hhmm: `${m[2]}:${m[3]}`, dateTime };
}

/** «traído 18:00» el mismo día del dato; «traído 26-nov 09:10» otro día. Nunca se inventa una hora. */
function piezasTraido(t: InstanteColombia | null, diaDato: DiaIso): Pieza[] {
  const h = leerInstante(t);
  if (h === null) return [{ texto: SIN_HORA }];
  const conAnio = conAnioDe(diaDato, t);
  const cuando = h.dia === diaDato ? h.hhmm : `${diaTexto(h.dia, conAnio)} ${h.hhmm}`;
  return [{ texto: "traído " }, { texto: cuando, dateTime: h.dateTime }];
}

export interface OpcionesProcedencia {
  /** Qué es el dato: «Cierre», «Valor de unidad»… Antes de la fecha. Por defecto, «Dato» (en la rueda, «Precio»). */
  readonly etiqueta?: string;
  /** Sin la fecha del dato, cuando la celda ya la dice. */
  readonly sinFecha?: boolean;
}

const SEPARADOR: Pieza = { texto: " · " };

/** El encabezado de la línea: «Cierre 17-mar» o, en la rueda, «Precio del 17-mar a las 11:42». */
function piezasDelDato(p: Procedencia, o: OpcionesProcedencia): Pieza[] {
  const conAnio = conAnioDe(p.dia, p.traidoEn);
  const hora = p.horaDato != null && HORA_DEL_DATO.test(p.horaDato) && Number(p.horaDato.slice(0, 2)) <= HORA_MAX && Number(p.horaDato.slice(3)) <= MINUTO_MAX ? p.horaDato : null;
  if ((p.tipo ?? "CIERRE") === "RUEDA") {
    const rotulo = o.etiqueta ?? "Precio";
    const horaPieza: Pieza | null = hora === null ? null : { texto: hora, ...(diaValido(p.dia) ? { dateTime: `${p.dia}T${hora}-05:00` } : {}) };
    if (o.sinFecha) return horaPieza === null ? [{ texto: `${rotulo} en rueda` }] : [{ texto: `${rotulo} de las ` }, horaPieza];
    return horaPieza === null
      ? [{ texto: `${rotulo} en rueda del ` }, piezaDia(p.dia, conAnio)]
      : [{ texto: `${rotulo} del ` }, piezaDia(p.dia, conAnio), { texto: " a las " }, horaPieza];
  }
  if (o.sinFecha) return o.etiqueta === undefined ? [] : [{ texto: o.etiqueta }];
  return [{ texto: `${o.etiqueta ?? "Dato"} ` }, piezaDia(p.dia, conAnio)];
}

export function piezasProcedencia(p: Procedencia, o: OpcionesProcedencia = {}): Pieza[] {
  const dato = piezasDelDato(p, o);
  return [...dato, ...(dato.length === 0 ? [] : [SEPARADOR]), ...piezasTraido(p.traidoEn, p.dia), SEPARADOR, { texto: nombreFuente(p.fuente) }];
}

/** Un valor que suma cierres: el más antiguo que lo compone, si hay fechas distintas; si no, el cierre de ese día. */
export function piezasCompuesta(c: ProcedenciaCompuesta): Pieza[] {
  const { dia, traidoEn } = c.masVieja;
  const inicio = c.mezcladas ? "Cierre más antiguo " : "Cierre ";
  return [{ texto: inicio }, piezaDia(dia, conAnioDe(dia, traidoEn)), SEPARADOR, ...piezasTraido(traidoEn, dia), SEPARADOR, { texto: nombresDeFuentes(c.fuentes) }];
}

/** El aviso de fechas distintas, con las dos puntas; null si todos los datos son del mismo día. */
export function piezasAviso(c: ProcedenciaCompuesta): Pieza[] | null {
  if (!c.mezcladas) return null;
  return [{ texto: "Cierres de fechas distintas: del " }, piezaDia(c.masVieja.dia, true), { texto: " al " }, piezaDia(c.masReciente, true), { texto: "." }];
}

/** «dato de hace 3 días hábiles» si el cierre lleva más de un día hábil sin renovarse; null si no hay que avisar. */
export function avisoAtraso(p: Pick<Procedencia, "habilesAtras">): string | null {
  const n = p.habilesAtras;
  return n == null || n < MINIMO_AVISO ? null : `dato de hace ${n} días hábiles`;
}

const mayuscula = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** El retraso conocido de las fuentes: sin nombre si es una sola; con el nombre de cada una si son varias. */
function textoRetraso(codigos: readonly (string | null)[]): string {
  const por = codigos.map((c) => {
    const partes = [retrasoDe(c, "CIERRE"), retrasoDe(c, "RUEDA")].filter((x): x is string => x !== null);
    return { nombre: nombreFuente(c), texto: partes.length === 0 ? SIN_RETRASO : partes.join("; ") };
  });
  return por.length === 1 ? por[0]!.texto : por.map((r) => `${r.nombre}: ${r.texto}`).join(" · ");
}

/** El detalle: la fuente, su retraso conocido, cuándo se trajo (hora de Colombia) y la nota de la fuente si la tiene. */
function detalle(codigos: readonly (string | null)[], traidoEn: InstanteColombia | null): string {
  const unicos = [...new Set([...codigos].sort(porCodigo))];
  const h = leerInstante(traidoEn);
  const [primero] = unicos;
  const nota = unicos.length === 1 && primero !== undefined ? (fuenteDe(primero)?.nota ?? null) : null;
  return [
    `${unicos.length > 1 ? "Fuentes" : "Fuente"}: ${nombresDeFuentes(unicos)}.`,
    `Retraso conocido: ${textoRetraso(unicos)}.`,
    h === null ? `${mayuscula(SIN_HORA)}.` : `Traído el ${diaTexto(h.dia, true)} a las ${h.hhmm} (hora de Colombia).`,
    ...(nota === null ? [] : [nota]),
  ].join(" ");
}

export const detalleProcedencia = (p: Procedencia): string => detalle([p.fuente], p.traidoEn);
export const detalleCompuesta = (c: ProcedenciaCompuesta): string => detalle(c.fuentes, c.masVieja.traidoEn);

const unir = (piezas: readonly Pieza[]): string => piezas.map((p) => p.texto).join("");

export const textoProcedencia = (p: Procedencia, o: OpcionesProcedencia = {}): string => unir(piezasProcedencia(p, o));
export const textoCompuesta = (c: ProcedenciaCompuesta): string => unir(piezasCompuesta(c));
export function avisoMezcladas(c: ProcedenciaCompuesta): string | null {
  const piezas = piezasAviso(c);
  return piezas === null ? null : unir(piezas);
}
