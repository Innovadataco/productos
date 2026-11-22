// Validación de los parámetros del simulador en la frontera (lo que mueve el usuario y no se guarda). Puro: nunca
// lanza; devuelve los errores por campo con su código.
import { describe, expect, it } from "vitest";
import { MAX_TRABAJO } from "@/proyecciones/metodo";
import { validarParametros } from "@/proyecciones/parametros";

const validos = {
  horizonteMeses: 120, aportePeriodico: 371.53, frecuenciaAporte: "TRIMESTRAL", reinvertirDividendos: true,
  caidaInicialPct: 12.7, trayectorias: 5000, semilla: 4613,
} as const;

const errores = (cambios: Record<string, unknown>) => {
  const r = validarParametros({ ...validos, ...cambios });
  return r.ok ? [] : r.errores;
};

describe("validarParametros", () => {
  it("acepta lo válido y devuelve solo los campos conocidos", () => {
    const r = validarParametros({ ...validos, extra: "<script>", __proto__: { x: 1 } });
    expect(r).toEqual({ ok: true, valor: { ...validos } });
  });

  it("horizonte: entero de 0 a 360", () => {
    expect(errores({ horizonteMeses: 0 })).toEqual([]);
    expect(errores({ horizonteMeses: 360, trayectorias: 2917 })).toEqual([]);
    expect(errores({ horizonteMeses: 361 })).toEqual([{ campo: "horizonteMeses", codigo: "FUERA_DE_RANGO" }]);
    expect(errores({ horizonteMeses: -1 })).toEqual([{ campo: "horizonteMeses", codigo: "FUERA_DE_RANGO" }]);
    expect(errores({ horizonteMeses: 1.5 })).toEqual([{ campo: "horizonteMeses", codigo: "NO_ES_ENTERO" }]);
    expect(errores({ horizonteMeses: "12" })).toEqual([{ campo: "horizonteMeses", codigo: "NO_ES_NUMERO" }]);
    expect(errores({ horizonteMeses: Number.NaN })).toEqual([{ campo: "horizonteMeses", codigo: "NO_ES_NUMERO" }]);
    expect(errores({ horizonteMeses: undefined })).toEqual([{ campo: "horizonteMeses", codigo: "FALTA" }]);
  });

  it("aporte: número finito ≥ 0 con tope; frecuencia de la lista", () => {
    expect(errores({ aportePeriodico: 0 })).toEqual([]);
    expect(errores({ aportePeriodico: -0.01 })).toEqual([{ campo: "aportePeriodico", codigo: "FUERA_DE_RANGO" }]);
    expect(errores({ aportePeriodico: Number.POSITIVE_INFINITY })).toEqual([{ campo: "aportePeriodico", codigo: "NO_ES_NUMERO" }]);
    expect(errores({ aportePeriodico: 1e13 })).toEqual([{ campo: "aportePeriodico", codigo: "FUERA_DE_RANGO" }]);
    for (const f of ["MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"]) expect(errores({ frecuenciaAporte: f })).toEqual([]);
    expect(errores({ frecuenciaAporte: "SEMANAL" })).toEqual([{ campo: "frecuenciaAporte", codigo: "VALOR_NO_PERMITIDO" }]);
    expect(errores({ frecuenciaAporte: "toString" })).toEqual([{ campo: "frecuenciaAporte", codigo: "VALOR_NO_PERMITIDO" }]);
  });

  it("reinvertir: booleano; caída: de 0 a 99 %", () => {
    expect(errores({ reinvertirDividendos: "true" })).toEqual([{ campo: "reinvertirDividendos", codigo: "VALOR_NO_PERMITIDO" }]);
    expect(errores({ caidaInicialPct: 0 })).toEqual([]);
    expect(errores({ caidaInicialPct: 99 })).toEqual([]);
    expect(errores({ caidaInicialPct: 99.5 })).toEqual([{ campo: "caidaInicialPct", codigo: "FUERA_DE_RANGO" }]);
    expect(errores({ caidaInicialPct: -3 })).toEqual([{ campo: "caidaInicialPct", codigo: "FUERA_DE_RANGO" }]);
  });

  it("trayectorias: entero de 1 a 10.000; semilla: entero de 0 a 2^32 − 1", () => {
    expect(errores({ trayectorias: 1 })).toEqual([]);
    expect(errores({ trayectorias: 0 })).toEqual([{ campo: "trayectorias", codigo: "FUERA_DE_RANGO" }]);
    expect(errores({ trayectorias: 10_001, horizonteMeses: 1 })).toEqual([{ campo: "trayectorias", codigo: "FUERA_DE_RANGO" }]);
    expect(errores({ semilla: 0 })).toEqual([]);
    expect(errores({ semilla: 4294967295 })).toEqual([]);
    expect(errores({ semilla: 2 ** 32 })).toEqual([{ campo: "semilla", codigo: "FUERA_DE_RANGO" }]);
    expect(errores({ semilla: 7.25 })).toEqual([{ campo: "semilla", codigo: "NO_ES_ENTERO" }]);
  });

  it("tope de trabajo: trayectorias × meses (o × 1 con horizonte 0)", () => {
    expect(MAX_TRABAJO).toBe(1_200_000);
    expect(errores({ trayectorias: 10_000, horizonteMeses: 120 })).toEqual([]);
    expect(errores({ trayectorias: 10_000, horizonteMeses: 121 })).toEqual([{ campo: "trayectorias", codigo: "DEMASIADO_TRABAJO" }]);
    expect(errores({ trayectorias: 10_000, horizonteMeses: 0 })).toEqual([]);
  });

  it("varios errores juntos, en el orden de los campos", () => {
    expect(errores({ horizonteMeses: -2, frecuenciaAporte: null, semilla: "x" }).map((e) => e.campo)).toEqual(["horizonteMeses", "frecuenciaAporte", "semilla"]);
  });

  it("una entrada que no es objeto no lanza", () => {
    for (const e of [null, undefined, 3, "x", [validos]]) expect(validarParametros(e)).toEqual({ ok: false, errores: [{ campo: "entrada", codigo: "VALOR_NO_PERMITIDO" }] });
  });
});
