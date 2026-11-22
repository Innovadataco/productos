/**
 * Derivaciones de los armadores (E1b), puras: lo que el modelo sí ve de cada hecho (dirección, cercanía, frescura y
 * calidad) sale de aquí, calculado por el código, nunca adivinado.
 * - Dirección: del signo (de la cifra, o de su diferencia con la referencia). Sin referencia, NO_APLICA.
 * - Cercanía de una regla: CERCA si la distancia a su nivel es menor que 3 % en valor absoluto (plan de la fase E, §3).
 *   Los días al plazo y a la fecha ex no tienen umbral decidido: van NO_APLICA (decisión pendiente de la Fábrica).
 * - Frescura con el calendario BVC (src/precios/negociacion.ts y horario.ts): HOY si el dato es de hoy; RECIENTE si
 *   entre el dato y hoy no hay ninguna rueda; ATRASADO si hay una. Si el calendario no cubre el año de un día que haría
 *   falta mirar, no se afirma que sea reciente: ATRASADO, y quien llama lo avisa (CALENDARIO_NO_CUBRE).
 * - Las series oficiales y el fondo no siguen las ruedas de la BVC: usan su propia frescura, ya calculada por su módulo
 *   (src/datos-oficiales/series/frescura.ts y el aviso de atraso de src/fondo/guardar.ts).
 * - Calidad según la fuente; un dato atrasado es ATRASADO venga de donde venga.
 */
import type { Calidad, DiaIso, Direccion, Frescura } from "../contrato";
import type { EstadoFrescura } from "../../datos-oficiales/series/frescura";
import { esDiaHabil } from "../../precios/horario";
import type { CalendarioBvc } from "../../precios/negociacion";
import { compararDecimales, diasEntre, exigirDia, signoDe, sumarDiasIso, valorAbsoluto } from "./decimal";
import { ErrorArmado } from "./errores";

/** CERCA si la distancia a la regla es menor que esto, en puntos porcentuales (plan de la fase E, §3). */
export const UMBRAL_CERCANIA_REGLA_PCT = "3";
/** Un tramo así siempre trae una rueda (Semana Santa con su fin de semana son cuatro días sin rueda). */
const MAX_DIAS_SIN_RUEDA = 31;

export function direccionDelSigno(valor: string): "SUBE" | "BAJA" | "IGUAL" {
  const signo = signoDe(valor);
  return signo > 0 ? "SUBE" : signo < 0 ? "BAJA" : "IGUAL";
}

/** Hacia dónde se movió `actual` frente a `referencia`; sin referencia, NO_APLICA. */
export function direccionFrente(actual: string, referencia: string | null): Direccion {
  if (referencia === null) return "NO_APLICA";
  const orden = compararDecimales(actual, referencia);
  return orden > 0 ? "SUBE" : orden < 0 ? "BAJA" : "IGUAL";
}

export function cercaniaDeRegla(distanciaPct: string): "CERCA" | "LEJOS" {
  return compararDecimales(valorAbsoluto(distanciaPct), UMBRAL_CERCANIA_REGLA_PCT) < 0 ? "CERCA" : "LEJOS";
}

export interface FrescuraDerivada {
  readonly frescura: Frescura;
  /** false si hizo falta mirar un día de un año que el calendario BVC no tiene sembrado. */
  readonly calendarioCubre: boolean;
}

const esFinDeSemana = (dia: DiaIso): boolean => {
  const semana = new Date(`${dia}T00:00:00.000Z`).getUTCDay();
  return semana === 0 || semana === 6;
};

/** La frescura de un dato de mercado (cierres, cortes) frente a hoy, con las ruedas de la BVC. */
export function frescuraPorCalendario(fecha: DiaIso, hoy: DiaIso, calendario: CalendarioBvc): FrescuraDerivada {
  const dias = diasEntre(exigirDia(fecha), exigirDia(hoy));
  if (dias < 0) throw new ErrorArmado("FECHA_FUTURA");
  if (dias === 0) return { frescura: "HOY", calendarioCubre: true };
  if (dias > MAX_DIAS_SIN_RUEDA) return { frescura: "ATRASADO", calendarioCubre: true };
  for (let paso = 1; paso < dias; paso += 1) {
    const dia = sumarDiasIso(fecha, paso);
    if (esFinDeSemana(dia)) continue;
    if (!calendario.aniosCubiertos.has(Number(dia.slice(0, 4)))) return { frescura: "ATRASADO", calendarioCubre: false };
    if (esDiaHabil(new Date(`${dia}T00:00:00.000Z`), calendario.noHabiles)) return { frescura: "ATRASADO", calendarioCubre: true };
  }
  return { frescura: "RECIENTE", calendarioCubre: true };
}

/** La frescura de una serie oficial con la de su módulo; SIN_DATOS no da hecho (null). */
export function frescuraDeSerie(f: { readonly estado: EstadoFrescura; readonly cubreHoy: boolean }): Frescura | null {
  if (f.estado === "SIN_DATOS") return null;
  if (f.estado === "ATRASADA") return "ATRASADO";
  return f.cubreHoy ? "HOY" : "RECIENTE";
}

/** La frescura del valor de unidad del fondo: su aviso de atraso manda (la SFC publica con rezago y en días calendario). */
export function frescuraDelFondo(fecha: DiaIso, hoy: DiaIso, atrasado: boolean): Frescura {
  if (atrasado) return "ATRASADO";
  return fecha === hoy ? "HOY" : "RECIENTE";
}

const RANGO_FRESCURA: Readonly<Record<Frescura, number>> = { HOY: 0, RECIENTE: 1, ATRASADO: 2 };

export const peorFrescura = (a: Frescura, b: Frescura): Frescura => (RANGO_FRESCURA[a] >= RANGO_FRESCURA[b] ? a : b);

/** De dónde sale un dato. */
export const ORIGENES_DATO = Object.freeze([
  "REGISTRO", "CIERRE_VERIFICADO", "CIERRE_SIN_VERIFICAR", "PUBLICACION_OFICIAL", "PLAN", "DECRETO", "CALCULO", "ESTIMACION",
] as const);
export type OrigenDato = (typeof ORIGENES_DATO)[number];

/**
 * La calidad de cada origen:
 * - REGISTRO (el nombre de la especie), PLAN (el plan vigente) y PUBLICACION_OFICIAL (SFC, BanRep, DANE): VERIFICADO;
 * - CIERRE_VERIFICADO (cotejado con la certificación de A&V): VERIFICADO; CIERRE_SIN_VERIFICAR: NO_VERIFICADO;
 * - DECRETO (cargado a mano por el dueño; la regla de la fecha ex sigue por verificar): NO_VERIFICADO;
 * - CALCULO (lo que calcula 008): CALCULADO; ESTIMACION (proyecciones, bruto estimado): ESTIMADO.
 */
const CALIDAD_DE: Readonly<Record<OrigenDato, Calidad>> = Object.freeze({
  REGISTRO: "VERIFICADO", CIERRE_VERIFICADO: "VERIFICADO", CIERRE_SIN_VERIFICAR: "NO_VERIFICADO", PUBLICACION_OFICIAL: "VERIFICADO",
  PLAN: "VERIFICADO", DECRETO: "NO_VERIFICADO", CALCULO: "CALCULADO", ESTIMACION: "ESTIMADO",
});

export function calidadDe(origen: OrigenDato, frescura: Frescura): Calidad {
  return frescura === "ATRASADO" ? "ATRASADO" : CALIDAD_DE[origen];
}

