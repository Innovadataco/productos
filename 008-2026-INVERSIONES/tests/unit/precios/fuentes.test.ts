// La tabla de fuentes (frente fuente-retraso): nombre visible y retraso en la rueda por fuente, como configuración.
// Una fuente desconocida sale tal cual y sin retraso inventado. Sin recomendar comprar ni vender. Datos inventados.
import { describe, expect, it } from "vitest";
import * as fuentes from "@/precios/fuentes";
import { FUENTES, fuenteDe, nombreDeFuente, pieDePrecios } from "@/precios/fuentes";
import { prohibidasEn } from "../operar/informe/lenguaje";

describe("fuenteDe y nombreDeFuente", () => {
  it("las fuentes de 008 por su nombre claro", () => {
    expect(nombreDeFuente("yahoo")).toBe("Yahoo (BVC)");
    expect(nombreDeFuente("sfc:qhpu-8ixx")).toBe("SFC");
    expect(nombreDeFuente("banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA")).toBe("BanRep");
    expect(nombreDeFuente("dane:anex-IPC-Indices")).toBe("DANE");
    expect(nombreDeFuente("manual")).toBe("Escrito por usted");
  });

  it("una fuente que no conoce sale tal cual; sin fuente, lo dice", () => {
    expect(nombreDeFuente("e2e-ficticio")).toBe("e2e-ficticio");
    expect(nombreDeFuente("Yahoo")).toBe("Yahoo");
    expect(nombreDeFuente("sfc")).toBe("sfc");
    expect(nombreDeFuente(null)).toBe("fuente sin dato");
    expect(nombreDeFuente("")).toBe("fuente sin dato");
    expect(fuenteDe("e2e-ficticio")).toBeNull();
  });

  it("cada fila tiene solo código, nombre y retraso en rueda: nada que afirme lo no verificado; los códigos no se repiten", () => {
    for (const f of FUENTES) {
      expect(Object.keys(f).sort(), f.codigo).toEqual(["codigo", "nombre", "porPrefijo", "retrasoRueda"]);
      expect(f.nombre).not.toBe("");
    }
    expect(new Set(FUENTES.map((f) => f.codigo)).size).toBe(FUENTES.length);
  });

  it("solo Yahoo dice un retraso en rueda («hasta 20 min»); las demás, null; no existe retrasoDe", () => {
    expect(Object.fromEntries(FUENTES.map((f) => [f.codigo, f.retrasoRueda]))).toEqual({
      yahoo: "hasta 20 min de retraso", "sfc:": null, "banrep:": null, "dane:": null, manual: null,
    });
    expect((fuentes as Record<string, unknown>)["retrasoDe"]).toBeUndefined();
  });
});

describe("pieDePrecios", () => {
  it("dice la fuente, el retraso en rueda y que no es tiempo real", () => {
    expect(pieDePrecios()).toBe("Precios: Yahoo (BVC), cierre diario; durante la rueda, hasta 20 min de retraso. No es tiempo real.");
  });

  it("sin lenguaje de consejo (con control positivo del detector)", () => {
    expect(prohibidasEn(pieDePrecios())).toEqual([]);
    for (const f of FUENTES) expect(prohibidasEn(`${f.nombre} ${f.retrasoRueda ?? ""}`), f.codigo).toEqual([]);
    expect(prohibidasEn("Le recomendamos comprar ya.").length).toBeGreaterThan(0);
  });
});
