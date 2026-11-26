/**
 * Textos y formatos de /datos-oficiales (frente datos-oficiales-pantalla, C6a). Puro y determinista (sin Intl, toLocale*
 * ni la hora del navegador): lo usan la pantalla del servidor y la gráfica del cliente, y los dos pintan lo mismo.
 * - La cifra sale del TEXTO decimal de la base: miles con punto, decimales con coma, completada a la escala del
 *   catálogo y nunca truncada ni redondeada (la escala está POR VERIFICAR en el catálogo).
 * - «Vale hoy» solo con valeHoy (cubreHoy de la lectura): un dato viejo nunca se presenta como el de hoy.
 * - Nada aquí recomienda comprar ni vender, ni muestra comandos: la pantalla la ve la familia
 *   (tests/unit/pantalla-datos-oficiales/textos.test.ts).
 * Lo de la gráfica (formatos de los ejes, el detalle de un punto y el resumen) también vive aquí, para probarlo sin DOM.
 */
import { etiquetaTick, fecha, numero } from "@/app/tablero/formato";
import type { DiaIso, FormaVigencia, FrescuraVista, SerieBase, SerieConDatos, SerieGrafica, SerieVista, VariacionVista, Ventana } from "./tipos";

export const SIN_DATO = "—";
export const PIE_DATOS_OFICIALES = "Inversiones informa; no recomienda comprar ni vender.";

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;
const MILES = /\B(?=(\d{3})+(?!\d))/g;
const MENOS = "−";
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/;

/** El texto decimal con miles en punto y decimales en coma, completado a `escala` (nunca truncado): 4.5, 2 → «4,50». */
export function cifra(valor: string, escala: number): string {
  const m = DECIMAL.exec(valor);
  if (!m) return SIN_DATO;
  const [, signo = "", entero = "", fraccion = ""] = m;
  const decimales = fraccion.padEnd(escala, "0");
  return `${signo ? MENOS : ""}${entero.replace(MILES, ".")}${decimales ? `,${decimales}` : ""}`;
}

/** La variación con su signo: «+2,71», «−0,41»; el cero, sin signo. */
export function conSigno(valor: string): string {
  const texto = cifra(valor, 2);
  return texto === SIN_DATO || texto.startsWith(MENOS) || /^[0,.]+$/.test(texto) ? texto : `+${texto}`;
}

/** El mes de un día: «2021-02-01» → «feb-2021». */
export const mes = (dia: DiaIso): string => fecha(`${dia.slice(0, 7)}-01`).replace(/^1-/, "");

/** La vigencia en palabras: el mes, «el 16-mar-2021» o «del 13-mar-2021 al 15-mar-2021». */
export function rangoVigencia(forma: FormaVigencia, desde: DiaIso, hasta: DiaIso): string {
  if (forma === "MES") return mes(desde);
  return desde === hasta ? `el ${fecha(desde)}` : `del ${fecha(desde)} al ${fecha(hasta)}`;
}

/** De cuándo es la cifra. «Vale hoy» solo si su vigencia cubre hoy; si no, lo dice. */
export function lineaVigencia(s: SerieConDatos): string {
  const rango = rangoVigencia(s.vigencia, s.ultimo.desde, s.ultimo.hasta);
  if (s.frescura.valeHoy) return `Vale hoy · vigente ${rango}`;
  return s.vigencia === "MES" ? `No es la cifra de hoy · corresponde a ${rango}` : `No es la cifra de hoy · vigente ${rango}`;
}

export type EstadoTarjeta = "AL_DIA" | "ATRASADA" | "SIN_DATOS" | "ERROR";

export const TEXTO_ESTADO: Readonly<Record<EstadoTarjeta, string>> = { AL_DIA: "Al día", ATRASADA: "Atrasada", SIN_DATOS: "Sin datos", ERROR: "No se pudo leer" };

export const estadoDe = (s: SerieVista): EstadoTarjeta => (s.estado === "CON_DATOS" ? s.frescura.estado : s.estado);

const plural = (k: number, uno: string, varios: string): string => `${k} ${k === 1 ? uno : varios}`;

/** Si la vigencia todavía corre, o hace cuánto terminó y desde cuándo se marca atrasada. */
export function detalleFrescura(f: FrescuraVista): string {
  if (f.dias === 0) return "Su vigencia todavía corre.";
  return `Terminó hace ${plural(f.dias, "día", "días")}; se marca atrasada desde ${plural(f.umbralDias, "día", "días")}.`;
}

/** «AAAA-MM-DD HH:MM» (ya en Colombia) → «16-mar-2021 a las 18:41 (hora de Colombia)». */
export function traidoEl(hora: string): string {
  const m = HORA.exec(hora);
  return m && DIA_ISO.test(m[1]!) ? `${fecha(m[1]!)} a las ${m[2]!} (hora de Colombia)` : SIN_DATO;
}

export const TEXTO_ENTRADA: Readonly<Record<SerieBase["entrada"], string>> = { VIA_B: "A mano: la carga el dueño (vía B)" };

const SIGLAS: Readonly<Record<string, string>> = { TRM: "TRM", TPM: "TPM", IBR_3M_EA: "IBR 3M", IPC_INDICE: "IPC" };
/** La sigla de una serie del catálogo; otra sale con su código. */
export const sigla = (codigo: string): string => SIGLAS[codigo] ?? codigo;

/** Por qué no se muestra la variación (va después de «Variación en 12 meses:»). */
export function textoVariacionFaltante(v: Exclude<VariacionVista, { readonly estado: "CALCULADA" }>): string {
  return v.estado === "SIN_BASE"
    ? `falta el índice de ${mes(v.mesBase)} (el mismo mes del año anterior): no se calcula.`
    : "no se pudo calcular con los índices guardados.";
}

// ── La gráfica ──

const TEXTO_VENTANA: Readonly<Record<Ventana, string>> = { ANIO: "último año", CINCO_ANIOS: "últimos cinco años" };
const EN_LA_VENTANA: Readonly<Record<Ventana, string>> = { ANIO: "en el último año", CINCO_ANIOS: "en los últimos cinco años" };
/** Los decimales del eje: hasta 2 (las marcas «bonitas» no piden más), sin ceros a la derecha. */
const DECIMALES_EJE = 2;

const sufijo = (s: SerieGrafica): string => (s.unidad.startsWith("%") ? " %" : "");
const sinCeros = (texto: string): string => (texto.includes(",") ? texto.replace(/0+$/, "").replace(/,$/, "") : texto);

/** Lo que necesita la gráfica (y nada más: es lo que viaja al navegador). */
export const paraGrafica = (s: SerieConDatos): SerieGrafica => ({
  codigo: s.codigo, nombre: s.nombre, unidad: s.unidad, escala: s.escala, vigencia: s.vigencia, ventana: s.ventana, historia: s.historia,
});

export const tituloGrafica = (s: SerieGrafica): string => `${s.nombre}, ${TEXTO_VENTANA[s.ventana]}`;

/** Lo que se dibuja: el valor de cada vigencia como número (solo para trazar; los textos salen del decimal). */
export const valores = (s: SerieGrafica): number[] => s.historia.map((p) => Number(p.valor));

export const formatoY = (s: SerieGrafica) => (v: number): string => `${numero(v, s.escala)}${sufijo(s)}`;
export const formatoEje = (s: SerieGrafica) => (v: number): string => `${sinCeros(numero(v, DECIMALES_EJE))}${sufijo(s)}`;
export const formatoDia = (s: SerieGrafica) => (dia: DiaIso): string => (s.vigencia === "MES" ? mes(dia) : fecha(dia));
export { etiquetaTick as formatoTick };

/** En el detalle de un punto: hasta cuándo vale un tramo de varios días (un día o un mes no lo necesitan). */
export const extraDetalle = (s: SerieGrafica) => (i: number): string | null => {
  const p = s.historia[i];
  if (!p || s.vigencia === "MES" || p.hasta === p.desde) return null;
  return `Vigente hasta el ${fecha(p.hasta)}`;
};

/**
 * El texto alternativo de la gráfica, con las cifras exactas (del decimal, no del número trazado). El mínimo y el máximo
 * se ELIGEN comparando el número trazado: con las escalas del catálogo (hasta 3 decimales y menos de 15 cifras) la
 * comparación es exacta; las cifras que se escriben salen siempre del texto.
 */
export function resumenGrafica(s: SerieGrafica): string {
  const nums = valores(s);
  const indice = (mejor: (a: number, b: number) => boolean) => nums.reduce((k, v, i) => (mejor(v, nums[k]!) ? i : k), 0);
  const [primero, ultimo, min, max] = [s.historia[0]!, s.historia[s.historia.length - 1]!, s.historia[indice((a, b) => a < b)]!, s.historia[indice((a, b) => a > b)]!];
  const dia = formatoDia(s);
  const c = (v: string) => cifra(v, s.escala);
  return `Del ${dia(primero.desde)} al ${dia(ultimo.desde)}, en ${s.unidad}: pasó de ${c(primero.valor)} a ${c(ultimo.valor)}; ` +
    `el mínimo fue ${c(min.valor)} (${dia(min.desde)}) y el máximo ${c(max.valor)} (${dia(max.desde)}).`;
}

/** Sin dos puntos en la ventana no hay línea: la nota que va en su lugar (null si hay gráfica). */
export function notaSinGrafica(s: SerieGrafica): string | null {
  if (s.historia.length >= 2) return null;
  return s.historia.length === 0
    ? `No hay valores ${EN_LA_VENTANA[s.ventana]}: el último cargado es anterior.`
    : `Solo hay un valor ${EN_LA_VENTANA[s.ventana]}: la gráfica aparece con dos o más.`;
}
