/**
 * Los controles del simulador de proyecciones (frente proyecciones-pantalla): lo que mueve el usuario, sus valores de
 * arranque y sus topes en la pantalla. Lo que mueve no se guarda. Módulo puro (lo usan el navegador y el servidor).
 */
import { FRECUENCIAS, type Frecuencia } from "@/proyecciones/tipos";

/** Lo que mueve el usuario. Trayectorias, semilla y `hoy` los pone el servidor (src/app/proyecciones/controles.ts). */
export interface Controles {
  readonly horizonteMeses: number;
  readonly aportePeriodico: number;
  readonly frecuenciaAporte: Frecuencia;
  readonly reinvertirDividendos: boolean;
  readonly caidaInicialPct: number;
}

export const CAMPOS_CONTROLES = ["horizonteMeses", "aportePeriodico", "frecuenciaAporte", "reinvertirDividendos", "caidaInicialPct"] as const satisfies readonly (keyof Controles)[];

/** Horizontes rápidos (el ajuste fino va de mes en mes). */
export const HORIZONTES = [
  { meses: 12, texto: "1 año" },
  { meses: 36, texto: "3 años" },
  { meses: 60, texto: "5 años" },
  { meses: 120, texto: "10 años" },
] as const;
export const HORIZONTE_MIN_MESES = 1;
export const HORIZONTE_MAX_MESES = 120;

/** El deslizador de la caída inicial llega hasta aquí (el borde del servidor admite hasta el tope del motor). */
export const CAIDA_MAX_PANTALLA = 60;
/** El aporte que se escribe se recorta a este tope (el mismo MAX_APORTE del motor, src/proyecciones/metodo.ts). */
export const APORTE_MAX = 1e12;

export const TEXTO_FRECUENCIA: Readonly<Record<Frecuencia, string>> = { MENSUAL: "Mensual", TRIMESTRAL: "Trimestral", SEMESTRAL: "Semestral", ANUAL: "Anual" };
export const OPCIONES_FRECUENCIA = FRECUENCIAS.map((f) => ({ clave: f, texto: TEXTO_FRECUENCIA[f] }));

/** Arranque: 5 años, sin aporte, reinvirtiendo los dividendos y sin caída. */
export const CONTROLES_INICIALES: Controles = { horizonteMeses: 60, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0 };

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «7 meses», «1 año», «3 años y 1 mes». */
export function textoHorizonte(meses: number): string {
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anios === 0) return plural(resto, "mes", "meses");
  return resto === 0 ? plural(anios, "año", "años") : `${plural(anios, "año", "años")} y ${plural(resto, "mes", "meses")}`;
}

/** Lo que se escribe en el aporte, como número del borde: vacío, negativo o inválido es 0; más que el tope, el tope. */
export function aporteDeTexto(texto: string): number {
  const v = Number(texto);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(APORTE_MAX, v);
}

/** Un horizonte o una caída del deslizador dentro de sus topes, entero. */
export const enRango = (v: number, minimo: number, maximo: number): number => (Number.isFinite(v) ? Math.min(maximo, Math.max(minimo, Math.round(v))) : minimo);
