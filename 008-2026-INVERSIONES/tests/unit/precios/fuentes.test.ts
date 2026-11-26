// La tabla de fuentes (frente fuente-retraso): nombre visible, retraso típico y nota por fuente, como configuración.
// Una fuente desconocida sale tal cual y sin retraso inventado. Sin recomendar comprar ni vender. Datos inventados.
import { describe, expect, it } from "vitest";
import { FUENTES, fuenteDe, nombreDeFuente, pieDePrecios, retrasoDe } from "@/precios/fuentes";
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

  it("cada fila tiene nombre, retraso de cierre y nota, y los códigos no se repiten", () => {
    for (const f of FUENTES) {
      expect(f.nombre).not.toBe("");
      expect(f.retrasoCierre).not.toBe("");
      expect(f.nota).not.toBe("");
    }
    expect(new Set(FUENTES.map((f) => f.codigo)).size).toBe(FUENTES.length);
  });
});

describe("retrasoDe", () => {
  it("Yahoo: hasta 20 min en la rueda; el cierre, el oficial del día", () => {
    expect(retrasoDe("yahoo", "RUEDA")).toBe("en la rueda, hasta 20 min de retraso");
    expect(retrasoDe("yahoo", "CIERRE")).toBe("cierre oficial del día");
  });

  it("una fuente sin precios en rueda no inventa un retraso; una desconocida, tampoco", () => {
    expect(retrasoDe("sfc:x", "RUEDA")).toBeNull();
    expect(retrasoDe("e2e-ficticio", "CIERRE")).toBeNull();
    expect(retrasoDe(null, "CIERRE")).toBeNull();
  });
});

describe("pieDePrecios", () => {
  it("dice la fuente, el retraso en rueda y que no es tiempo real", () => {
    expect(pieDePrecios()).toBe("Precios: Yahoo (BVC), cierre diario; durante la rueda, hasta 20 min de retraso. No es tiempo real.");
  });

  it("sin lenguaje de consejo (con control positivo del detector)", () => {
    expect(prohibidasEn(pieDePrecios())).toEqual([]);
    for (const f of FUENTES) expect(prohibidasEn(`${f.nombre} ${f.retrasoCierre} ${f.nota} ${f.retrasoRueda ?? ""}`), f.codigo).toEqual([]);
    expect(prohibidasEn("Le recomendamos comprar ya.").length).toBeGreaterThan(0);
  });
});
