import { afterEach, describe, expect, it, vi } from "vitest";
import { BARRAS_MAXIMAS, BYTES_MAXIMOS_YAHOO, PRECIO_MAXIMO_COP, obtenerCierres, parsearYahoo, type Buscar, type ResultadoYahoo } from "@/precios/yahoo";

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

  // SPEC-13 «nunca un precio viejo como de hoy»: el volumen dice si hubo negociación ese día.
  const conVolumen = (close: (number | null)[], volume: unknown, ts = [T1, T2, T3]) => ({
    chart: { result: [{ meta: { currency: "COP" }, timestamp: ts, indicators: { quote: [{ close, volume }] } }], error: null },
  });

  it("lee el volumen de cada barra (0 es «sin negociación»; null queda null)", () => {
    const r = parsearYahoo(conVolumen([100, 100, 101], [1500, 0, null]));
    expect(r.ok && r.cierres.map((c) => [c.fecha.toISOString().slice(0, 10), c.precio, c.volumen])).toEqual([
      ["2024-03-12", "100", 1500], ["2024-03-13", "100", 0], ["2024-03-14", "101", null],
    ]);
  });

  it("sin serie de volumen, cada barra queda con volumen null (se mantiene lo de hoy)", () => {
    const r = parsearYahoo(respuesta([100, 101, 102]));
    expect(r.ok && r.cierres.map((c) => c.volumen)).toEqual([null, null, null]);
  });

  it("con dos barras el mismo día, el volumen es el de la barra que gana el precio (la última con precio)", () => {
    const mismoDia = [T1, T1 + 3600];
    const ultima = parsearYahoo(conVolumen([100, 101], [0, 50], mismoDia));
    expect(ultima.ok && ultima.cierres.map((c) => [c.precio, c.volumen])).toEqual([["101", 50]]);
    const sinPrecio = parsearYahoo(conVolumen([100, null], [0, 50], mismoDia));
    expect(sinPrecio.ok && sinPrecio.cierres.map((c) => [c.precio, c.volumen])).toEqual([["100", 0]]);
  });

  it.each([
    ["no es un arreglo", "abc"],
    ["es un objeto con largo", { length: 3 }],
    ["tiene otro largo que timestamp", [1, 2]],
  ])("una serie de volumen que %s invalida la respuesta (YAHOO_FORMATO)", (_caso, volume) => {
    expect(parsearYahoo(conVolumen([100, 101, 102], volume))).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
  });

  it.each([
    ["negativo", -1],
    ["no finito", Number.POSITIVE_INFINITY],
    ["texto", "0"],
  ])("un volumen %s invalida la respuesta (YAHOO_FORMATO): no se adivina si hubo negociación", (_caso, valor) => {
    expect(parsearYahoo(conVolumen([100, 101, 102], [10, valor, 10]))).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
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

  it.each(["x/../y", "..", ".", ".CL", "-FICT1.CL", "", "A".repeat(21)])("rechaza el símbolo raro «%s» antes de pedir nada", async (simbolo) => {
    expect(await obtenerCierres(simbolo, desde, hasta, async () => { throw new Error("no debía llamarse"); })).toEqual({ ok: false, codigo: "SIMBOLO_INVALIDO" });
  });

  it.each(["FICT1.CL", "^FICTX", "FICT-1.CL", "A".repeat(20)])("acepta el símbolo «%s»", async (simbolo) => {
    let pedida = "";
    await obtenerCierres(simbolo, desde, hasta, async (url) => {
      pedida = url;
      return new Response("{}", { status: 503 });
    });
    expect(new URL(pedida).pathname).toBe(`/v8/finance/chart/${encodeURIComponent(simbolo)}`);
  });

  it("pide sin seguir redirecciones, con el User-Agent y una señal de aborto", async () => {
    let init: Parameters<Buscar>[1] | undefined;
    await obtenerCierres("FICTA.CL", desde, hasta, async (_url, i) => {
      init = i;
      return new Response(JSON.stringify(respuesta([1, 2, 3])));
    });
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toEqual({ "User-Agent": "Mozilla/5.0" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("un cuerpo que declara o que trae más del tope de bytes es YAHOO_FORMATO (no se lee entero)", async () => {
    const declarado: Buscar = async () => new Response(JSON.stringify(respuesta([1, 2, 3])), { headers: { "content-length": String(BYTES_MAXIMOS_YAHOO + 1) } });
    expect(await obtenerCierres("FICTA.CL", desde, hasta, declarado)).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
    const relleno: Buscar = async () => new Response(JSON.stringify(respuesta([1, 2, 3])) + " ".repeat(BYTES_MAXIMOS_YAHOO));
    expect(await obtenerCierres("FICTA.CL", desde, hasta, relleno)).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
  });

  it("un cuerpo que no es JSON es YAHOO_FORMATO, no un fallo de red", async () => {
    expect(await obtenerCierres("FICTA.CL", desde, hasta, async () => new Response("<html>no es json</html>"))).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
  });
});

describe("obtenerCierres · plazo de 10 s (reloj falso)", () => {
  const desde = new Date("2024-03-12T00:00:00Z");
  const hasta = new Date("2024-03-14T00:00:00Z");
  afterEach(() => {
    vi.useRealTimers();
  });
  function vigilar(p: Promise<ResultadoYahoo>): { listo: boolean; valor?: ResultadoYahoo } {
    const v: { listo: boolean; valor?: ResultadoYahoo } = { listo: false };
    void p.then((x) => {
      v.listo = true;
      v.valor = x;
    });
    return v;
  }

  it("con un buscar que respeta la señal: se aborta a los 10 s y da YAHOO_RED", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let senal: AbortSignal | undefined;
    const buscar: Buscar = (_url, init) =>
      new Promise((_resolver, rechazar) => {
        senal = init.signal;
        init.signal.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError")));
      });
    const v = vigilar(obtenerCierres("FICTA.CL", desde, hasta, buscar));
    await vi.advanceTimersByTimeAsync(9_999);
    expect([v.listo, senal?.aborted]).toEqual([false, false]);
    await vi.advanceTimersByTimeAsync(1);
    expect(senal?.aborted).toBe(true);
    expect(v).toEqual({ listo: true, valor: { ok: false, codigo: "YAHOO_RED" } });
  });

  it("con un buscar que nunca resuelve ni mira la señal: da YAHOO_RED a los 10 s (no se cuelga)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const v = vigilar(obtenerCierres("FICTA.CL", desde, hasta, () => new Promise(() => undefined)));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(v.listo).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(v).toEqual({ listo: true, valor: { ok: false, codigo: "YAHOO_RED" } });
  });
});
