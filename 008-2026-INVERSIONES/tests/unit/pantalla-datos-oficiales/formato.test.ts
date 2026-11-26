// Formatos de /datos-oficiales (frente datos-oficiales-pantalla, C6a): la cifra sale del texto decimal (nunca truncada
// ni redondeada; se completa a la escala del catálogo), la vigencia por su forma (DIA, TRAMO, MES), la frescura en
// palabras, la hora de la carga y lo que necesita la gráfica. Regla: «hoy» solo con valeHoy (cubreHoy de C5a): un dato
// viejo nunca se presenta como el de hoy. Cifras inventadas.
import { describe, expect, it } from "vitest";
import {
  PIE_DATOS_OFICIALES, TEXTO_ENTRADA, TEXTO_ESTADO, cifra, conSigno, detalleFrescura, estadoDe, extraDetalle, formatoDia, formatoEje, formatoY, lineaVigencia, mes,
  notaSinGrafica, paraGrafica, rangoVigencia, resumenGrafica, sigla, textoVariacionFaltante, tituloGrafica, traidoEl, valores,
} from "@/app/datos-oficiales/formato";
import { IBR, IPC, TPM, TRM, conError, sinDatos } from "./ficticio";

describe("cifra: del texto decimal, sin Number", () => {
  it.each([
    ["3923.07", 2, "3.923,07"],
    ["4.37", 2, "4,37"],
    ["4.5", 2, "4,50"],
    ["3.917", 3, "3,917"],
    ["134", 2, "134,00"],
    ["1234567.891", 2, "1.234.567,891"],
    ["0.5", 0, "0,5"],
    ["-2.71", 2, "−2,71"],
  ])("%s con escala %i → %s (completa, nunca trunca)", (valor, escala, esperado) => {
    expect(cifra(valor, escala)).toBe(esperado);
  });

  it("lo que no es un decimal no se pinta", () => {
    for (const malo of ["", "1e5", "1,5", "abc", "1.2.3", " 4.37"]) expect(cifra(malo, 2)).toBe("—");
  });

  it("la variación lleva su signo (+ / −) y nada en el cero", () => {
    expect(conSigno("2.71")).toBe("+2,71");
    expect(conSigno("-0.41")).toBe("−0,41");
    expect(conSigno("0.00")).toBe("0,00");
  });
});

describe("vigencia", () => {
  it("mes, día y tramo", () => {
    expect(mes("2021-02-01")).toBe("feb-2021");
    expect(mes("2020-12-01")).toBe("dic-2020");
    expect(rangoVigencia("MES", "2021-02-01", "2021-02-28")).toBe("feb-2021");
    expect(rangoVigencia("DIA", "2021-03-16", "2021-03-16")).toBe("el 16-mar-2021");
    expect(rangoVigencia("TRAMO", "2021-03-17", "2021-03-17")).toBe("el 17-mar-2021");
    expect(rangoVigencia("TRAMO", "2021-03-13", "2021-03-15")).toBe("del 13-mar-2021 al 15-mar-2021");
  });

  it("«Vale hoy» solo con valeHoy; si no, dice que no es la cifra de hoy", () => {
    expect(lineaVigencia(TRM)).toBe("Vale hoy · vigente el 17-mar-2021");
    expect(lineaVigencia({ ...TRM, ultimo: { ...TRM.ultimo, desde: "2021-03-16", hasta: "2021-03-18" } })).toBe("Vale hoy · vigente del 16-mar-2021 al 18-mar-2021");
    expect(lineaVigencia(TPM)).toBe("No es la cifra de hoy · vigente el 16-mar-2021");
    expect(lineaVigencia(IBR)).toBe("No es la cifra de hoy · vigente el 5-mar-2021");
    expect(lineaVigencia(IPC)).toBe("No es la cifra de hoy · corresponde a feb-2021");
    // Aunque la vigencia la cubriera, sin valeHoy no dice «Vale hoy».
    expect(lineaVigencia({ ...TRM, frescura: { ...TRM.frescura, valeHoy: false } })).toMatch(/^No es la cifra de hoy/);
  });
});

describe("frescura y estado", () => {
  it("el estado de cada tarjeta, en palabras", () => {
    expect([TRM, TPM, IBR, IPC, sinDatos("TPM"), conError("TRM")].map((s) => TEXTO_ESTADO[estadoDe(s)])).toEqual(["Al día", "Al día", "Atrasada", "Al día", "Sin datos", "No se pudo leer"]);
  });

  it("el detalle: si la vigencia corre, o hace cuánto terminó y desde cuándo se marca atrasada", () => {
    expect(detalleFrescura(TRM.frescura)).toBe("Su vigencia todavía corre.");
    expect(detalleFrescura(TPM.frescura)).toBe("Terminó hace 1 día; se marca atrasada desde 7 días.");
    expect(detalleFrescura(IBR.frescura)).toBe("Terminó hace 12 días; se marca atrasada desde 7 días.");
    expect(detalleFrescura({ estado: "AL_DIA", dias: 2, umbralDias: 1, valeHoy: false })).toBe("Terminó hace 2 días; se marca atrasada desde 1 día.");
  });

  it("la hora de la carga y cómo entra", () => {
    expect(traidoEl("2021-03-16 18:41")).toBe("16-mar-2021 a las 18:41 (hora de Colombia)");
    expect(traidoEl("roto")).toBe("—");
    expect(TEXTO_ENTRADA.VIA_B).toBe("A mano: la carga el dueño (vía B)");
  });

  it("la sigla de cada serie del catálogo; otra sale con su código", () => {
    expect(["TRM", "TPM", "IBR_3M_EA", "IPC_INDICE", "OTRA_SERIE"].map(sigla)).toEqual(["TRM", "TPM", "IBR 3M", "IPC", "OTRA_SERIE"]);
  });

  it("la variación que falta: sin base o sin poder calcularla", () => {
    expect(textoVariacionFaltante({ estado: "SIN_BASE", mesBase: "2020-02-01" })).toBe("falta el índice de feb-2020 (el mismo mes del año anterior): no se calcula.");
    expect(textoVariacionFaltante({ estado: "NO_SE_PUDO" })).toBe("no se pudo calcular con los índices guardados.");
  });

  it("el pie: informa y no recomienda", () => {
    expect(PIE_DATOS_OFICIALES).toBe("Inversiones informa; no recomienda comprar ni vender.");
  });
});

describe("lo que usa la gráfica", () => {
  it("al navegador va solo lo que dibuja la gráfica (revisión react-reviewer, MEDIO: el payload)", () => {
    const g = paraGrafica(TRM);
    expect(Object.keys(g).sort()).toEqual(["codigo", "escala", "historia", "nombre", "unidad", "ventana", "vigencia"]);
    expect(g.historia).toBe(TRM.historia);
  });

  it("el título dice la ventana", () => {
    expect(tituloGrafica(TRM)).toBe("Tasa Representativa del Mercado, último año");
    expect(tituloGrafica(IPC)).toBe("Índice de precios al consumidor, últimos cinco años");
  });

  it("los valores y los formatos (deterministas: sin Intl)", () => {
    expect(valores(TRM)).toEqual([3917.43, 3921.17, 3919.61, 3923.07]);
    expect(formatoY(TRM)(3923.07)).toBe("3.923,07");
    expect(formatoY(TPM)(4.37)).toBe("4,37 %");
    expect(formatoY(IBR)(3.9)).toBe("3,900 %");
    expect(formatoEje(TRM)(3920)).toBe("3.920");
    expect(formatoEje(TPM)(4.4)).toBe("4,4 %");
    expect(formatoEje(IPC)(132.5)).toBe("132,5");
    expect(formatoDia(TRM)("2021-03-13")).toBe("13-mar-2021");
    expect(formatoDia(IPC)("2021-02-01")).toBe("feb-2021");
  });

  it("el detalle de un punto dice hasta cuándo vale un tramo de varios días; un día o un mes, nada", () => {
    const extra = extraDetalle(TRM);
    expect(extra(1)).toBe("Vigente hasta el 15-mar-2021");
    expect(extra(0)).toBeNull();
    expect(extra(99)).toBeNull();
    expect(extraDetalle(IPC)(3)).toBeNull();
  });

  it("el resumen con las cifras exactas: desde, hasta, mínimo y máximo", () => {
    expect(resumenGrafica(TRM)).toBe(
      "Del 12-mar-2021 al 17-mar-2021, en COP por USD: pasó de 3.917,43 a 3.923,07; el mínimo fue 3.917,43 (12-mar-2021) y el máximo 3.923,07 (17-mar-2021).",
    );
    expect(resumenGrafica(IPC)).toMatch(/^Del feb-2020 al feb-2021, en índice \(base dic-2018 = 100\): pasó de 131,37 a 134,93; el mínimo fue 131,37 \(feb-2020\)/);
  });

  it("sin dos puntos no hay gráfica: lo dice con la ventana", () => {
    expect(notaSinGrafica(TRM)).toBeNull();
    expect(notaSinGrafica({ ...TRM, historia: TRM.historia.slice(-1) })).toBe("Solo hay un valor en el último año: la gráfica aparece con dos o más.");
    expect(notaSinGrafica({ ...IPC, historia: [] })).toBe("No hay valores en los últimos cinco años: el último cargado es anterior.");
  });
});
