// Los controles del simulador en el borde (frente proyecciones-pantalla, contrato de src/proyecciones/proyectar.ts):
// el cliente manda EXACTAMENTE los cinco controles; trayectorias, semilla y `hoy` los pone el servidor; el horizonte
// de la pantalla va de 1 a 120 meses (el motor admite 360). Valores inventados.
import { describe, expect, it } from "vitest";
import { SEMILLA_PANTALLA, TRAYECTORIAS_PANTALLA, validarControles } from "@/app/proyecciones/controles";
import { CONTROLES_INICIALES, HORIZONTES, HORIZONTE_MAX_MESES, textoHorizonte } from "@/app/proyecciones/opciones";

const BIEN = { horizonteMeses: 37, aportePeriodico: 413.71, frecuenciaAporte: "TRIMESTRAL", reinvertirDividendos: false, caidaInicialPct: 13.7 };

describe("validarControles", () => {
  it("los cinco controles válidos pasan; el servidor agrega trayectorias y semilla fijas", () => {
    expect(validarControles(BIEN)).toEqual({ ok: true, valor: { ...BIEN, trayectorias: TRAYECTORIAS_PANTALLA, semilla: SEMILLA_PANTALLA } });
    expect(TRAYECTORIAS_PANTALLA).toBe(2000);
    expect(Number.isInteger(SEMILLA_PANTALLA)).toBe(true);
  });

  it.each([
    ["trayectorias", { ...BIEN, trayectorias: 9999 }],
    ["semilla", { ...BIEN, semilla: 7 }],
    ["hoy", { ...BIEN, hoy: "2027-01-04" }],
    ["un campo cualquiera", { ...BIEN, extra: 1 }],
  ])("un campo de más (%s) se rechaza entero: el cliente no elige trayectorias, semilla ni hoy", (_caso, entrada) => {
    expect(validarControles(entrada)).toEqual({ ok: false, errores: [{ campo: "entrada", codigo: "VALOR_NO_PERMITIDO" }] });
  });

  it.each([null, 7, "x", [BIEN], { ...BIEN, horizonteMeses: undefined }])("lo que no es el objeto de cinco controles se rechaza (%j)", (entrada) => {
    expect(validarControles(entrada).ok).toBe(false);
  });

  it.each([
    [{ horizonteMeses: 0 }, "horizonteMeses", "FUERA_DE_RANGO"],
    [{ horizonteMeses: 121 }, "horizonteMeses", "FUERA_DE_RANGO"],
    [{ horizonteMeses: 360 }, "horizonteMeses", "FUERA_DE_RANGO"],
    [{ horizonteMeses: 12.5 }, "horizonteMeses", "NO_ES_ENTERO"],
    [{ aportePeriodico: -1 }, "aportePeriodico", "FUERA_DE_RANGO"],
    [{ aportePeriodico: "413" }, "aportePeriodico", "NO_ES_NUMERO"],
    [{ frecuenciaAporte: "SEMANAL" }, "frecuenciaAporte", "VALOR_NO_PERMITIDO"],
    [{ reinvertirDividendos: "si" }, "reinvertirDividendos", "VALOR_NO_PERMITIDO"],
    [{ caidaInicialPct: 99.5 }, "caidaInicialPct", "FUERA_DE_RANGO"],
    [{ caidaInicialPct: Number.NaN }, "caidaInicialPct", "NO_ES_NUMERO"],
  ])("tope del borde: %j → %s %s", (cambio, campo, codigo) => {
    const r = validarControles({ ...BIEN, ...cambio });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toContainEqual({ campo, codigo });
  });

  it("el horizonte de la pantalla llega hasta 120 meses", () => {
    expect(HORIZONTE_MAX_MESES).toBe(120);
    expect(validarControles({ ...BIEN, horizonteMeses: 120 }).ok).toBe(true);
    expect(validarControles({ ...BIEN, horizonteMeses: 1 }).ok).toBe(true);
  });
});

describe("opciones de la pantalla", () => {
  it("los horizontes rápidos son 1, 3, 5 y 10 años; se arranca a 5 años, sin aporte, reinvirtiendo y sin caída", () => {
    expect(HORIZONTES.map((h) => h.meses)).toEqual([12, 36, 60, 120]);
    expect(CONTROLES_INICIALES).toEqual({ horizonteMeses: 60, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0 });
    expect(validarControles(CONTROLES_INICIALES).ok).toBe(true);
  });

  it.each([[1, "1 mes"], [7, "7 meses"], [12, "1 año"], [13, "1 año y 1 mes"], [37, "3 años y 1 mes"], [60, "5 años"], [119, "9 años y 11 meses"]])(
    "textoHorizonte(%i) = «%s»",
    (meses, esperado) => {
      expect(textoHorizonte(meses)).toBe(esperado);
    },
  );
});
