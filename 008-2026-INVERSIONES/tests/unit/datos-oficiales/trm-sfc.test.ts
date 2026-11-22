// La TRM de la SFC (datos.gov.co, dataset 32sa-8pi3), fase C · C2b: la consulta, el lector puro de la respuesta y el
// pedido acotado. Sin red: `buscar` siempre es un doble. Cifras y fechas inventadas (trm.ficticio.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGO, serieDelCatalogo, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import {
  BYTES_MAXIMOS_TRM, FUENTE_TRM, LIMITE_FILAS_TRM, MAX_DIAS_RANGO_TRM, TIEMPO_MAXIMO_TRM_MS, URL_TRM,
  obtenerTrm, parsearTrm, trmDelCatalogo, urlConsultaTrm, type ConsultaTrm, type ResultadoTrm, type SerieTrm,
} from "@/datos-oficiales/fuentes/trm-sfc";
import type { BuscarHttp } from "@/lib/http-acotado";
import { SEMANA_FICTICIA, TIPO_JSON, VALORES_SEMANA, buscarProhibido, buscarQueResponde, dia, fila } from "./trm.ficticio";

const TRM: SerieTrm = trmDelCatalogo()!;
const SEMANA: ConsultaTrm = { desde: dia("2027-03-10"), hasta: dia("2027-03-16") };
const parsear = (cuerpo: unknown, consulta: ConsultaTrm = SEMANA): ResultadoTrm => parsearTrm(cuerpo, consulta, TRM);
const codigo = (r: ResultadoTrm): string => (r.ok ? "ok" : r.codigo);
/** Bytes de mediana de una fila de la fuente (medido: ~120 B con el $select); 130 deja margen. */
const BYTES_POR_FILA = 130;

describe("trmDelCatalogo · la serie TRM del catálogo, con su forma", () => {
  it("es la TRM del catálogo: fuente sfc:32sa-8pi3, vigencia TRAMO con su maxDias", () => {
    expect(TRM).not.toBeNull();
    expect(TRM.serie).toBe(serieDelCatalogo("TRM"));
    expect(FUENTE_TRM).toBe("sfc:32sa-8pi3");
    expect(TRM.serie.fuente).toBe(FUENTE_TRM);
    expect(TRM.maxDias).toBe(7);
  });

  it("null si el catálogo no trae la TRM, si no es un TRAMO o si su fuente es otra", () => {
    const trm = serieDelCatalogo("TRM")!;
    const sin = CATALOGO.filter((s) => s.codigo !== "TRM");
    const conForma = (vigencia: SerieCatalogo["vigencia"]): SerieCatalogo[] => [...sin, { ...trm, vigencia }];
    expect(trmDelCatalogo(sin)).toBeNull();
    expect(trmDelCatalogo(conForma({ tipo: "DIA" }))).toBeNull();
    expect(trmDelCatalogo(conForma({ tipo: "MES" }))).toBeNull();
    expect(trmDelCatalogo([...sin, { ...trm, fuente: "sfc:otro-dataset" }])).toBeNull();
  });
});

describe("constantes · el rango máximo nunca llena el límite de filas ni el tope de bytes", () => {
  it("rango + 1 < límite de filas (sin solapes, cada fila tiene al menos un día del rango) y el límite cabe en el tope", () => {
    expect(MAX_DIAS_RANGO_TRM + 1).toBeLessThan(LIMITE_FILAS_TRM);
    expect(LIMITE_FILAS_TRM * BYTES_POR_FILA).toBeLessThan(BYTES_MAXIMOS_TRM);
    expect(TIEMPO_MAXIMO_TRM_MS).toBe(30_000);
  });
});

describe("urlConsultaTrm · la consulta Socrata", () => {
  it("pide las vigencias que TOCAN el rango (hasta ≥ desde pedido y desde ≤ hasta pedido), ordenadas y con límite", () => {
    const url = new URL(urlConsultaTrm({ desde: dia("2027-03-10"), hasta: dia("2027-03-13") }));
    expect(`${url.origin}${url.pathname}`).toBe(URL_TRM);
    expect(URL_TRM).toBe("https://www.datos.gov.co/resource/32sa-8pi3.json");
    expect([...url.searchParams.keys()]).toEqual(["$select", "$where", "$order", "$limit"]);
    expect(url.searchParams.get("$select")).toBe("valor,unidad,vigenciadesde,vigenciahasta");
    expect(url.searchParams.get("$where")).toBe("vigenciahasta >= '2027-03-10T00:00:00' AND vigenciadesde <= '2027-03-13T00:00:00'");
    expect(url.searchParams.get("$order")).toBe("vigenciadesde ASC");
    expect(url.searchParams.get("$limit")).toBe(String(LIMITE_FILAS_TRM));
  });
});

describe("parsearTrm · respuesta sana", () => {
  it("una vigencia por fila, ordenada por desde, con el valor canónico (sin ceros sobrantes) y nada descartado", () => {
    const r = parsear([...SEMANA_FICTICIA].reverse());
    expect(r).toEqual({
      ok: true,
      descartadas: 0,
      valores: [
        { desde: dia("2027-03-10"), hasta: dia("2027-03-10"), valor: VALORES_SEMANA[0] },
        { desde: dia("2027-03-11"), hasta: dia("2027-03-11"), valor: VALORES_SEMANA[1] },
        { desde: dia("2027-03-12"), hasta: dia("2027-03-12"), valor: VALORES_SEMANA[2] },
        { desde: dia("2027-03-13"), hasta: dia("2027-03-15"), valor: VALORES_SEMANA[3] },
        { desde: dia("2027-03-16"), hasta: dia("2027-03-16"), valor: VALORES_SEMANA[4] },
      ],
    });
  });

  it("un arreglo vacío no es error (no hay TRM en el rango)", () => {
    expect(parsear([])).toEqual({ ok: true, valores: [], descartadas: 0 });
  });

  it("acepta la vigencia que empieza antes del rango y lo toca, y la que termina después", () => {
    const r = parsear([fila("2027-03-13", "2027-03-15", "4108.53")], { desde: dia("2027-03-15"), hasta: dia("2027-03-15") });
    expect(r).toEqual({ ok: true, descartadas: 0, valores: [{ desde: dia("2027-03-13"), hasta: dia("2027-03-15"), valor: "4108.53" }] });
    const r2 = parsear([fila("2027-03-13", "2027-03-15", "4108.53")], { desde: dia("2027-03-12"), hasta: dia("2027-03-13") });
    expect(codigo(r2)).toBe("ok");
  });

  it("las vigencias de 1 a maxDias días entran (puente de 4, Semana Santa de 5, una semana de 7)", () => {
    for (const hasta of ["2027-03-13", "2027-03-16", "2027-03-17", "2027-03-19"]) {
      expect(codigo(parsear([fila("2027-03-13", hasta, "4108.53")], { desde: dia("2027-03-13"), hasta: dia("2027-03-19") })), hasta).toBe("ok");
    }
  });

  it("dos filas idénticas (también con el valor escrito con ceros de más) se funden en una", () => {
    const r = parsear([fila("2027-03-10", "2027-03-10", "4127.39"), fila("2027-03-10", "2027-03-10", "4127.390")]);
    expect(r).toEqual({ ok: true, descartadas: 0, valores: [{ desde: dia("2027-03-10"), hasta: dia("2027-03-10"), valor: "4127.39" }] });
  });

  it("los extremos del rango de cordura entran (100 y 50000) y la escala de 2 decimales también", () => {
    const r = parsear([fila("2027-03-10", "2027-03-10", "100"), fila("2027-03-11", "2027-03-11", "50000.00"), fila("2027-03-12", "2027-03-12", "0412.07")]);
    expect(r.ok && r.valores.map((v) => v.valor)).toEqual(["100", "50000", "412.07"]);
  });
});

describe("parsearTrm · estructura rara: se rechaza toda la respuesta", () => {
  it.each<[string, unknown]>([
    ["un objeto en vez de un arreglo", {}],
    ["un error de Socrata con 200", { error: true, message: "consulta ficticia inválida" }],
    ["null", null],
    ["un texto", "4127.39"],
    ["una fila null", [null]],
    ["una fila que es un arreglo", [["4127.39"]]],
    ["una fila que es un número", [4127.39]],
    ["una clave de más", [{ ...fila("2027-03-10", "2027-03-10"), extra: "x" }]],
    ["la clave __proto__ (como la deja JSON.parse)", JSON.parse('[{"valor":"4127.39","unidad":"COP","vigenciadesde":"2027-03-10T00:00:00.000","vigenciahasta":"2027-03-10T00:00:00.000","__proto__":{"x":1}}]')],
    ["sin vigenciadesde", [{ valor: "4127.39", unidad: "COP", vigenciahasta: "2027-03-10T00:00:00.000" }]],
    ["sin vigenciahasta", [{ valor: "4127.39", unidad: "COP", vigenciadesde: "2027-03-10T00:00:00.000" }]],
    ["la fecha sin la hora", [{ ...fila("2027-03-10", "2027-03-10"), vigenciadesde: "2027-03-10" }]],
    ["la fecha con otra hora", [{ ...fila("2027-03-10", "2027-03-10"), vigenciadesde: "2027-03-10T05:00:00.000" }]],
    ["la fecha con zona", [{ ...fila("2027-03-10", "2027-03-10"), vigenciahasta: "2027-03-10T00:00:00.000Z" }]],
    ["una fecha que no existe", [fila("2027-02-29", "2027-02-29")]],
    ["la fecha como número", [{ ...fila("2027-03-10", "2027-03-10"), vigenciadesde: 1804636800000 }]],
    ["el valor como número JSON (la columna cambió de tipo)", [fila("2027-03-10", "2027-03-10", 4127.39)]],
    ["el valor como objeto", [fila("2027-03-10", "2027-03-10", { v: "4127.39" })]],
    ["una vigencia que termina antes del rango", [fila("2027-03-09", "2027-03-09")]],
    ["una vigencia que empieza después del rango", [fila("2027-03-17", "2027-03-17")]],
  ])("%s: TRM_FORMATO", (_caso, cuerpo) => {
    expect(parsear(cuerpo)).toEqual({ ok: false, codigo: "TRM_FORMATO" });
  });

  it(`${LIMITE_FILAS_TRM} filas o más: TRM_TRUNCADO (antes de mirar la estructura); una menos no lo es`, () => {
    expect(parsear(Array.from({ length: LIMITE_FILAS_TRM }, () => null))).toEqual({ ok: false, codigo: "TRM_TRUNCADO" });
    expect(codigo(parsear(Array.from({ length: LIMITE_FILAS_TRM - 1 }, () => fila("2027-03-10", "2027-03-10"))))).toBe("ok");
  });

  it.each<[string, unknown]>([["USD", "USD"], ["en minúsculas", "cop"], ["con espacios", " COP"], ["ausente", undefined], ["un número", 1]])(
    "unidad %s: TRM_UNIDAD",
    (_caso, unidad) => {
      const mala = unidad === undefined ? { valor: "4119.07", vigenciadesde: "2027-03-12T00:00:00.000", vigenciahasta: "2027-03-12T00:00:00.000" } : fila("2027-03-12", "2027-03-12", "4119.07", unidad);
      expect(parsear([...SEMANA_FICTICIA.slice(0, 2), mala])).toEqual({ ok: false, codigo: "TRM_UNIDAD" });
    },
  );

  it("la estructura se mira antes que la unidad", () => {
    expect(parsear([fila("2027-03-10", "2027-03-10", "4127.39", "USD"), null])).toEqual({ ok: false, codigo: "TRM_FORMATO" });
  });

  it("una vigencia de más de maxDias (8) o que termina antes de empezar: TRM_VIGENCIA", () => {
    const consulta = { desde: dia("2027-03-10"), hasta: dia("2027-03-20") };
    expect(parsear([fila("2027-03-13", "2027-03-20")], consulta)).toEqual({ ok: false, codigo: "TRM_VIGENCIA" });
    expect(parsear([fila("2027-03-13", "2027-03-12")], consulta)).toEqual({ ok: false, codigo: "TRM_VIGENCIA" });
  });

  it("la unidad se mira antes que la vigencia, y la vigencia antes que los solapes", () => {
    const consulta = { desde: dia("2027-03-10"), hasta: dia("2027-03-20") };
    expect(parsear([fila("2027-03-13", "2027-03-20", "4108.53", "USD")], consulta)).toEqual({ ok: false, codigo: "TRM_UNIDAD" });
    expect(parsear([fila("2027-03-13", "2027-03-20"), fila("2027-03-13", "2027-03-13")], consulta)).toEqual({ ok: false, codigo: "TRM_VIGENCIA" });
  });

  it.each<[string, unknown[]]>([
    ["el mismo desde con otro valor", [fila("2027-03-10", "2027-03-10", "4127.39"), fila("2027-03-10", "2027-03-10", "4127.4")]],
    ["el mismo desde con otro hasta", [fila("2027-03-13", "2027-03-13"), fila("2027-03-13", "2027-03-15")]],
    ["una vigencia que se cruza con la anterior", [fila("2027-03-13", "2027-03-15"), fila("2027-03-15", "2027-03-15")]],
    ["una vigencia contenida en otra (llegan en desorden)", [fila("2027-03-14", "2027-03-14"), fila("2027-03-13", "2027-03-16")]],
    ["el mismo desde, una con valor inválido", [fila("2027-03-10", "2027-03-10", "4127.39"), fila("2027-03-10", "2027-03-10", "x")]],
  ])("%s: TRM_SOLAPE", (_caso, cuerpo) => {
    expect(parsear(cuerpo)).toEqual({ ok: false, codigo: "TRM_SOLAPE" });
  });
});

describe("parsearTrm · valores inválidos: la fila se descarta y se cuenta (nunca se redondea)", () => {
  it.each<[string, unknown]>([
    ["con coma decimal", "4012,5"],
    ["vacío", ""],
    ["negativo", "-4012.5"],
    ["con exponente", "4.0125e3"],
    ["con espacio", " 4012.5"],
    ["con signo +", "+4012.5"],
    ["con tres decimales (escala 2)", "4012.345"],
    ["debajo del rango", "99.99"],
    ["encima del rango", "50000.01"],
    ["cero", "0"],
    ["con separador de miles", "4.012.50"],
    ["ausente", undefined],
  ])("%s: descartado", (_caso, valor) => {
    const mala = valor === undefined ? { unidad: "COP", vigenciadesde: "2027-03-11T00:00:00.000", vigenciahasta: "2027-03-11T00:00:00.000" } : fila("2027-03-11", "2027-03-11", valor);
    const r = parsear([SEMANA_FICTICIA[0], mala, SEMANA_FICTICIA[2]]);
    expect(r).toEqual({
      ok: true,
      descartadas: 1,
      valores: [
        { desde: dia("2027-03-10"), hasta: dia("2027-03-10"), valor: VALORES_SEMANA[0] },
        { desde: dia("2027-03-12"), hasta: dia("2027-03-12"), valor: VALORES_SEMANA[2] },
      ],
    });
  });

  it("todas descartadas: ok, sin valores y con el conteo", () => {
    expect(parsear([fila("2027-03-10", "2027-03-10", "x"), fila("2027-03-11", "2027-03-11", "y")])).toEqual({ ok: true, valores: [], descartadas: 2 });
  });
});

describe("parsearTrm · el reloj y la zona del proceso no cambian nada", () => {
  const zona = process.env.TZ;
  afterEach(() => {
    process.env.TZ = zona;
  });

  it("con TZ en UTC+14 lee las mismas fechas de negocio (medianoche UTC)", () => {
    process.env.TZ = "Pacific/Kiritimati";
    const r = parsear(SEMANA_FICTICIA);
    expect(r.ok && r.valores.map((v) => v.desde.toISOString())).toEqual([
      "2027-03-10T00:00:00.000Z", "2027-03-11T00:00:00.000Z", "2027-03-12T00:00:00.000Z", "2027-03-13T00:00:00.000Z", "2027-03-16T00:00:00.000Z",
    ]);
  });
});

describe("obtenerTrm · el pedido acotado (pedirBytesAcotado)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pide la URL de la consulta, sin seguir redirecciones, con Accept JSON, y lee la respuesta", async () => {
    const { buscar, pedidos } = buscarQueResponde(SEMANA_FICTICIA);
    const r = await obtenerTrm(SEMANA, buscar, TRM);
    expect(r.ok && r.valores.map((v) => v.valor)).toEqual([...VALORES_SEMANA]);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]!.url).toBe(urlConsultaTrm(SEMANA));
    expect(pedidos[0]!.init.redirect).toBe("error");
    expect(pedidos[0]!.init.headers).toEqual({ Accept: "application/json" });
    expect(pedidos[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("acepta application/json sin charset", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA, { headers: { "content-type": "application/json" } });
    expect(codigo(await obtenerTrm(SEMANA, buscar, TRM))).toBe("ok");
  });

  it.each<[string, ResponseInit]>([
    ["una página HTML", { headers: { "content-type": "text/html; charset=utf-8" } }],
    ["JSON en otro juego de caracteres", { headers: { "content-type": "application/json; charset=iso-8859-1" } }],
    ["texto plano (la Response por defecto)", {}],
  ])("%s: TRM_TIPO", async (_caso, init) => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA, init);
    expect(await obtenerTrm(SEMANA, buscar, TRM)).toEqual({ ok: false, codigo: "TRM_TIPO" });
  });

  it.each([429, 503])("estado %i: TRM_HTTP_<estado>", async (estado) => {
    const { buscar } = buscarQueResponde("[]", { status: estado, headers: TIPO_JSON });
    expect(await obtenerTrm(SEMANA, buscar, TRM)).toEqual({ ok: false, codigo: `TRM_HTTP_${estado}` });
  });

  it("si buscar lanza (DNS, TLS o una redirección con redirect: error): TRM_RED", async () => {
    const buscar: BuscarHttp = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await obtenerTrm(SEMANA, buscar, TRM)).toEqual({ ok: false, codigo: "TRM_RED" });
  });

  it.each<[string, string | Uint8Array]>([
    ["un cuerpo vacío", ""],
    ["algo que no es JSON", "<html>no</html>"],
    ["UTF-8 inválido", Uint8Array.of(0x5b, 0x22, 0xc3, 0x28, 0x22, 0x5d)],
  ])("%s: TRM_FORMATO", async (_caso, cuerpo) => {
    const { buscar } = buscarQueResponde(cuerpo);
    expect(await obtenerTrm(SEMANA, buscar, TRM)).toEqual({ ok: false, codigo: "TRM_FORMATO" });
  });

  it(`un cuerpo de más de ${BYTES_MAXIMOS_TRM} bytes (declarado o leído): TRM_FORMATO`, async () => {
    const declarado = buscarQueResponde("[]", { headers: { ...TIPO_JSON, "content-length": String(BYTES_MAXIMOS_TRM + 1) } });
    expect(await obtenerTrm(SEMANA, declarado.buscar, TRM)).toEqual({ ok: false, codigo: "TRM_FORMATO" });
    const leido = buscarQueResponde(`[${" ".repeat(BYTES_MAXIMOS_TRM)}]`);
    expect(await obtenerTrm(SEMANA, leido.buscar, TRM)).toEqual({ ok: false, codigo: "TRM_FORMATO" });
  });

  it("una consulta al revés (desde > hasta): TRM_RANGO_INVALIDO sin salir a la red", async () => {
    const { buscar, llamado } = buscarProhibido();
    expect(await obtenerTrm({ desde: dia("2027-03-12"), hasta: dia("2027-03-11") }, buscar, TRM)).toEqual({ ok: false, codigo: "TRM_RANGO_INVALIDO" });
    expect(llamado()).toBe(false);
  });

  it(`con un buscar que nunca responde, TRM_RED a los ${TIEMPO_MAXIMO_TRM_MS / 1000} s (no se cuelga)`, async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let listo: ResultadoTrm | undefined;
    void obtenerTrm(SEMANA, () => new Promise(() => undefined), TRM).then((r) => {
      listo = r;
    });
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_TRM_MS - 1);
    expect(listo).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(listo).toEqual({ ok: false, codigo: "TRM_RED" });
  });
});
