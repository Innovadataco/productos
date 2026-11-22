/**
 * Validación de los parámetros del simulador en la frontera (vienen del usuario). Nunca lanza: devuelve los errores
 * por campo, en el orden de los campos, con un código. Solo pasan los campos conocidos. Puro.
 */
import { MAX_APORTE, MAX_CAIDA_PCT, MAX_HORIZONTE_MESES, MAX_SEMILLA, MAX_TRABAJO, MAX_TRAYECTORIAS } from "./metodo";
import { FRECUENCIAS, type ErrorParametro, type Frecuencia, type ParametrosProyeccion, type Validacion } from "./tipos";

type Campo = keyof ParametrosProyeccion;
type Lectura<T> = { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly error: ErrorParametro };

const falla = <T>(campo: Campo, codigo: ErrorParametro["codigo"]): Lectura<T> => ({ ok: false, error: { campo, codigo } });

function numero(o: Readonly<Record<string, unknown>>, campo: Campo, minimo: number, maximo: number, entero: boolean): Lectura<number> {
  const v = o[campo];
  if (v === undefined) return falla(campo, "FALTA");
  if (typeof v !== "number" || !Number.isFinite(v)) return falla(campo, "NO_ES_NUMERO");
  if (entero && !Number.isInteger(v)) return falla(campo, "NO_ES_ENTERO");
  if (v < minimo || v > maximo) return falla(campo, "FUERA_DE_RANGO");
  return { ok: true, valor: v };
}

function frecuencia(o: Readonly<Record<string, unknown>>): Lectura<Frecuencia> {
  const v = o["frecuenciaAporte"];
  if (v === undefined) return falla("frecuenciaAporte", "FALTA");
  const f = FRECUENCIAS.find((x) => x === v);
  return f ? { ok: true, valor: f } : falla("frecuenciaAporte", "VALOR_NO_PERMITIDO");
}

function booleano(o: Readonly<Record<string, unknown>>, campo: Campo): Lectura<boolean> {
  const v = o[campo];
  if (v === undefined) return falla(campo, "FALTA");
  return typeof v === "boolean" ? { ok: true, valor: v } : falla(campo, "VALOR_NO_PERMITIDO");
}

const esObjeto = (e: unknown): e is Readonly<Record<string, unknown>> => typeof e === "object" && e !== null && !Array.isArray(e);

export function validarParametros(entrada: unknown): Validacion {
  if (!esObjeto(entrada)) return { ok: false, errores: [{ campo: "entrada", codigo: "VALOR_NO_PERMITIDO" }] };
  const errores: ErrorParametro[] = [];
  const tomar = <T>(l: Lectura<T>): T | undefined => {
    if (l.ok) return l.valor;
    errores.push(l.error);
    return undefined;
  };
  const horizonteMeses = tomar(numero(entrada, "horizonteMeses", 0, MAX_HORIZONTE_MESES, true));
  const aportePeriodico = tomar(numero(entrada, "aportePeriodico", 0, MAX_APORTE, false));
  const frecuenciaAporte = tomar(frecuencia(entrada));
  const reinvertirDividendos = tomar(booleano(entrada, "reinvertirDividendos"));
  const caidaInicialPct = tomar(numero(entrada, "caidaInicialPct", 0, MAX_CAIDA_PCT, false));
  const trayectorias = tomar(numero(entrada, "trayectorias", 1, MAX_TRAYECTORIAS, true));
  const semilla = tomar(numero(entrada, "semilla", 0, MAX_SEMILLA, true));
  if (horizonteMeses !== undefined && trayectorias !== undefined && trayectorias * Math.max(horizonteMeses, 1) > MAX_TRABAJO) {
    errores.push({ campo: "trayectorias", codigo: "DEMASIADO_TRABAJO" });
  }
  if (
    errores.length > 0 || horizonteMeses === undefined || aportePeriodico === undefined || frecuenciaAporte === undefined ||
    reinvertirDividendos === undefined || caidaInicialPct === undefined || trayectorias === undefined || semilla === undefined
  ) {
    return { ok: false, errores };
  }
  return { ok: true, valor: { horizonteMeses, aportePeriodico, frecuenciaAporte, reinvertirDividendos, caidaInicialPct, trayectorias, semilla } };
}
