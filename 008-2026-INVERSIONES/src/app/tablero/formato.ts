/**
 * Formatos de pantalla (solo presentación: los cálculos ya vienen hechos en Decimal).
 * Deterministas a propósito: sin toLocaleString, Intl ni Date, para que el servidor y el
 * navegador pinten exactamente el mismo texto.
 */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;
const MILES = /\B(?=(\d{3})+(?!\d))/g;
const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MENOS = "−";
const SIN_DATO = "—";
/** Desde aquí `toFixed` escribe en notación exponencial («1e+21»): no hay cifra que pintar. */
const LIMITE_TOFIXED = 1e21;

export const n = (s: string | null | undefined): number => (s == null ? 0 : Number(s));

/** Valor absoluto redondeado, con miles en punto y decimales en coma: 1234567.891 → «1.234.567,89». */
function absoluto(v: number, decimales: number): string {
  const [entero = "0", fraccion] = Math.abs(v).toFixed(decimales).split(".");
  const conMiles = entero.replace(MILES, ".");
  return fraccion ? `${conMiles},${fraccion}` : conMiles;
}

/** El signo se decide después de redondear: lo que redondea a cero no lleva signo. */
function signo(v: number, decimales: number, conMas: boolean): string {
  if (Number(Math.abs(v).toFixed(decimales)) === 0) return "";
  if (v < 0) return MENOS;
  return conMas ? "+" : "";
}

/** Solo se pinta lo que `toFixed` escribe con todos sus dígitos; lo demás queda «—». */
const pintable = (v: number): boolean => Number.isFinite(v) && Math.abs(v) < LIMITE_TOFIXED;

/** Número con miles en punto y `decimales` en coma: numero(1234.5, 1) → «1.234,5». */
export function numero(v: number, decimales = 0): string {
  if (!pintable(v)) return SIN_DATO;
  return `${signo(v, decimales, false)}${absoluto(v, decimales)}`;
}

/** Pesos sin decimales: cop(1234567) → «$ 1.234.567»; cop(-0.4) → «$ 0». */
export function cop(v: number, conSigno = false): string {
  if (!pintable(v)) return SIN_DATO;
  return `${signo(v, 0, conSigno)}$ ${absoluto(v, 0)}`;
}

/** Porcentaje con un decimal y signo: pct(12.34) → «+12,3 %»; pct(-0.04) → «0,0 %». */
export function pct(v: number): string {
  if (!pintable(v)) return SIN_DATO;
  return `${signo(v, 1, true)}${absoluto(v, 1)} %`;
}

/** Día «YYYY-MM-DD» (ya en hora de Colombia) → «20-nov-2026», sin pasar por Date ni zonas horarias. */
export function fecha(dia: string | null): string {
  if (!dia) return "sin dato";
  const partes = DIA_ISO.exec(dia);
  const mes = partes ? MESES[Number(partes[2]) - 1] : undefined;
  if (!partes || !mes) return "fecha no válida";
  return `${Number(partes[3])}-${mes}-${partes[1]}`;
}

/** Hasta `decimales`, sin ceros a la derecha: 1,250 → «1,25»; 12,00 → «12». */
function sinCeros(v: number, decimales: number): string {
  const texto = absoluto(v, decimales);
  return texto.includes(",") ? texto.replace(/,?0+$/, "") : texto;
}

const MIL = 1e3;
const MILLON = 1e6;

/** Pesos para un eje: «$ 947», «$ 4,6 mil», «$ 262,5 mil», «$ 1,25 M»; el signo, como en `cop`. */
export function copCompacto(v: number): string {
  if (!pintable(v)) return SIN_DATO;
  const a = Math.abs(v);
  const cuerpo = a < MIL ? absoluto(a, 0) : a < MILLON ? `${sinCeros(a / MIL, 1)} mil` : `${sinCeros(a / MILLON, 2)} M`;
  const s = cuerpo === "0" ? "" : v < 0 ? MENOS : "";
  return `${s}$ ${cuerpo}`;
}

/** Porcentaje de eje: hasta un decimal y con signo: «+2,5 %», «0 %», «−1 %». */
export function pctEje(v: number): string {
  if (!pintable(v)) return SIN_DATO;
  const cuerpo = sinCeros(v, 1);
  return cuerpo === "0" ? "0 %" : `${v < 0 ? MENOS : "+"}${cuerpo} %`;
}

/** Marca del eje de tiempo: «mar», «ene 2027», «15 mar», «15 mar 2027». */
export function etiquetaTick(dia: string, e: { readonly tipo: "dia" | "mes"; readonly conAnio: boolean }): string {
  const partes = DIA_ISO.exec(dia);
  const mes = partes ? MESES[Number(partes[2]) - 1] : undefined;
  if (!partes || !mes) return SIN_DATO;
  const base = e.tipo === "mes" ? mes : `${Number(partes[3])} ${mes}`;
  return e.conAnio ? `${base} ${partes[1]}` : base;
}
