// Los pedidos a demanda de la app al servicio inv-008-ia («Identificar» y «Probar» de /edicion/ia): con token, solo dos
// rutas, uno a la vez y SIEMPRE con el destino GUARDADO en config_ia (nunca uno del pedido: sin SSRF).
import { describe, expect, it, vi } from "vitest";
import type { SondaOllama } from "@/ia/config/sonda-ollama";
import { crearAtencion, type PedidoHttp } from "@/servicio-ia/pedidos";
import { DESTINO_FICTICIO, VIGENTE_FICTICIA } from "../ia/config/apoyo/config.ficticio";

const TOKEN = "t0ken-FICTICIO_".repeat(3);
const pedido = (extra: Partial<PedidoHttp> = {}): PedidoHttp => ({ metodo: "POST", ruta: "/identificar", autorizacion: `Bearer ${TOKEN}`, cuerpo: "{}", ...extra });

function montar(config = VIGENTE_FICTICIA as typeof VIGENTE_FICTICIA | null) {
  const sonda: SondaOllama = {
    tipo: "DIRECTA",
    identificar: vi.fn(async () => ({ ok: true as const, modelos: [{ nombre: "qwen2.5:14b", tamanoBytes: 4613, digest: null }] })),
    probar: vi.fn(async () => ({ ok: true as const, latenciaMs: 1237, smoke: "OK" })),
  };
  return { sonda, atender: crearAtencion({ token: TOKEN, leerConfig: async () => config, sonda }) };
}

describe("crearAtencion", () => {
  it.each([undefined, "", "Bearer otro-token-que-no-es-el-del-servicio-4613", TOKEN, `bearer ${TOKEN}x`])("sin el token exacto (%s): 401 y no toca nada", async (autorizacion) => {
    const m = montar();
    expect(await m.atender(pedido({ autorizacion }))).toEqual({ estado: 401, cuerpo: { error: "NO_AUTORIZADO" } });
    expect(m.sonda.identificar).not.toHaveBeenCalled();
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
