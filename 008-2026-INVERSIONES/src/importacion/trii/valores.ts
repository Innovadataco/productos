/**
 * Lectura estricta de los valores de los CSV de Trii. Lo que no reconoce lo rechaza con un
 * código (nunca adivina un formato). Los montos se devuelven como texto decimal canónico,
 * para pasarlos a Prisma.Decimal sin pasar por punto flotante.
 */
export type ResultadoValor<T> = { ok: true; valor: T } | { ok: false; codigo: string };

const MESES: Readonly<Record<string, number>> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/** Desfase de Colombia (no tiene horario de verano). */
const DESFASE_COT_HORAS = 5;

/** Espacios normales, sin separación (U+00A0) y estrechos (U+202F) → un espacio normal. */
function normalizarEspacios(texto: string): string {
  return texto.replace(/[   \s]+/g, " ").trim();
}

/** Fecha de negocio (sin hora) como Date a medianoche UTC, que es lo que Prisma guarda en @db.Date. */
export function fechaDeNegocio(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function fechaValida(anio: number, mes: number, dia: number): boolean {
  const f = fechaDeNegocio(anio, mes, dia);
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia;
}

/**
 * «12 may 2025, 4:42 p. m.» (hora de Colombia) → instante UTC y fecha de negocio en Colombia.
 * Acepta «a. m.»/«p. m.» con o sin espacios y puntos, meses abreviados con o sin punto.
 */
export function leerFechaHoraTrii(texto: string): ResultadoValor<{ instante: Date; fecha: Date }> {
  const t = normalizarEspacios(texto).toLowerCase();
  const m = /^(\d{1,2}) ([a-z]{3,4})\.? (\d{4}),? (\d{1,2}):(\d{2}) ?([ap])\.? ?m\.?$/.exec(t);
  if (!m) return { ok: false, codigo: "FECHA_HORA_FORMATO" };
  const [, d, mesTxt, a, h, min, ampm] = m;
  const mes = MESES[mesTxt!];
  const dia = Number(d);
  const anio = Number(a);
  const hora12 = Number(h);
  const minuto = Number(min);
  if (!mes) return { ok: false, codigo: "FECHA_MES_DESCONOCIDO" };
  if (!fechaValida(anio, mes, dia) || hora12 < 1 || hora12 > 12 || minuto > 59) {
    return { ok: false, codigo: "FECHA_HORA_INVALIDA" };
  }
  const hora24 = (hora12 % 12) + (ampm === "p" ? 12 : 0);
  const instante = new Date(Date.UTC(anio, mes - 1, dia, hora24 + DESFASE_COT_HORAS, minuto));
  return { ok: true, valor: { instante, fecha: fechaDeNegocio(anio, mes, dia) } };
}

/** «2026-10-19» → fecha de negocio. */
export function leerFechaIso(texto: string): ResultadoValor<Date> {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizarEspacios(texto));
  if (!m) return { ok: false, codigo: "FECHA_FORMATO" };
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!fechaValida(anio, mes, dia)) return { ok: false, codigo: "FECHA_INVALIDA" };
  return { ok: true, valor: fechaDeNegocio(anio, mes, dia) };
}

/** Escala (decimales) de las columnas de la base: precios Decimal(20,6), montos Decimal(20,4). */
export const ESCALA_PRECIO = 6;
export const ESCALA_MONTO = 4;
const DIGITOS_TOTALES = 20;

/**
 * Número decimal con punto, sin separador de miles: «23778.4», «1500», «0.35».
 * Devuelve el texto canónico: sin ceros sobrantes a la izquierda ni a la derecha de la fracción
 * («1500.0» y «1500» son el mismo número y deben dar la misma clave). Rechaza comas, «$»,
 * exponentes, más decimales que la escala de la columna (`NUMERO_PRECISION`, para no redondear
 * en silencio) y números que no caben en ella (`NUMERO_RANGO`).
 */
export function leerDecimal(texto: string, escala: number = ESCALA_MONTO): ResultadoValor<string> {
  const t = normalizarEspacios(texto);
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { ok: false, codigo: "NUMERO_FORMATO" };
  const negativo = t.startsWith("-");
  const [entera, fraccionCruda = ""] = (negativo ? t.slice(1) : t).split(".");
  const enteraLimpia = entera!.replace(/^0+(?=\d)/, "");
  const fraccion = fraccionCruda.replace(/0+$/, "");
  if (fraccion.length > escala) return { ok: false, codigo: "NUMERO_PRECISION" };
  if (enteraLimpia.length > DIGITOS_TOTALES - escala) return { ok: false, codigo: "NUMERO_RANGO" };
  const canon = fraccion ? `${enteraLimpia}.${fraccion}` : enteraLimpia;
  return { ok: true, valor: negativo && canon !== "0" ? `-${canon}` : canon };
}

/** Cantidad entera de acciones: «1412» o «1412/1412» (completadas/solicitadas). */
export function leerCantidad(texto: string): ResultadoValor<{ completada: bigint; solicitada: bigint | null }> {
  const t = normalizarEspacios(texto);
  const m = /^(\d+)(?:\/(\d+))?$/.exec(t);
  if (!m) return { ok: false, codigo: "CANTIDAD_FORMATO" };
  const completada = BigInt(m[1]!);
  const solicitada = m[2] === undefined ? null : BigInt(m[2]);
  if (solicitada !== null && completada > solicitada) return { ok: false, codigo: "CANTIDAD_INCOHERENTE" };
  return { ok: true, valor: { completada, solicitada } };
}

/** Texto de categoría tal cual viene (sin tildes ni mayúsculas) comparado contra los permitidos. */
export function leerCategoria<T extends string>(texto: string, mapa: Readonly<Record<string, T>>): ResultadoValor<T> {
  const clave = normalizarEspacios(texto).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const valor = mapa[clave];
  return valor ? { ok: true, valor } : { ok: false, codigo: "CATEGORIA_DESCONOCIDA" };
}

/** Nemotécnico o ticker: mayúsculas, letras y números. */
export function leerNemotecnico(texto: string): ResultadoValor<string> {
  const t = normalizarEspacios(texto).toUpperCase();
  return /^[A-Z0-9]{2,20}$/.test(t) ? { ok: true, valor: t } : { ok: false, codigo: "NEMOTECNICO_FORMATO" };
}
