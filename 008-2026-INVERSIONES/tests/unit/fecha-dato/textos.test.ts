// Los textos de la procedencia de cada dato (frente fecha-hora-datos): de cuándo es el dato, cuándo lo trajo 008 (en
// hora de Colombia) y de qué fuente; en un valor que suma varios datos, el más viejo y el aviso si hay fechas
// distintas. Puros y deterministas (los pinta el servidor y el navegador). Sin comandos y sin recomendar comprar ni
// vender: las listas de palabras son las de los candados de textos de las pantallas. Datos inventados.
import { describe, expect, it } from "vitest";
import {
  avisoMezcladas, nombreFuente, nombresDeFuentes, piezasCompuesta, piezasProcedencia, textoCompuesta, textoProcedencia,
} from "@/app/_comun/fecha-dato/textos";
import type { Procedencia, ProcedenciaCompuesta } from "@/app/_comun/fecha-dato/tipos";

const PROHIBIDO =
  /\b(compr[ae]n?|compre|vendan?|venda|vender ya|mant[ée]ngal?[ao]s?|mantenga|mantener|conserve|conservar|invierta|invertir|aproveche|aprovechar|le conviene|convendr[íi]a|deber[íi]a|recomendamos|le recomendamos|recomendado|le sugerimos|sugerimos|se[ñn]al de (compra|venta)|oportunidad de (compra|venta)|es (buen )?momento de|recomend\w*)\b/i;
const COMANDO = /\b(importar-series|importar-decretos|cargar-prod|exportar-[a-z]+|npx|npm|tsx|\.sh|prisma)\b/;

const p = (o: Partial<Procedencia> = {}): Procedencia => ({ dia: "2027-03-17", traidoEn: "2027-03-17 18:04", fuente: "yahoo", ...o });
const compuesta = (o: Partial<ProcedenciaCompuesta> = {}): ProcedenciaCompuesta => ({
  masVieja: p({ dia: "2021-03-01", traidoEn: "2021-03-02 18:40" }), masReciente: "2021-03-17", mezcladas: true, fuentes: ["yahoo"], ...o,
});

describe("nombreFuente", () => {
  it("las fuentes de 008 por su nombre: BVC por Yahoo, SFC, BanRep y DANE", () => {
    expect(nombreFuente("yahoo")).toBe("BVC por Yahoo");
    expect(nombreFuente("sfc:qhpu-8ixx")).toBe("SFC");
    expect(nombreFuente("sfc:32sa-8pi3")).toBe("SFC");
    expect(nombreFuente("banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA")).toBe("BanRep");
    expect(nombreFuente("dane:anex-IPC-Indices")).toBe("DANE");
  });

  it("una fuente que no conoce sale tal cual (no inventa un nombre); sin fuente, lo dice", () => {
    expect(nombreFuente("e2e-ficticio")).toBe("e2e-ficticio");
    expect(nombreFuente("Yahoo")).toBe("Yahoo");
    expect(nombreFuente("sfc")).toBe("sfc");
    expect(nombreFuente(null)).toBe("fuente sin dato");
    expect(nombreFuente("")).toBe("fuente sin dato");
  });

  it("varias fuentes: sin repetir el nombre, en el orden de su código", () => {
    expect(nombresDeFuentes(["yahoo"])).toBe("BVC por Yahoo");
    expect(nombresDeFuentes(["yahoo", "sfc:qhpu-8ixx"])).toBe("SFC y BVC por Yahoo");
    expect(nombresDeFuentes(["yahoo", "dane:x", "banrep:y", "sfc:a", "sfc:b"])).toBe("BanRep, DANE, SFC y BVC por Yahoo");
    expect(nombresDeFuentes([null, "yahoo"])).toBe("BVC por Yahoo y fuente sin dato");
    expect(nombresDeFuentes([])).toBe("fuente sin dato");
  });
});

describe("la procedencia de un dato", () => {
  it("de cuándo es, cuándo lo trajo 008 en hora de Colombia y la fuente", () => {
    expect(textoProcedencia(p(), { etiqueta: "Cierre" })).toBe("Cierre del 17-mar-2027 · traído el 17-mar-2027 a las 18:04 (hora de Colombia) · BVC por Yahoo");
    expect(textoProcedencia(p({ fuente: "sfc:qhpu-8ixx" }), { etiqueta: "Valor de unidad" })).toBe(
      "Valor de unidad del 17-mar-2027 · traído el 17-mar-2027 a las 18:04 (hora de Colombia) · SFC",
    );
    expect(textoProcedencia(p())).toBe("Dato del 17-mar-2027 · traído el 17-mar-2027 a las 18:04 (hora de Colombia) · BVC por Yahoo");
  });

  it("sin la fecha del dato, cuando la celda ya la dice", () => {
    expect(textoProcedencia(p({ dia: "2027-03-16", traidoEn: "2027-03-17 08:13" }), { sinFecha: true })).toBe(
      "traído el 17-mar-2027 a las 08:13 (hora de Colombia) · BVC por Yahoo",
    );
  });

  it("sin la hora en que se trajo (o mal escrita), lo dice; nunca inventa una", () => {
    for (const traidoEn of [null, "", "2027-03-17", "2027-03-17T18:04", "2027-13-17 18:04", "2027-03-17 24:00", "2027-03-17 18:60", "2027-03-32 18:04"]) {
      expect(textoProcedencia(p({ traidoEn }), { etiqueta: "Cierre" }), String(traidoEn)).toBe("Cierre del 17-mar-2027 · sin la hora en que se trajo · BVC por Yahoo");
    }
  });

  it("las piezas llevan el atributo de <time>: el día del dato y la hora de Colombia con su desfase", () => {
    const conHora = piezasProcedencia(p(), { etiqueta: "Cierre" }).filter((x) => x.dateTime !== undefined);
    expect(conHora).toEqual([
      { texto: "17-mar-2027", dateTime: "2027-03-17" },
      { texto: "17-mar-2027 a las 18:04", dateTime: "2027-03-17T18:04-05:00" },
    ]);
    expect(piezasProcedencia(p({ dia: "malo" })).filter((x) => x.dateTime !== undefined)).toEqual([{ texto: "17-mar-2027 a las 18:04", dateTime: "2027-03-17T18:04-05:00" }]);
  });
});

describe("un valor que suma varios datos", () => {
  it("con fechas distintas: el cierre más antiguo, cuándo se trajo y las fuentes, y el aviso con las dos puntas", () => {
    const c = compuesta({ fuentes: ["yahoo", "e2e-ficticio"] });
    expect(textoCompuesta(c)).toBe("Con el cierre más antiguo del 1-mar-2021 · traído el 2-mar-2021 a las 18:40 (hora de Colombia) · e2e-ficticio y BVC por Yahoo");
    expect(avisoMezcladas(c)).toBe("Cierres de fechas distintas: del 1-mar-2021 al 17-mar-2021.");
  });

  it("todos del mismo día: el cierre de ese día y sin aviso", () => {
    const c = compuesta({ masVieja: p(), masReciente: "2027-03-17", mezcladas: false });
    expect(textoCompuesta(c)).toBe("Cierre del 17-mar-2027 · traído el 17-mar-2027 a las 18:04 (hora de Colombia) · BVC por Yahoo");
    expect(avisoMezcladas(c)).toBeNull();
  });

  it("las piezas de la compuesta llevan el <time> del cierre más antiguo", () => {
    expect(piezasCompuesta(compuesta()).filter((x) => x.dateTime !== undefined).map((x) => x.dateTime)).toEqual(["2021-03-01", "2021-03-02T18:40-05:00"]);
  });
});

describe("candado de los textos", () => {
  const todos = [
    textoProcedencia(p(), { etiqueta: "Cierre" }), textoProcedencia(p({ traidoEn: null, fuente: null })), textoProcedencia(p(), { sinFecha: true }),
    textoCompuesta(compuesta()), avisoMezcladas(compuesta()) ?? "", textoCompuesta(compuesta({ mezcladas: false })),
    ...["yahoo", "sfc:x", "banrep:x", "dane:x", null].map(nombreFuente),
  ];

  it("no recomienda comprar ni vender ni muestra comandos", () => {
    for (const t of todos) {
      expect(t, t).not.toMatch(PROHIBIDO);
      expect(t, t).not.toMatch(COMANDO);
    }
  });

  it("el candado muerde", () => {
    for (const frase of ["Compre más", "Le conviene vender", "Mantenga la especie", "Debería esperar", "recomendado"]) expect(frase).toMatch(PROHIBIDO);
    expect("Corra npx tsx scripts/importar-series.ts").toMatch(COMANDO);
  });
});
