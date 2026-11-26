// Los pedidos a demanda de la app al servicio inv-008-ia («Identificar» y «Probar» de /edicion/ia): con token, solo dos
// rutas, uno a la vez y SIEMPRE con el destino GUARDADO en config_ia (nunca uno del pedido: sin SSRF).
import { describe, expect, it, vi } from "vitest";
import type { SondaOllama } from "@/ia/config/sonda-ollama";
import { crearAtencion, tokenAutorizado, type PedidoHttp } from "@/servicio-ia/pedidos";
import type { AnalisisDemanda, ResultadoPedido } from "@/servicio-ia/analisis";
import { DESTINO_FICTICIO, VIGENTE_FICTICIA } from "../ia/config/apoyo/config.ficticio";

const TOKEN = "t0ken-FICTICIO_".repeat(3);
const pedido = (extra: Partial<PedidoHttp> = {}): PedidoHttp => ({ metodo: "POST", ruta: "/identificar", autorizacion: `Bearer ${TOKEN}`, cuerpo: "{}", ...extra });

const ESTADO_LIBRE = Object.freeze({ enCurso: null, enEspera: null, reintentarEnS: 0, ultimo: null });

function montar(config = VIGENTE_FICTICIA as typeof VIGENTE_FICTICIA | null, resultado: ResultadoPedido = { ok: true, lugar: "EN_CURSO" }) {
  const analisis: AnalisisDemanda = { pedir: vi.fn(async () => resultado), estado: vi.fn(() => ESTADO_LIBRE) };
  const sonda: SondaOllama = {
    tipo: "DIRECTA",
    identificar: vi.fn(async () => ({ ok: true as const, modelos: [{ nombre: "qwen2.5:14b", tamanoBytes: 4613, digest: null }] })),
    probar: vi.fn(async () => ({ ok: true as const, latenciaMs: 1237, smoke: "OK" })),
  };
  return { sonda, analisis, atender: crearAtencion({ token: TOKEN, leerConfig: async () => config, sonda, analisis }) };
}

describe("crearAtencion", () => {
  it.each([undefined, "", "Bearer otro-token-que-no-es-el-del-servicio-4613", TOKEN, `bearer ${TOKEN}x`])("sin el token exacto (%s): 401 y no toca nada", async (autorizacion) => {
    const m = montar();
    expect(await m.atender(pedido({ autorizacion }))).toEqual({ estado: 401, cuerpo: { error: "NO_AUTORIZADO" } });
    expect(m.sonda.identificar).not.toHaveBeenCalled();
  });

  it("tokenAutorizado: el filtro previo del servidor, con la misma comparación", () => {
    expect(tokenAutorizado(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    for (const v of [undefined, "", TOKEN, `Bearer ${TOKEN}x`, "Bearer "]) expect(tokenAutorizado(v, TOKEN)).toBe(false);
  });

  it("otra ruta: 404; otro método: 405", async () => {
    const m = montar();
    expect((await m.atender(pedido({ ruta: "/api/generate" }))).estado).toBe(404);
    expect((await m.atender(pedido({ metodo: "GET" }))).estado).toBe(405);
  });

  it("identificar: con el destino GUARDADO, aunque el cuerpo traiga otro", async () => {
    const m = montar();
    const r = await m.atender(pedido({ cuerpo: "{}" }));
    expect(r).toEqual({ estado: 200, cuerpo: { ok: true, modelos: [{ nombre: "qwen2.5:14b", tamanoBytes: 4613, digest: null }] } });
    expect(m.sonda.identificar).toHaveBeenCalledWith(DESTINO_FICTICIO);
    expect((await m.atender(pedido({ cuerpo: JSON.stringify({ destino: "http://otro" }) }))).estado).toBe(400);
  });

  it("probar: solo un modelo de una tarea activa de la configuración, con su temperatura y su límite", async () => {
    const m = montar();
    const r = await m.atender(pedido({ ruta: "/probar", cuerpo: JSON.stringify({ modelo: "qwen2.5:14b" }) }));
    expect(r).toEqual({ estado: 200, cuerpo: { ok: true, latenciaMs: 1237, smoke: "OK" } });
    expect(m.sonda.probar).toHaveBeenCalledWith(DESTINO_FICTICIO, "qwen2.5:14b", VIGENTE_FICTICIA.temperaturaCentesimas, VIGENTE_FICTICIA.limiteSegundos * 1000);
    const otro = await m.atender(pedido({ ruta: "/probar", cuerpo: JSON.stringify({ modelo: "otro:1b" }) }));
    expect(otro).toEqual({ estado: 200, cuerpo: { ok: false, etapa: "PING", motivo: "ERROR_PROVEEDOR", detalle: "MODELO_NO_CONFIGURADO", latenciaMs: 0 } });
    expect(m.sonda.probar).toHaveBeenCalledTimes(1);
  });

  it.each(["no es json", "[]", JSON.stringify({ modelo: 7 }), JSON.stringify({ modelo: "qwen2.5:14b", destino: "x" })])("probar con un cuerpo raro (%s): 400", async (cuerpo) => {
    expect((await montar().atender(pedido({ ruta: "/probar", cuerpo }))).estado).toBe(400);
  });

  it("sin configuración o sin destino guardado: responde SIN_DESTINO sin llamar a la sonda", async () => {
    const m = montar(null);
    expect(await m.atender(pedido())).toEqual({ estado: 200, cuerpo: { ok: false, motivo: "ERROR_PROVEEDOR", detalle: "SIN_DESTINO" } });
    expect(m.sonda.identificar).not.toHaveBeenCalled();
  });

  it("uno a la vez: el segundo, mientras el primero corre, recibe 429", async () => {
    const m = montar();
    let soltar: () => void = () => undefined;
    vi.mocked(m.sonda.identificar).mockImplementationOnce(() => new Promise((r) => { soltar = () => r({ ok: true, modelos: [] }); }));
    const primero = m.atender(pedido());
    await Promise.resolve();
    await Promise.resolve();
    expect((await m.atender(pedido())).estado).toBe(429);
    soltar();
    expect((await primero).estado).toBe(200);
    expect((await m.atender(pedido())).estado).toBe(200);
  });

  it("una excepción no sale: 500 con un código, sin el mensaje", async () => {
    const m = montar();
    vi.mocked(m.sonda.identificar).mockRejectedValueOnce(new Error("detalle interno 4613"));
    expect(await m.atender(pedido())).toEqual({ estado: 500, cuerpo: { error: "ERROR_INTERNO" } });
  });
});

describe("POST /analizar y POST /estado-analisis (el botón «Analizar con IA»)", () => {
  const analizar = (cuerpo: unknown, extra: Partial<PedidoHttp> = {}) => pedido({ ruta: "/analizar", cuerpo: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), ...extra });

  it("sin el token: 401 antes de mirar nada, también en las rutas nuevas", async () => {
    const m = montar();
    for (const ruta of ["/analizar", "/estado-analisis"]) {
      expect(await m.atender(pedido({ ruta, autorizacion: undefined, cuerpo: JSON.stringify({ tarea: "DIARIO" }) }))).toEqual({ estado: 401, cuerpo: { error: "NO_AUTORIZADO" } });
    }
    expect(m.analisis.pedir).not.toHaveBeenCalled();
    expect(m.analisis.estado).not.toHaveBeenCalled();
  });

  it("solo POST: GET es 405", async () => {
    const m = montar();
    expect((await m.atender(analizar({ tarea: "DIARIO" }, { metodo: "GET" }))).estado).toBe(405);
    expect(m.analisis.pedir).not.toHaveBeenCalled();
  });

  it("aceptado: 202 con el lugar (en curso o en espera)", async () => {
    const m = montar();
    expect(await m.atender(analizar({ tarea: "REGLAS" }))).toEqual({ estado: 202, cuerpo: { estado: "ACEPTADO", lugar: "EN_CURSO" } });
    expect(m.analisis.pedir).toHaveBeenCalledWith("REGLAS");
    const espera = montar(VIGENTE_FICTICIA, { ok: true, lugar: "EN_ESPERA" });
    expect(await espera.atender(analizar({ tarea: "DIARIO" }))).toEqual({ estado: 202, cuerpo: { estado: "ACEPTADO", lugar: "EN_ESPERA" } });
  });

  it.each([
    [{ ok: false, motivo: "APAGADO" } as ResultadoPedido, 403, { error: "ANALISIS_APAGADO" }],
    [{ ok: false, motivo: "TAREA_INACTIVA" } as ResultadoPedido, 409, { error: "TAREA_INACTIVA" }],
    [{ ok: false, motivo: "OCUPADO" } as ResultadoPedido, 429, { error: "OCUPADO" }],
    [{ ok: false, motivo: "ESPERA_MINIMA", reintentarEnS: 75 } as ResultadoPedido, 429, { error: "ESPERA_MINIMA", reintentarEnS: 75 }],
  ])("lo que el análisis descarta (%j) sale con su estado y su código", async (resultado, estado, cuerpo) => {
    expect(await montar(VIGENTE_FICTICIA, resultado).atender(analizar({ tarea: "DIARIO" }))).toEqual({ estado, cuerpo });
  });

  it.each(["no es json", "[]", "{}", JSON.stringify({ tarea: "OTRA" }), JSON.stringify({ tarea: 7 }), JSON.stringify({ tarea: "DIARIO", modelo: "otro:1b" }), JSON.stringify({ tarea: "diario" })])(
    "validación estricta de la tarea: un cuerpo raro (%s) es 400 y no llama al análisis", async (cuerpo) => {
      const m = montar();
      expect(await m.atender(analizar(cuerpo))).toEqual({ estado: 400, cuerpo: { error: "CUERPO_INVALIDO" } });
      expect(m.analisis.pedir).not.toHaveBeenCalled();
    });

  it("no se frena con el «uno a la vez» de identificar y probar: responde enseguida aunque uno de esos esté en curso", async () => {
    const m = montar();
    vi.mocked(m.sonda.identificar).mockImplementationOnce(() => new Promise(() => undefined));
    void m.atender(pedido());
    await Promise.resolve();
    expect((await m.atender(analizar({ tarea: "DIARIO" }))).estado).toBe(202);
  });

  it("el estado: el del análisis, con cuerpo vacío exacto", async () => {
    const m = montar();
    expect(await m.atender(pedido({ ruta: "/estado-analisis", cuerpo: "{}" }))).toEqual({ estado: 200, cuerpo: ESTADO_LIBRE });
    expect((await m.atender(pedido({ ruta: "/estado-analisis", cuerpo: JSON.stringify({ x: 1 }) }))).estado).toBe(400);
  });

  it("una excepción del análisis (la base) no sale: 500 con un código, sin el mensaje", async () => {
    const m = montar();
    vi.mocked(m.analisis.pedir).mockRejectedValueOnce(new Error("valor-real-4613"));
    const r = await m.atender(analizar({ tarea: "DIARIO" }));
    expect(r).toEqual({ estado: 500, cuerpo: { error: "ERROR_INTERNO" } });
  });
});
