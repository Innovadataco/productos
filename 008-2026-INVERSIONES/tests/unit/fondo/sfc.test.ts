// Valor de unidad del FIC desde la SFC (datos.gov.co, qhpu-8ixx). Sin red: el `buscar` es falso.
// Todos los datos son inventados: código de negocio 999xxx, clases 90x y cifras redondas.
import { describe, expect, it } from "vitest";
import {
  BYTES_MAXIMOS,
  isoDia,
  LIMITE_FILAS,
  leerFechaCorte,
  leerValorFondo,
  leerValorUnidad,
  obtenerValores,
  parsearSfc,
  type BuscarSfc,
  type ConsultaSfc,
} from "@/fondo/sfc";

const CODIGO = "999001";
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const consulta = (participacion: string | null = null): ConsultaSfc => ({ codigo: CODIGO, participacion, desde: dia("2024-03-10"), hasta: dia("2024-03-12") });
const fila = (fecha: string, valor: unknown, extra: Record<string, unknown> = {}) => ({
  fecha_corte: `${fecha}T00:00:00.000`,
  codigo_negocio: CODIGO,
  tipo_participacion: "901",
  valor_unidad_operaciones: valor,
  valor_fondo_cierre_dia_t: "500000000",
  ...extra,
});
const enTexto = (r: ReturnType<typeof parsearSfc>) =>
  r.ok ? r.valores.map((v) => [v.fecha.toISOString().slice(0, 10), v.valorUnidad, v.valorFondo]) : r.codigo;

describe("leerFechaCorte", () => {
  it("la fecha flotante de Socrata es la fecha de negocio, a medianoche UTC (sin depender de la zona del proceso)", () => {
    expect(leerFechaCorte("2024-03-12T00:00:00.000")?.toISOString()).toBe("2024-03-12T00:00:00.000Z");
    expect(leerFechaCorte("2024-03-12T00:00:00")?.toISOString()).toBe("2024-03-12T00:00:00.000Z");
  });

  it.each([["2024-03-12T00:00:00.000Z"], ["2024-03-12T05:00:00.000"], ["2024-02-30T00:00:00.000"], ["2024-03-12"], [""], [20240312], [null], [undefined]])(
    "rechaza lo que no es una fecha de corte exacta (%s)",
    (v) => {
      expect(leerFechaCorte(v)).toBeNull();
    },
  );
});

describe("leerValorUnidad", () => {
  it.each([
    ["10000.5", "10000.5"],
    ["0010000.50", "10000.5"],
    [10000.5, "10000.5"],
    ["1.123456789", "1.12345679"],
    ["1.000000005", "1.00000001"],
    ["10000000", "10000000"],
  ])("lee %s como decimal canónico de 8 decimales → %s", (v, esperado) => {
    expect(leerValorUnidad(v)).toBe(esperado);
  });

  it.each([["0"], ["-1"], ["1e3"], ["1,5"], [".5"], ["abc"], [""], [null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY], [-3], ["10000000.01"], ["0.000000001"], ["1".repeat(31)], [`1.${"0".repeat(31)}`]])(
    "rechaza ceros, negativos, exponentes, comas, basura y valores sobre el tope (%s)",
    (v) => {
      expect(leerValorUnidad(v)).toBeNull();
    },
  );
});

describe("leerValorFondo", () => {
  it("redondea a 4 decimales el ruido de punto flotante de la SFC", () => {
    expect(leerValorFondo("500000000.339996")).toBe("500000000.34");
    expect(leerValorFondo("500000000.12345")).toBe("500000000.1235");
  });

  it.each([["0"], ["-5"], ["1e20"], ["x"], [undefined], [null], ["10000000000000001"], [`5.${"0".repeat(31)}`]])("es informativo: si no sirve queda en null (%s)", (v) => {
    expect(leerValorFondo(v)).toBeNull();
  });
});

describe("parsearSfc", () => {
  it("devuelve los valores ordenados por fecha, aunque lleguen en desorden", () => {
    const r = parsearSfc([fila("2024-03-12", "10002"), fila("2024-03-10", "10000"), fila("2024-03-11", "10001.25")], consulta());
    expect(enTexto(r)).toEqual([
      ["2024-03-10", "10000", "500000000"],
      ["2024-03-11", "10001.25", "500000000"],
      ["2024-03-12", "10002", "500000000"],
    ]);
    expect(r.ok && r.descartados).toBe(0);
  });

  it("funde filas idénticas del mismo día", () => {
    expect(enTexto(parsearSfc([fila("2024-03-10", "10000"), fila("2024-03-10", "10000.0")], consulta()))).toEqual([["2024-03-10", "10000", "500000000"]]);
  });

  it("sin filas en el rango no es error: es el retraso normal de 1 a 2 días hábiles", () => {
    expect(parsearSfc([], consulta())).toEqual({ ok: true, valores: [], descartados: 0 });
  });

  it.each([
    ["no es un arreglo", { error: true }],
    ["una fila no es un objeto", [null]],
    ["el código de negocio no es el pedido", [fila("2024-03-10", "10000", { codigo_negocio: "999002" })]],
    ["la fecha no es válida", [fila("2024-03-10", "10000", { fecha_corte: "10/03/2024" })]],
    ["la fecha está fuera del rango pedido", [fila("2024-03-13", "10000")]],
  ])("rechaza toda la respuesta si su estructura no cuadra: %s", (_caso, cuerpo) => {
    expect(parsearSfc(cuerpo, consulta())).toEqual({ ok: false, codigo: "SFC_FORMATO" });
  });

  it("con el tope de filas o más, la respuesta puede venir truncada y se rechaza", () => {
    expect(parsearSfc(Array.from({ length: LIMITE_FILAS }, () => fila("2024-03-10", "10000")), consulta())).toEqual({ ok: false, codigo: "SFC_TRUNCADO" });
  });

  it("filtra por la clase ANTES de validar: la basura de otra clase no bloquea la propia", () => {
    const r = parsearSfc([fila("2024-03-10", "x", { tipo_participacion: "901" }), fila("2024-03-10", "20000", { tipo_participacion: "902" })], consulta("902"));
    expect(enTexto(r)).toEqual([["2024-03-10", "20000", "500000000"]]);
    expect(r.ok && r.descartados).toBe(0);
  });

  it("sin clase registrada y con varias clases, no adivina", () => {
    const cuerpo = [fila("2024-03-10", "10000", { tipo_participacion: "901" }), fila("2024-03-10", "20000", { tipo_participacion: "902" })];
    expect(parsearSfc(cuerpo, consulta())).toEqual({ ok: false, codigo: "SFC_VARIAS_PARTICIPACIONES" });
  });

  it("dos valores distintos para la misma clase y el mismo día son ambiguos", () => {
    expect(parsearSfc([fila("2024-03-10", "10000"), fila("2024-03-10", "10001")], consulta("901"))).toEqual({ ok: false, codigo: "SFC_AMBIGUO" });
  });

  it("un valor inválido de su clase se descarta y se cuenta; los demás días siguen", () => {
    const r = parsearSfc([fila("2024-03-10", "10000"), fila("2024-03-11", "0"), fila("2024-03-12", "10002")], consulta());
    expect(enTexto(r)).toEqual([
      ["2024-03-10", "10000", "500000000"],
      ["2024-03-12", "10002", "500000000"],
    ]);
    expect(r.ok && r.descartados).toBe(1);
  });

  it("un valor del fondo inválido queda en null sin descartar el valor de unidad", () => {
    expect(enTexto(parsearSfc([fila("2024-03-10", "10000", { valor_fondo_cierre_dia_t: "-1" })], consulta()))).toEqual([["2024-03-10", "10000", null]]);
  });
});

describe("isoDia", () => {
  it("da la fecha de negocio en AAAA-MM-DD", () => {
    expect(isoDia(dia("2024-03-12"))).toBe("2024-03-12");
  });
});

describe("obtenerValores", () => {
  const ok = (cuerpo: unknown): BuscarSfc => async () => new Response(JSON.stringify(cuerpo));
  const flujo = (partes: readonly Uint8Array[], fallaAlFinal = false) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const p of partes) c.enqueue(p);
        if (fallaAlFinal) c.error(new TypeError("corte"));
        else c.close();
      },
    });

  it("arma la consulta Socrata con el código, la clase, el rango, el orden y el tope, sin seguir redirecciones", async () => {
    let pedida = "";
    let init: Parameters<BuscarSfc>[1] | undefined;
    const buscar: BuscarSfc = async (url, i) => {
      pedida = url;
      init = i;
      return new Response(JSON.stringify([fila("2024-03-10", "10000")]));
    };
    const r = await obtenerValores(consulta("901"), buscar);
    expect(r.ok && r.valores).toHaveLength(1);
    const url = new URL(pedida);
    expect(`${url.origin}${url.pathname}`).toBe("https://www.datos.gov.co/resource/qhpu-8ixx.json");
    expect(url.searchParams.get("codigo_negocio")).toBe(CODIGO);
    expect(url.searchParams.get("tipo_participacion")).toBe("901");
    expect(url.searchParams.get("$where")).toBe("fecha_corte >= '2024-03-10T00:00:00' AND fecha_corte <= '2024-03-12T00:00:00'");
    expect(url.searchParams.get("$order")).toBe("fecha_corte ASC");
    expect(url.searchParams.get("$limit")).toBe(String(LIMITE_FILAS));
    expect(url.searchParams.get("$select")?.split(",").sort()).toEqual(
      ["codigo_negocio", "fecha_corte", "tipo_participacion", "valor_fondo_cierre_dia_t", "valor_unidad_operaciones"],
    );
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("sin clase no filtra por tipo_participacion", async () => {
    let pedida = "";
    await obtenerValores(consulta(), async (url) => {
      pedida = url;
      return new Response("[]");
    });
    expect(new URL(pedida).searchParams.has("tipo_participacion")).toBe(false);
  });

  it("los fallos de HTTP, de red o de JSON vuelven como código, sin lanzar", async () => {
    expect(await obtenerValores(consulta(), async () => new Response("{}", { status: 429 }))).toEqual({ ok: false, codigo: "SFC_HTTP_429" });
    expect(await obtenerValores(consulta(), async () => { throw new Error("red"); })).toEqual({ ok: false, codigo: "SFC_RED" });
    expect(await obtenerValores(consulta(), async () => new Response("no es json"))).toEqual({ ok: false, codigo: "SFC_FORMATO" });
    expect(await obtenerValores(consulta(), ok({ error: true }))).toEqual({ ok: false, codigo: "SFC_FORMATO" });
  });

  it("un cuerpo que declara más del tope de bytes se rechaza por su content-length", async () => {
    const buscar: BuscarSfc = async () => new Response("[]", { headers: { "content-length": String(BYTES_MAXIMOS + 1) } });
    expect(await obtenerValores(consulta(), buscar)).toEqual({ ok: false, codigo: "SFC_FORMATO" });
  });

  it("un cuerpo JSON válido que pasa el tope sin declararlo se corta y se rechaza", async () => {
    const enc = new TextEncoder();
    const relleno = new Uint8Array(BYTES_MAXIMOS).fill(0x20);
    expect(await obtenerValores(consulta(), async () => new Response(flujo([enc.encode("["), relleno, enc.encode("]")])))).toEqual({ ok: false, codigo: "SFC_FORMATO" });
  });

  it("un cuerpo justo en el tope se acepta", async () => {
    const json = new TextEncoder().encode("[]");
    const relleno = new Uint8Array(BYTES_MAXIMOS - json.byteLength).fill(0x20);
    expect(await obtenerValores(consulta(), async () => new Response(flujo([relleno, json])))).toEqual({ ok: true, valores: [], descartados: 0 });
  });

  it("sin cuerpo o con UTF-8 inválido es SFC_FORMATO; un corte a mitad del cuerpo es SFC_RED", async () => {
    expect(await obtenerValores(consulta(), async () => new Response(null))).toEqual({ ok: false, codigo: "SFC_FORMATO" });
    expect(await obtenerValores(consulta(), async () => new Response(flujo([new Uint8Array([0x5b, 0xff, 0x5d])])))).toEqual({ ok: false, codigo: "SFC_FORMATO" });
    expect(await obtenerValores(consulta(), async () => new Response(flujo([new TextEncoder().encode("[")], true)))).toEqual({ ok: false, codigo: "SFC_RED" });
  });

  it.each([
    [{ ...consulta(), codigo: "99-01" }, "CODIGO_FIC_INVALIDO"],
    [{ ...consulta(), codigo: "1".repeat(13) }, "CODIGO_FIC_INVALIDO"],
    [{ ...consulta(), codigo: "999001' OR 1=1" }, "CODIGO_FIC_INVALIDO"],
    [consulta("9a"), "PARTICIPACION_INVALIDA"],
    [{ ...consulta(), desde: dia("2024-03-13") }, "RANGO_INVALIDO"],
  ])("rechaza consultas raras antes de pedir nada (%#)", async (c, codigo) => {
    expect(await obtenerValores(c, async () => { throw new Error("no debía llamarse"); })).toEqual({ ok: false, codigo });
  });
});
