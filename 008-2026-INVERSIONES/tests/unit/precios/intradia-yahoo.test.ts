// Barras de 1 minuto de Yahoo (`<NEMO>.CL`): el parser puro y el pedido, con un fetch falso de respuestas FIJAS e
// inventadas (sin red). Los precios y especies son ficticios.
import { describe, expect, it } from "vitest";
import { MARGEN_BARRA_ABIERTA_MS, obtenerBarrasIntradia, parsearBarrasIntradia } from "@/precios/intradia/yahoo";
import { PRECIO_MAXIMO_COP, type Buscar } from "@/precios/yahoo";

const cot = (texto: string): number => new Date(`${texto.replace(" ", "T")}:00-05:00`).getTime();
const seg = (texto: string): number => cot(texto) / 1000;
// Un martes hábil ficticio de 2027, 11:50 en Colombia: las barras de las 09:30 a las 11:29 ya cerraron.
const AHORA = new Date(cot("2027-02-09 11:50"));

interface Opciones { moneda?: string; retraso?: number | null; volumen?: (number | null)[] | null }
const respuesta = (ts: number[], close: (number | null)[], o: Opciones = {}) => ({
  chart: {
    result: [
      {
        meta: { currency: o.moneda ?? "COP", ...(o.retraso === null ? {} : { exchangeDataDelayedBy: o.retraso ?? 20 }) },
        timestamp: ts,
        indicators: { quote: [{ close, ...(o.volumen === null ? {} : { volume: o.volumen ?? ts.map(() => 100) }) }] },
      },
    ],
    error: null,
  },
});

describe("parsearBarrasIntradia", () => {
  it("convierte cada barra en su instante y su precio, sin ajustar y con el retraso que marca Yahoo", () => {
    const r = parsearBarrasIntradia(respuesta([seg("2027-02-09 09:30"), seg("2027-02-09 09:31")], [1234.5, 1240]), AHORA);
    expect(r).toEqual({
      ok: true,
      conRetraso: true,
      barras: [
        { instante: new Date(cot("2027-02-09 09:30")), precio: "1234.5" },
        { instante: new Date(cot("2027-02-09 09:31")), precio: "1240" },
      ],
    });
  });

  it("sin exchangeDataDelayedBy (o en 0) la barra NO viene marcada con retraso", () => {
    const sin = parsearBarrasIntradia(respuesta([seg("2027-02-09 09:30")], [10], { retraso: null }), AHORA);
    const cero = parsearBarrasIntradia(respuesta([seg("2027-02-09 09:30")], [10], { retraso: 0 }), AHORA);
    expect(sin.ok && sin.conRetraso).toBe(false);
    expect(cero.ok && cero.conRetraso).toBe(false);
  });

  it("descarta huecos (null), precios no positivos y barras sin negociación (volumen 0), no inventa precios", () => {
    const ts = [seg("2027-02-09 09:30"), seg("2027-02-09 09:31"), seg("2027-02-09 09:32"), seg("2027-02-09 09:33")];
    const r = parsearBarrasIntradia(respuesta(ts, [10, null, 0, 12], { volumen: [5, 5, 5, 0] }), AHORA);
    expect(r.ok && r.barras.map((b) => b.precio)).toEqual(["10"]);
  });

  it("con volumen ausente o null guarda la barra (Yahoo no siempre lo trae)", () => {
    const a = parsearBarrasIntradia(respuesta([seg("2027-02-09 09:30")], [10], { volumen: null }), AHORA);
    const b = parsearBarrasIntradia(respuesta([seg("2027-02-09 09:30")], [10], { volumen: [null] }), AHORA);
    expect(a.ok && a.barras).toHaveLength(1);
    expect(b.ok && b.barras).toHaveLength(1);
  });

  it("no guarda la barra que aún se está formando (menos de MARGEN_BARRA_ABIERTA_MS) ni una del futuro", () => {
    const limite = AHORA.getTime() - MARGEN_BARRA_ABIERTA_MS;
    const ts = [limite / 1000, limite / 1000 + 1, AHORA.getTime() / 1000 + 600];
    const r = parsearBarrasIntradia(respuesta(ts, [10, 11, 12]), AHORA);
    expect(r.ok && r.barras.map((b) => b.precio)).toEqual(["10"]);
  });

  it("solo las barras del día de hoy en Colombia: una de ayer (Yahoo devuelve la última rueda antes de abrir) no entra", () => {
    const ts = [seg("2027-02-08 15:59"), seg("2027-02-09 09:30")];
    const r = parsearBarrasIntradia(respuesta(ts, [10, 11]), AHORA);
    expect(r.ok && r.barras.map((b) => b.precio)).toEqual(["11"]);
  });

  it("una barra de las 23:30 de ayer en Colombia (04:30 UTC de hoy) es de ayer, no de hoy", () => {
    const ts = [Date.UTC(2027, 1, 9, 4, 30) / 1000];
    const r = parsearBarrasIntradia(respuesta(ts, [10]), AHORA);
    expect(r.ok && r.barras).toEqual([]);
  });

  it("descarta timestamps no finitos o fuera del rango de fechas", () => {
    const r = parsearBarrasIntradia(respuesta([Number.NaN, 1e13, seg("2027-02-09 09:30")], [1, 2, 3]), AHORA);
    expect(r.ok && r.barras.map((b) => b.precio)).toEqual(["3"]);
  });

  it("una hora con segundos (la última negociación, no una barra de minuto) no entra", () => {
    const t = seg("2027-02-09 09:30");
    const r = parsearBarrasIntradia(respuesta([t + 31, t + 0.5, t + 60], [1, 2, 3]), AHORA);
    expect(r.ok && r.barras.map((b) => b.precio)).toEqual(["3"]);
  });

  it("la misma barra repetida dentro de la respuesta queda una vez (gana la última con precio)", () => {
    const t = seg("2027-02-09 09:30");
    const r = parsearBarrasIntradia(respuesta([t, t], [10, 11]), AHORA);
    expect(r.ok && r.barras).toEqual([{ instante: new Date(cot("2027-02-09 09:30")), precio: "11" }]);
  });

  it("devuelve las barras en orden de instante", () => {
    const r = parsearBarrasIntradia(respuesta([seg("2027-02-09 09:32"), seg("2027-02-09 09:30")], [3, 1]), AHORA);
    expect(r.ok && r.barras.map((b) => b.precio)).toEqual(["1", "3"]);
  });

  it("un precio sobre el tope invalida la respuesta entera (YAHOO_FORMATO); el tope exacto pasa", () => {
    expect(parsearBarrasIntradia(respuesta([seg("2027-02-09 09:30")], [PRECIO_MAXIMO_COP + 1]), AHORA)).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
    const r = parsearBarrasIntradia(respuesta([seg("2027-02-09 09:30")], [PRECIO_MAXIMO_COP]), AHORA);
    expect(r.ok && r.barras).toHaveLength(1);
  });

  it("exige COP", () => {
    expect(parsearBarrasIntradia(respuesta([seg("2027-02-09 09:30")], [10], { moneda: "USD" }), AHORA)).toEqual({ ok: false, codigo: "YAHOO_MONEDA_NO_COP" });
  });

  it.each([
    ["sin resultado", { chart: { result: null, error: { code: "Not Found" } } }],
    ["sin cuerpo", null],
    ["resultado vacío", { chart: { result: [] } }],
  ])("%s es YAHOO_SIN_DATOS", (_caso, cuerpo) => {
    expect(parsearBarrasIntradia(cuerpo, AHORA)).toEqual({ ok: false, codigo: "YAHOO_SIN_DATOS" });
  });

  it.each([
    ["series de largos distintos", respuesta([seg("2027-02-09 09:30")], [1, 2])],
    ["timestamp que no es un arreglo", { chart: { result: [{ meta: { currency: "COP" }, timestamp: "x", indicators: { quote: [{ close: [1] }] } }] } }],
    ["volumen de otro largo", respuesta([seg("2027-02-09 09:30")], [1], { volumen: [1, 2] })],
    ["volumen negativo", respuesta([seg("2027-02-09 09:30")], [1], { volumen: [-1] })],
    ["más barras que el tope", respuesta(Array.from({ length: 2_001 }, (_, i) => seg("2027-02-09 09:30") + i), Array.from({ length: 2_001 }, () => 1))],
  ])("%s es YAHOO_FORMATO, sin lanzar", (_caso, cuerpo) => {
    expect(parsearBarrasIntradia(cuerpo, AHORA)).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
  });
});

describe("obtenerBarrasIntradia", () => {
  const BASE = "https://yahoo.ficticio.invalid";
  const json = (cuerpo: unknown, estado = 200): Buscar => async () => new Response(JSON.stringify(cuerpo), { status: estado });

  it("pide barras de 1 minuto de hoy a la URL configurada, con el símbolo escapado y sin seguir redirecciones", async () => {
    const vistas: Array<{ url: string; redirect: string }> = [];
    const buscar: Buscar = async (url, init) => {
      vistas.push({ url, redirect: init.redirect });
      return new Response(JSON.stringify(respuesta([seg("2027-02-09 09:30")], [10])));
    };
    const r = await obtenerBarrasIntradia("FICTA.CL", { baseUrl: BASE, buscar, ahora: AHORA });
    expect(r.ok && r.barras).toHaveLength(1);
    expect(vistas).toEqual([{ url: `${BASE}/v8/finance/chart/FICTA.CL?interval=1m&range=1d`, redirect: "error" }]);
  });

  it("acepta la URL base con barra final", async () => {
    const vistas: string[] = [];
    const buscar: Buscar = async (url) => {
      vistas.push(url);
      return new Response(JSON.stringify(respuesta([], [])));
    };
    await obtenerBarrasIntradia("FICTA.CL", { baseUrl: `${BASE}/`, buscar, ahora: AHORA });
    expect(vistas[0]).toBe(`${BASE}/v8/finance/chart/FICTA.CL?interval=1m&range=1d`);
  });

  it("un símbolo inválido no llega a la red (SIMBOLO_INVALIDO)", async () => {
    let llamadas = 0;
    const buscar: Buscar = async () => {
      llamadas += 1;
      return new Response("{}");
    };
    for (const malo of ["../x", "", "A B", "a".repeat(30), "-X"]) {
      expect(await obtenerBarrasIntradia(malo, { baseUrl: BASE, buscar, ahora: AHORA })).toEqual({ ok: false, codigo: "SIMBOLO_INVALIDO" });
    }
    expect(llamadas).toBe(0);
  });

  it("una URL base que no es https sin credenciales ni puerto no llega a la red (INTRADIA_URL_INVALIDA)", async () => {
    let llamadas = 0;
    const buscar: Buscar = async () => {
      llamadas += 1;
      return new Response("{}");
    };
    for (const mala of ["http://yahoo.ficticio.invalid", "https://u:p@yahoo.ficticio.invalid", "https://yahoo.ficticio.invalid:8443", "no es url", "https://yahoo.ficticio.invalid/v8?x=1"]) {
      expect(await obtenerBarrasIntradia("FICTA.CL", { baseUrl: mala, buscar, ahora: AHORA })).toEqual({ ok: false, codigo: "INTRADIA_URL_INVALIDA" });
    }
    expect(llamadas).toBe(0);
  });

  it("un 429 vuelve como YAHOO_HTTP_429 (la señal de espera); otros HTTP y fallos de red, con su código", async () => {
    expect(await obtenerBarrasIntradia("FICTA.CL", { baseUrl: BASE, buscar: json({}, 429), ahora: AHORA })).toEqual({ ok: false, codigo: "YAHOO_HTTP_429" });
    expect(await obtenerBarrasIntradia("FICTA.CL", { baseUrl: BASE, buscar: json({}, 503), ahora: AHORA })).toEqual({ ok: false, codigo: "YAHOO_HTTP_503" });
    const cae: Buscar = async () => {
      throw new TypeError("PRECIOS_RED");
    };
    expect(await obtenerBarrasIntradia("FICTA.CL", { baseUrl: BASE, buscar: cae, ahora: AHORA })).toEqual({ ok: false, codigo: "YAHOO_RED" });
  });

  it("un cuerpo que no es JSON es YAHOO_FORMATO", async () => {
    const buscar: Buscar = async () => new Response("<html>", { status: 200 });
    expect(await obtenerBarrasIntradia("FICTA.CL", { baseUrl: BASE, buscar, ahora: AHORA })).toEqual({ ok: false, codigo: "YAHOO_FORMATO" });
  });
});
