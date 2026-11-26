// Los textos de la procedencia de cada dato (frentes fecha-hora-datos y fuente-retraso): tipo y fecha del dato, cuándo lo
// trajo 008, la fuente con su nombre claro, el retraso conocido (en el detalle) y el aviso de dato viejo; en un valor que suma varios datos, el más viejo y el aviso si hay fechas
// distintas. Puros y deterministas (los pinta el servidor y el navegador). Sin comandos y sin recomendar comprar ni
// vender: las listas de palabras son las de los candados de textos de las pantallas. Datos inventados.
import { describe, expect, it } from "vitest";
import {
  avisoAtraso, avisoMezcladas, detalleCompuesta, detalleProcedencia, nombreFuente, nombresDeFuentes, piezasCompuesta, piezasProcedencia, textoCompuesta, textoProcedencia,
} from "@/app/_comun/fecha-dato/textos";
import type { Procedencia, ProcedenciaCompuesta } from "@/app/_comun/fecha-dato/tipos";
import { prohibidasEn } from "../operar/informe/lenguaje";

const PROHIBIDO =
  /\b(compr[ae]n?|compre|vendan?|venda|vender ya|mant[ée]ngal?[ao]s?|mantenga|mantener|conserve|conservar|invierta|invertir|aproveche|aprovechar|le conviene|convendr[íi]a|deber[íi]a|recomendamos|le recomendamos|recomendado|le sugerimos|sugerimos|se[ñn]al de (compra|venta)|oportunidad de (compra|venta)|es (buen )?momento de|recomend\w*)\b/i;
const COMANDO = /\b(importar-series|importar-decretos|cargar-prod|exportar-[a-z]+|npx|npm|tsx|\.sh|prisma)\b/;

const p = (o: Partial<Procedencia> = {}): Procedencia => ({ dia: "2027-03-17", traidoEn: "2027-03-17 18:04", fuente: "yahoo", ...o });
const compuesta = (o: Partial<ProcedenciaCompuesta> = {}): ProcedenciaCompuesta => ({
  masVieja: p({ dia: "2021-03-01", traidoEn: "2021-03-02 18:40" }), masReciente: "2021-03-17", mezcladas: true, fuentes: ["yahoo"], ...o,
});

describe("nombreFuente", () => {
  it("las fuentes de 008 por su nombre claro: Yahoo (BVC), SFC, BanRep, DANE y lo escrito por el dueño", () => {
    expect(nombreFuente("yahoo")).toBe("Yahoo (BVC)");
    expect(nombreFuente("sfc:qhpu-8ixx")).toBe("SFC");
    expect(nombreFuente("banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA")).toBe("BanRep");
    expect(nombreFuente("dane:anex-IPC-Indices")).toBe("DANE");
    expect(nombreFuente("manual")).toBe("Escrito por usted");
  });

  it("una fuente que no conoce sale tal cual (no inventa un nombre); sin fuente, lo dice", () => {
    expect(nombreFuente("e2e-ficticio")).toBe("e2e-ficticio");
    expect(nombreFuente("Yahoo")).toBe("Yahoo");
    expect(nombreFuente("sfc")).toBe("sfc");
    expect(nombreFuente(null)).toBe("fuente sin dato");
    expect(nombreFuente("")).toBe("fuente sin dato");
  });

  it("varias fuentes: sin repetir el nombre, en el orden de su código", () => {
    expect(nombresDeFuentes(["yahoo"])).toBe("Yahoo (BVC)");
    expect(nombresDeFuentes(["yahoo", "sfc:qhpu-8ixx"])).toBe("SFC y Yahoo (BVC)");
    expect(nombresDeFuentes(["yahoo", "dane:x", "banrep:y", "sfc:a", "sfc:b"])).toBe("BanRep, DANE, SFC y Yahoo (BVC)");
    expect(nombresDeFuentes([null, "yahoo"])).toBe("Yahoo (BVC) y fuente sin dato");
    expect(nombresDeFuentes([])).toBe("fuente sin dato");
  });
});

describe("la línea de un dato: tipo y fecha, fuente y cuándo se trajo", () => {
  it("un cierre del mismo día en que se trajo: «Cierre 17-mar · Yahoo (BVC) · traído 18:04»", () => {
    expect(textoProcedencia(p(), { etiqueta: "Cierre" })).toBe("Cierre 17-mar · traído 18:04 · Yahoo (BVC)");
    expect(textoProcedencia(p({ fuente: "sfc:qhpu-8ixx" }), { etiqueta: "Valor de unidad" })).toBe("Valor de unidad 17-mar · traído 18:04 · SFC");
    expect(textoProcedencia(p())).toBe("Dato 17-mar · traído 18:04 · Yahoo (BVC)");
  });

  it("traído otro día: con su día; con otro año, los días con año", () => {
    expect(textoProcedencia(p({ dia: "2027-03-16", traidoEn: "2027-03-17 08:13" }), { etiqueta: "Cierre" })).toBe("Cierre 16-mar · traído 17-mar 08:13 · Yahoo (BVC)");
    expect(textoProcedencia(p({ dia: "2024-11-22", traidoEn: "2027-01-13 18:41" }), { etiqueta: "Cierre" })).toBe("Cierre 22-nov-2024 · traído 13-ene-2027 18:41 · Yahoo (BVC)");
  });

  it("sin la fecha del dato, cuando la celda ya la dice", () => {
    expect(textoProcedencia(p({ dia: "2027-03-16", traidoEn: "2027-03-17 08:13" }), { sinFecha: true })).toBe("traído 17-mar 08:13 · Yahoo (BVC)");
    expect(textoProcedencia(p(), { sinFecha: true, etiqueta: "Cierre" })).toBe("Cierre · traído 18:04 · Yahoo (BVC)");
  });

  it("un precio de la rueda dice la hora del precio, no «cierre»", () => {
    const r = p({ tipo: "RUEDA", horaDato: "11:42", traidoEn: "2027-03-17 11:44" });
    expect(textoProcedencia(r)).toBe("Precio del 17-mar a las 11:42 · traído 11:44 · Yahoo (BVC)");
    expect(textoProcedencia(r, { sinFecha: true })).toBe("Precio de las 11:42 · traído 11:44 · Yahoo (BVC)");
    expect(textoProcedencia(p({ tipo: "RUEDA" }))).toBe("Precio en rueda del 17-mar · traído 18:04 · Yahoo (BVC)");
  });

  it("sin la hora en que se trajo (o mal escrita), lo dice; nunca inventa una", () => {
    for (const traidoEn of [null, "", "2027-03-17", "2027-03-17T18:04", "2027-13-17 18:04", "2027-03-17 24:00", "2027-03-17 18:60", "2027-03-32 18:04"]) {
      expect(textoProcedencia(p({ traidoEn }), { etiqueta: "Cierre" }), String(traidoEn)).toBe("Cierre 17-mar-2027 · sin la hora en que se trajo · Yahoo (BVC)");
    }
  });

  it("las piezas llevan el atributo de <time>: el día del dato y la hora de Colombia con su desfase", () => {
    expect(piezasProcedencia(p(), { etiqueta: "Cierre" }).filter((x) => x.dateTime !== undefined)).toEqual([
      { texto: "17-mar", dateTime: "2027-03-17" },
      { texto: "18:04", dateTime: "2027-03-17T18:04-05:00" },
    ]);
    expect(piezasProcedencia(p({ dia: "malo" })).filter((x) => x.dateTime !== undefined).map((x) => x.dateTime)).toEqual(["2027-03-17T18:04-05:00"]);
    expect(piezasProcedencia(p({ tipo: "RUEDA", horaDato: "11:42", traidoEn: "2027-03-17 11:44" })).filter((x) => x.dateTime !== undefined).map((x) => x.dateTime)).toEqual([
      "2027-03-17", "2027-03-17T11:42-05:00", "2027-03-17T11:44-05:00",
    ]);
  });
});

describe("el detalle: la fuente, su retraso conocido y cuándo se trajo (hora de Colombia)", () => {
  it("Yahoo: el cierre oficial del día y hasta 20 min en la rueda", () => {
    expect(detalleProcedencia(p())).toBe(
      "Fuente: Yahoo (BVC). Retraso conocido: cierre oficial del día; en la rueda, hasta 20 min de retraso. Traído el 17-mar-2027 a las 18:04 (hora de Colombia). Precios de las acciones de la BVC (.CL) que publica Yahoo. No es tiempo real.",
    );
  });

  it("una fuente sin retraso conocido lo dice; una desconocida no lleva nota; sin hora, lo dice", () => {
    expect(detalleProcedencia(p({ fuente: "e2e-ficticio", traidoEn: null }))).toBe("Fuente: e2e-ficticio. Retraso conocido: sin dato de esta fuente. Sin la hora en que se trajo.");
    expect(detalleProcedencia(p({ fuente: null }))).toContain("Fuente: fuente sin dato.");
    expect(detalleProcedencia(p({ fuente: "sfc:x" }))).toContain("Retraso conocido: valor oficial del día, publicado por la Superintendencia Financiera.");
  });

  it("varias fuentes: el retraso de cada una", () => {
    const d = detalleCompuesta(compuesta({ fuentes: ["yahoo", "sfc:x", "e2e-ficticio"] }));
    expect(d).toContain("Fuentes: e2e-ficticio, SFC y Yahoo (BVC)");
    expect(d).toContain("Yahoo (BVC): cierre oficial del día; en la rueda, hasta 20 min de retraso");
    expect(d).toContain("e2e-ficticio: sin dato de esta fuente");
  });
});

describe("el aviso de dato viejo", () => {
  it("más de un día hábil: «dato de hace N días hábiles»; hasta uno o sin dato, nada", () => {
    expect(avisoAtraso(p({ habilesAtras: 3 }))).toBe("dato de hace 3 días hábiles");
    expect(avisoAtraso(p({ habilesAtras: 2 }))).toBe("dato de hace 2 días hábiles");
    for (const n of [1, 0, null, undefined]) expect(avisoAtraso(p({ habilesAtras: n })), String(n)).toBeNull();
  });
});

describe("un valor que suma varios datos", () => {
  it("con fechas distintas: el cierre más antiguo, cuándo se trajo y las fuentes, y el aviso con las dos puntas", () => {
    const c = compuesta({ fuentes: ["yahoo", "e2e-ficticio"] });
    expect(textoCompuesta(c)).toBe("Cierre más antiguo 1-mar · traído 2-mar 18:40 · e2e-ficticio y Yahoo (BVC)");
    expect(avisoMezcladas(c)).toBe("Cierres de fechas distintas: del 1-mar-2021 al 17-mar-2021.");
  });

  it("todos del mismo día: el cierre de ese día y sin aviso", () => {
    const c = compuesta({ masVieja: p(), masReciente: "2027-03-17", mezcladas: false });
    expect(textoCompuesta(c)).toBe("Cierre 17-mar · traído 18:04 · Yahoo (BVC)");
    expect(avisoMezcladas(c)).toBeNull();
  });

  it("las piezas de la compuesta llevan el <time> del cierre más antiguo", () => {
    expect(piezasCompuesta(compuesta()).filter((x) => x.dateTime !== undefined).map((x) => x.dateTime)).toEqual(["2021-03-01", "2021-03-02T18:40-05:00"]);
  });
});

describe("candado de los textos", () => {
  const todos = [
    textoProcedencia(p(), { etiqueta: "Cierre" }), textoProcedencia(p({ traidoEn: null, fuente: null })), textoProcedencia(p(), { sinFecha: true }),
    textoProcedencia(p({ tipo: "RUEDA", horaDato: "11:42" })), detalleProcedencia(p()), detalleCompuesta(compuesta({ fuentes: ["yahoo", "sfc:x", "banrep:x", "dane:x", "manual", null] })),
    avisoAtraso(p({ habilesAtras: 4 })) ?? "",
    textoCompuesta(compuesta()), avisoMezcladas(compuesta()) ?? "", textoCompuesta(compuesta({ mezcladas: false })),
    ...["yahoo", "sfc:x", "banrep:x", "dane:x", "manual", null].map(nombreFuente),
  ];

  it("no recomienda comprar ni vender ni muestra comandos", () => {
    for (const t of todos) {
      expect(t, t).not.toMatch(PROHIBIDO);
      expect(t, t).not.toMatch(COMANDO);
      expect(prohibidasEn(t), t).toEqual([]);
    }
  });

  it("el candado muerde", () => {
    for (const frase of ["Compre más", "Le conviene vender", "Mantenga la especie", "Debería esperar", "recomendado"]) expect(frase).toMatch(PROHIBIDO);
    expect("Corra npx tsx scripts/importar-series.ts").toMatch(COMANDO);
    expect(prohibidasEn("Le recomendamos comprar ya.").length).toBeGreaterThan(0);
  });
});
