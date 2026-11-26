/**
 * Configuración del segundo ciclo del servicio de precios (precios cada minuto durante la rueda): variables de entorno con
 * valores por omisión. Todas son opcionales; sin ellas el ciclo intradía queda APAGADO y el resto de los valores es el que se describe aquí.
 *   INV_INTRADIA_ENCENDIDO      1/true o 0/false (por omisión, APAGADO). El interruptor: solo 1 o true encienden; vacío, ausente o un
 *                               valor raro APAGAN (falla cerrada; el valor raro deja aviso).
 *   INV_INTRADIA_CICLO_SEG      segundos entre ciclos, de 30 a 3600 (por omisión, 60).
 *   INV_INTRADIA_DESDE_COT      HH:MM de Colombia desde el que se trae (por omisión, 09:30: la apertura de la BVC).
 *   INV_INTRADIA_HASTA_COT      HH:MM de Colombia hasta el que se trae, sin incluirlo (por omisión, 16:25: el cierre de las
 *                               16:00 más la cola del retraso de Yahoo, que entrega con ~20 min; nunca después de las 17:30,
 *                               para no cruzarse con la corrida de las 18:00). La rueda va de 9:30 a 16:00 con el horario de
 *                               invierno de Nueva York y, según fuentes secundarias, de 8:30 a 15:00 con el de verano: por
 *                               verificar con la BVC; con ese horario se cambian estas dos variables.
 *   INV_INTRADIA_PAUSA_MS       milisegundos entre una petición y la siguiente dentro de un ciclo, de 0 a 5000 (por omisión, 500).
 *   INV_INTRADIA_RETENCION_DIAS días que se conservan las barras, de 60 a 365 (por omisión, 60: la base no deja borrar lo más
 *                               joven que 60, y 60 días corridos son siempre al menos 30 días hábiles).
 *   INV_INTRADIA_URL_YAHOO      la URL base de Yahoo (por omisión, la de query1): solo https, sin credenciales, puerto, ruta ni
 *                               consulta, y su nombre no puede ser una IP (el buscador fijo la suma a sus hosts permitidos).
 * Lo inválido cae al valor por omisión y deja un aviso que NO repite lo que llegó (puede ser un valor que no debe verse en el
 * log); el interruptor, ante la duda, apaga.
 */
import { urlBaseYahoo } from "../precios/intradia/url";

export interface ConfigIntradia {
  readonly encendido: boolean;
  readonly cicloMs: number;
  /** Minutos desde la medianoche de Colombia. */
  readonly desdeMin: number;
  readonly hastaMin: number;
  readonly pausaMs: number;
  readonly urlYahoo: string;
  readonly retencionDias: number;
  readonly avisos: readonly string[];
}

export const CONFIG_INTRADIA_POR_OMISION: ConfigIntradia = Object.freeze({
  encendido: false,
  cicloMs: 60_000,
  desdeMin: 9 * 60 + 30,
  hastaMin: 16 * 60 + 25,
  pausaMs: 500,
  urlYahoo: "https://query1.finance.yahoo.com",
  retencionDias: 60,
  avisos: Object.freeze([]) as readonly string[],
});

const HASTA_MAXIMO_MIN = 17 * 60 + 30;
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ENTERO_RE = /^\d{1,6}$/;
type Entorno = Readonly<Record<string, string | undefined>>;

/** Lo que hay en la variable, sin espacios en los extremos; null si no está o está vacía (= usar la omisión, sin aviso). */
function valorDe(env: Entorno, nombre: string): string | null {
  const v = env[nombre]?.trim();
  return v === undefined || v === "" ? null : v;
}

/** Un entero en [min, max]; si no está, null sin aviso; si es inválido, null y el aviso. */
function enteroEn(env: Entorno, nombre: string, min: number, max: number, avisos: string[]): number | null {
  const v = valorDe(env, nombre);
  if (v === null) return null;
  const n = ENTERO_RE.test(v) ? Number(v) : Number.NaN;
  if (Number.isInteger(n) && n >= min && n <= max) return n;
  avisos.push(`${nombre} inválida (entero de ${min} a ${max}): se usa el valor por omisión`);
  return null;
}

function interruptor(env: Entorno, avisos: string[]): boolean {
  const v = valorDe(env, "INV_INTRADIA_ENCENDIDO")?.toLowerCase();
  if (v === undefined) return CONFIG_INTRADIA_POR_OMISION.encendido;
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  avisos.push("INV_INTRADIA_ENCENDIDO inválida (1 o 0): el ciclo intradía queda APAGADO");
  return false;
}

/** Minutos desde la medianoche de «HH:MM»; null si no está; NaN si es inválida (con aviso). */
function horaEn(env: Entorno, nombre: string, avisos: string[]): number | null {
  const v = valorDe(env, nombre);
  if (v === null) return null;
  const m = HORA_RE.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  avisos.push(`${nombre} inválida (HH:MM de Colombia)`);
  return Number.NaN;
}

function ventana(env: Entorno, avisos: string[]): { desdeMin: number; hastaMin: number } {
  const omision = { desdeMin: CONFIG_INTRADIA_POR_OMISION.desdeMin, hastaMin: CONFIG_INTRADIA_POR_OMISION.hastaMin };
  const desde = horaEn(env, "INV_INTRADIA_DESDE_COT", avisos);
  const hasta = horaEn(env, "INV_INTRADIA_HASTA_COT", avisos);
  if ((desde !== null && Number.isNaN(desde)) || (hasta !== null && Number.isNaN(hasta))) return omision;
  const d = desde ?? omision.desdeMin;
  const h = hasta ?? omision.hastaMin;
  if (d >= h || h > HASTA_MAXIMO_MIN) {
    avisos.push("La ventana intradía es inválida (desde antes de hasta, y hasta no después de las 17:30): se usa la de por omisión");
    return omision;
  }
  return { desdeMin: d, hastaMin: h };
}

function url(env: Entorno, avisos: string[]): string {
  const v = valorDe(env, "INV_INTRADIA_URL_YAHOO");
  if (v === null) return CONFIG_INTRADIA_POR_OMISION.urlYahoo;
  const base = urlBaseYahoo(v);
  if (base !== null) return base;
  avisos.push("INV_INTRADIA_URL_YAHOO inválida (https, sin credenciales, puerto, ruta ni consulta): se usa la de por omisión");
  return CONFIG_INTRADIA_POR_OMISION.urlYahoo;
}

export function leerConfigIntradia(env: Entorno): ConfigIntradia {
  const avisos: string[] = [];
  const encendido = interruptor(env, avisos);
  const ciclo = enteroEn(env, "INV_INTRADIA_CICLO_SEG", 30, 3600, avisos);
  const pausa = enteroEn(env, "INV_INTRADIA_PAUSA_MS", 0, 5000, avisos);
  const dias = enteroEn(env, "INV_INTRADIA_RETENCION_DIAS", 60, 365, avisos);
  const { desdeMin, hastaMin } = ventana(env, avisos);
  return {
    encendido,
    cicloMs: ciclo === null ? CONFIG_INTRADIA_POR_OMISION.cicloMs : ciclo * 1000,
    desdeMin,
    hastaMin,
    pausaMs: pausa ?? CONFIG_INTRADIA_POR_OMISION.pausaMs,
    urlYahoo: url(env, avisos),
    retencionDias: dias ?? CONFIG_INTRADIA_POR_OMISION.retencionDias,
    avisos,
  };
}
