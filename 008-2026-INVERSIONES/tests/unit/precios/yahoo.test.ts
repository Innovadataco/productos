import { describe, expect, it } from "vitest";
import { BARRAS_MAXIMAS, PRECIO_MAXIMO_COP, obtenerCierres, parsearYahoo, type Buscar } from "@/precios/yahoo";

// 2024-03-12 14:30 UTC = 09:30 en Colombia (apertura); 2024-03-13 04:30 UTC = 23:30 del 12 en Colombia.
const T1 = Date.UTC(2024, 2, 12, 14, 30) / 1000;
const T2 = Date.UTC(2024, 2, 13, 14, 30) / 1000;
const T3 = Date.UTC(2024, 2, 14, 14, 30) / 1000;
const respuesta = (close: (number | null)[], ts = [T1, T2, T3], currency = "COP") => ({
  chart: { result: [{ meta: { currency }, timestamp: ts, indicators: { quote: [{ close }] } }], error: null },
});

describe("parsearYahoo", () => {
  it("convierte cada barra en el cierre del día de negocio en Colombia, sin ajustar", () => {
    const r = parsearYahoo(respuesta([1234.5, 1240, 1238.25]));
    expect(r.ok && r.cierres.map((c) => [c.fecha.toISOString().slice(0, 10), c.precio])).toEqual([
      ["2024-03-12", "1234.5"], ["2024-03-13", "1240"], ["2024-03-14", "1238.25"],
    ]);
  });

  it("descarta huecos (null) y valores no positivos en vez de inventar un precio", () => {
    const r = parsearYahoo(respuesta([1234.5, null, 0]));
    expect(r.ok && r.cierres.map((c) => c.precio)).toEqual(["1234.5"]);
  });

  it("una barra de las 23:30 en Colombia pertenece a ese mismo día", () => {
    const tarde = Date.UTC(2024, 2, 13, 4, 30) / 1000;
    const r = parsearYahoo(respuesta([900], [tarde]));
    expect(r.ok && r.cierres[0]!.fecha.toISOString().slice(0, 10)).toBe("2024-03-12");
  });

  it("un precio sobre el máximo razonable invalida la respuesta (YAHOO_FORMATO)", () => {
    expect(parsearYahoo(respuesta([PRECIO_MAXIMO_COP + 1], [T1]))).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
    const r = parsearYahoo(respuesta([PRECIO_MAXIMO_COP], [T1]));
    expect(r.ok && r.cierres).toHaveLength(1);
  });

  it("descarta la barra cuyo timestamp no es finito", () => {
    const r = parsearYahoo(respuesta([100, 200, 300], [Number.NaN, T2, Number.POSITIVE_INFINITY]));
    expect(r.ok && r.cierres.map((c) => c.precio)).toEqual(["200"]);
  });

  it("descarta la barra cuyo timestamp es finito pero cae fuera del rango de fechas (no inventa una fecha inválida)", () => {
    const r = parsearYahoo(respuesta([100, 200, 300], [1e13, T2, -1e13]));
    expect(r.ok && r.cierres.map((c) => [c.fecha.toISOString().slice(0, 10), c.precio])).toEqual([["2024-03-13", "200"]]);
  });

  it("acepta hasta BARRAS_MAXIMAS barras; una más invalida la respuesta (YAHOO_FORMATO)", () => {
    const serie = (n: number) => respuesta(Array.from({ length: n }, () => 100), Array.from({ length: n }, (_, i) => T1 + i * 86_400));
    const justo = parsearYahoo(serie(BARRAS_MAXIMAS));
    expect(justo.ok && justo.cierres).toHaveLength(BARRAS_MAXIMAS);
    expect(parsearYahoo(serie(BARRAS_MAXIMAS + 1))).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
  });

  it.each([
    ["timestamp no es un arreglo", { timestamp: "abc", indicators: { quote: [{ close: [1, 2, 3] }] } }],
    ["close no es un arreglo", { timestamp: [T1, T2, T3], indicators: { quote: [{ close: "abc" }] } }],
    ["timestamp es un objeto con largo", { timestamp: { length: 1 }, indicators: { quote: [{ close: [1] }] } }],
  ])("una serie con forma rara (%s) es YAHOO_FORMATO, sin lanzar", (_caso, serie) => {
    expect(parsearYahoo({ chart: { result: [{ meta: { currency: "COP" }, ...serie }] } })).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
  });

  it("redondea a 6 decimales sin notación científica", () => {
    const r = parsearYahoo(respuesta([0.1 + 0.2], [T1]));
    expect(r.ok && r.cierres[0]!.precio).toBe("0.3");
  });

  it.each([
    [{ chart: { result: null, error: { code: "Not Found" } } }, "YAHOO_SIN_DATOS"],
    [respuesta([1], [T1], "USD"), "YAHOO_MONEDA_NO_COP"],
    [respuesta([1, 2], [T1]), "YAHOO_FORMATO"],
    [null, "YAHOO_SIN_DATOS"],
  ])("rechaza respuestas raras con un código (%#)", (cuerpo, codigo) => {
    expect(parsearYahoo(cuerpo)).toEqual({ ok: false, codigo });
  });
});

describe("obtenerCierres", () => {
  const desde = new Date("2024-03-12T00:00:00Z");
  const hasta = new Date("2024-03-14T00:00:00Z");

  it("arma la URL con el símbolo y el rango, y devuelve los cierres", async () => {
    let pedida = "";
    const buscar: Buscar = async (url) => {
      pedida = url;
      return new Response(JSON.stringify(respuesta([1, 2, 3])));
    };
    const r = await obtenerCierres("FICTA.CL", desde, hasta, buscar);
    expect(r.ok && r.cierres).toHaveLength(3);
    expect(pedida).toContain("/v8/finance/chart/FICTA.CL?interval=1d&period1=");
  });

  it("los fallos de red o HTTP vuelven como código, sin lanzar", async () => {
    expect(await obtenerCierres("FICTA.CL", desde, hasta, async () => new Response("{}", { status: 429 }))).toEqual({ ok: false, codigo: "YAHOO_HTTP_429" });
    expect(await obtenerCierres("FICTA.CL", desde, hasta, async () => { throw new Error("red"); })).toEqual({ ok: false, codigo: "YAHOO_RED" });
  });

  it("rechaza símbolos raros antes de pedir nada", async () => {
    expect(await obtenerCierres("x/../y", desde, hasta, async () => { throw new Error("no debía llamarse"); })).toEqual({ ok: false, codigo: "SIMBOLO_INVALIDO" });
  });
});
