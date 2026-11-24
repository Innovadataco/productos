// La sonda de la app hacia el servicio inv-008-ia (E6): la app NO sale a la tailnet; le pide a un servicio interno, en
// una dirección FIJA del código (nunca del entorno ni del pedido), con el token compartido. Nada lanza.
import { describe, expect, it, vi } from "vitest";
import { sondaDelEntorno, VARIABLE_SONDA_OLLAMA } from "@/ia/config/sonda-ollama";
import { ORIGEN_SERVICIO_IA, VARIABLE_TOKEN_SERVICIO_IA, sondaServicio, tokenServicioValido, type BuscarServicio } from "@/ia/config/sonda-servicio";
import { DESTINO_FICTICIO } from "./apoyo/config.ficticio";

const TOKEN = "t0ken-FICTICIO_".repeat(3);
const responder = (status: number, cuerpo: unknown): BuscarServicio => vi.fn(async () => ({ status, text: async () => (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) }));

describe("sondaServicio", () => {
  it("identificar: POST a la dirección fija del servicio con el token; el destino NO viaja", async () => {
    const buscar = responder(200, { ok: true, modelos: [{ nombre: "qwen2.5:14b", tamanoBytes: 4613, digest: "a".repeat(64) }] });
    const sonda = sondaServicio(buscar, TOKEN);
    expect(sonda.tipo).toBe("SERVICIO");
    expect(await sonda.identificar(DESTINO_FICTICIO)).toEqual({ ok: true, modelos: [{ nombre: "qwen2.5:14b", tamanoBytes: 4613, digest: "a".repeat(64) }] });
    const [url, init] = vi.mocked(buscar).mock.calls[0]!;
    expect(url).toBe(`${ORIGEN_SERVICIO_IA}/identificar`);
    expect(ORIGEN_SERVICIO_IA).toBe("http://inv-008-ia:8008");
    expect(init).toMatchObject({ method: "POST", body: "{}", redirect: "error", headers: { authorization: `Bearer ${TOKEN}` } });
    expect(JSON.stringify(init)).not.toContain(DESTINO_FICTICIO);
  });

  it("probar: manda solo el modelo (la temperatura y el límite son los guardados, los pone el servicio)", async () => {
    const buscar = responder(200, { ok: true, latenciaMs: 1237, smoke: "OK" });
    expect(await sondaServicio(buscar, TOKEN).probar(DESTINO_FICTICIO, "qwen2.5:14b", 37, 97_000)).toEqual({ ok: true, latenciaMs: 1237, smoke: "OK" });
    const [url, init] = vi.mocked(buscar).mock.calls[0]!;
    expect(url).toBe(`${ORIGEN_SERVICIO_IA}/probar`);
    expect(init.body).toBe('{"modelo":"qwen2.5:14b"}');
  });

  it("un fallo del Mac vuelve tal cual (con sus códigos)", async () => {
    const fallo = { ok: false, motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" };
    expect(await sondaServicio(responder(200, fallo), TOKEN).identificar(DESTINO_FICTICIO)).toEqual(fallo);
    const prueba = { ok: false, etapa: "SMOKE", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_CLIENTE", latenciaMs: 4613 };
    expect(await sondaServicio(responder(200, prueba), TOKEN).probar(DESTINO_FICTICIO, "qwen2.5:14b", 0, 10_000)).toEqual(prueba);
  });

  it.each([
    [401, "SERVICIO_IA_TOKEN"], [429, "SERVICIO_IA_OCUPADO"], [500, "SERVICIO_IA_HTTP"], [404, "SERVICIO_IA_HTTP"],
  ])("un estado %i del servicio: ERROR_PROVEEDOR %s", async (estado, detalle) => {
    expect(await sondaServicio(responder(estado, { error: "X" }), TOKEN).identificar(DESTINO_FICTICIO)).toEqual({ ok: false, motivo: "ERROR_PROVEEDOR", detalle });
  });

  it.each(["no es json", { ok: true }, { ok: true, modelos: [{ nombre: 7 }] }, { ok: false, motivo: "con espacios", detalle: "X" }, { ok: "sí" }, "x".repeat(300_000)])(
    "una respuesta con otra forma se descarta",
    async (cuerpo) => {
      expect(await sondaServicio(responder(200, cuerpo), TOKEN).identificar(DESTINO_FICTICIO)).toEqual({ ok: false, motivo: "ERROR_PROVEEDOR", detalle: "SERVICIO_IA_RESPUESTA_INVALIDA" });
      expect(await sondaServicio(responder(200, cuerpo), TOKEN).probar(DESTINO_FICTICIO, "m:1", 0, 10_000)).toMatchObject({ ok: false, etapa: "PING", detalle: "SERVICIO_IA_RESPUESTA_INVALIDA", latenciaMs: 0 });
    },
  );

  it("el servicio no contesta (caído o en espera): inalcanzable, sin excepción y sin el mensaje", async () => {
    const buscar: BuscarServicio = vi.fn(async () => { throw new TypeError("fetch failed 4613"); });
    expect(await sondaServicio(buscar, TOKEN).identificar(DESTINO_FICTICIO)).toEqual({ ok: false, motivo: "MODELO_NO_DISPONIBLE", detalle: "SERVICIO_IA_INALCANZABLE" });
    expect(await sondaServicio(buscar, TOKEN).probar(DESTINO_FICTICIO, "m:1", 0, 10_000)).toEqual({ ok: false, etapa: "PING", motivo: "MODELO_NO_DISPONIBLE", detalle: "SERVICIO_IA_INALCANZABLE", latenciaMs: 0 });
  });

  it("si el plazo vence: TIEMPO_AGOTADO", async () => {
    const buscar: BuscarServicio = (_url, init) => new Promise((_r, rechazar) => init.signal.addEventListener("abort", () => rechazar(new DOMException("x", "TimeoutError"))));
    vi.useFakeTimers();
    const espera = sondaServicio(buscar, TOKEN).identificar(DESTINO_FICTICIO);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await espera).toEqual({ ok: false, motivo: "TIEMPO_AGOTADO", detalle: "SERVICIO_IA_SIN_RESPUESTA" });
    vi.useRealTimers();
  });
});

describe("sondaDelEntorno con el servicio (aditivo)", () => {
  it("con un token válido, la sonda es la del SERVICIO (también en producción)", () => {
    expect(sondaDelEntorno({ NODE_ENV: "production", [VARIABLE_TOKEN_SERVICIO_IA]: TOKEN }).tipo).toBe("SERVICIO");
  });

  it("sin token o con uno que no tiene la forma, sigue PENDIENTE; la directa de desarrollo manda sobre el servicio", () => {
    expect(sondaDelEntorno({ NODE_ENV: "production" }).tipo).toBe("PENDIENTE");
    expect(sondaDelEntorno({ NODE_ENV: "production", [VARIABLE_TOKEN_SERVICIO_IA]: "corto" }).tipo).toBe("PENDIENTE");
    expect(sondaDelEntorno({ NODE_ENV: "development", [VARIABLE_SONDA_OLLAMA]: "directa", [VARIABLE_TOKEN_SERVICIO_IA]: TOKEN }).tipo).toBe("DIRECTA");
  });

  it("tokenServicioValido: 43 a 128 caracteres de base64url", () => {
    expect(tokenServicioValido(TOKEN)).toBe(true);
    for (const v of [undefined, "", "corto", "x".repeat(129), `${TOKEN} `]) expect(tokenServicioValido(v)).toBe(false);
  });
});
