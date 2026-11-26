// POST /api/ia/analizar (pedir el análisis de UNA tarea) y GET (el estado), solo del dueño, con la sesión, la base y el
// servicio simulados. Lo que se prueba:
//  - Origin (CSRF) antes que la sesión; la familia (403) y sin sesión (401) reciben la respuesta del guardián y no se
//    lee la base ni se llama al servicio;
//  - validación estricta: el cuerpo es exactamente {"tarea": DIARIO | REGLAS | ESCENARIOS}; nada más;
//  - el interruptor de config_ia (apagado por omisión) frena ANTES de llamar al servicio (falla cerrada);
//  - un pedido cada pocos segundos por usuario; el servicio decide el resto (1 en curso y 1 en espera, 2 minutos);
//  - errores genéricos y sin caché, sin el mensaje de ningún error.
// Datos inventados.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ORIGENES_DESARROLLO } from "@/auth/origen";
import type { ClienteAnalisis } from "@/ia/config/analisis-servicio";
import { VIGENTE_FICTICIA } from "../../ia/config/apoyo/config.ficticio";

const exigirDuenoApi = vi.hoisted(() => vi.fn());
const leerConfigIa = vi.hoisted(() => vi.fn());
const clienteAnalisisDelEntorno = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirDuenoApi }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/ia/config/leer", async (original) => ({ ...(await original<typeof import("@/ia/config/leer")>()), leerConfigIa }));
vi.mock("@/ia/config/analisis-servicio", async (original) => ({ ...(await original<typeof import("@/ia/config/analisis-servicio")>()), clienteAnalisisDelEntorno }));

import { GET, POST } from "@/app/api/ia/analizar/route";
import { reiniciarFrecuenciasIa } from "@/ia/config/frecuencia";

const ORIGEN = ORIGENES_DESARROLLO[0]!;
const DUENO = { ok: true, usuario: { id: "u-dueno-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" } };
const ENCENDIDA = { ...VIGENTE_FICTICIA, analisisDemanda: true };
const ESTADO = { enCurso: "DIARIO", enEspera: null, reintentarEnS: 0, ultimo: null };

const pedir = (cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request(`${ORIGEN}/api/ia/analizar`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGEN, ...cabeceras }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });
const leerEstado = () => new Request(`${ORIGEN}/api/ia/analizar`, { method: "GET" });

function servicio(resultado: Awaited<ReturnType<ClienteAnalisis["pedir"]>> = { ok: true, lugar: "EN_CURSO" }): { readonly pedir: Mock; readonly estado: Mock } {
  return { pedir: vi.fn(async () => resultado), estado: vi.fn(async () => ({ ok: true as const, estado: ESTADO })) };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  exigirDuenoApi.mockResolvedValue(DUENO);
  leerConfigIa.mockResolvedValue(ENCENDIDA);
  clienteAnalisisDelEntorno.mockReturnValue(servicio());
  reiniciarFrecuenciasIa();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const f of [exigirDuenoApi, leerConfigIa, clienteAnalisisDelEntorno]) f.mockReset();
});

describe("la protección de envío", () => {
  it("otro origen: 403 sin mirar la sesión", async () => {
    const r = await POST(pedir({ tarea: "DIARIO" }, { origin: "https://otro.ejemplo.invalid" }));
    expect(r.status).toBe(403);
    expect(exigirDuenoApi).not.toHaveBeenCalled();
  });

  it.each([403, 401])("la familia o sin sesión (%i): la respuesta del guardián tal cual, sin leer la base ni llamar al servicio", async (estado) => {
    const respuesta = new Response(JSON.stringify({ error: "x" }), { status: estado });
    exigirDuenoApi.mockResolvedValueOnce({ ok: false, respuesta });
    expect(await POST(pedir({ tarea: "DIARIO" }))).toBe(respuesta);
    exigirDuenoApi.mockResolvedValueOnce({ ok: false, respuesta });
    expect(await GET(leerEstado())).toBe(respuesta);
    expect(leerConfigIa).not.toHaveBeenCalled();
    expect(clienteAnalisisDelEntorno).not.toHaveBeenCalled();
  });
});

describe("POST · validación estricta de la tarea", () => {
  it.each([
    "{no es json", "[]", "null", "{}", JSON.stringify({ tarea: "OTRA" }), JSON.stringify({ tarea: "diario" }), JSON.stringify({ tarea: 7 }), JSON.stringify({ tarea: null }),
    JSON.stringify({ tarea: ["DIARIO"] }), JSON.stringify({ tarea: "DIARIO", modelo: "otro:1b" }), JSON.stringify({ tarea: "DIARIO", destino: "http://otro" }),
    JSON.stringify({ tarea: "DIARIO", relleno: "x".repeat(2000) }),
  ])("un cuerpo raro (%s): 400 sin caché, sin leer la config ni llamar al servicio", async (cuerpo) => {
    const r = await POST(pedir(cuerpo));
    expect(r.status).toBe(400);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(leerConfigIa).not.toHaveBeenCalled();
    expect(clienteAnalisisDelEntorno).not.toHaveBeenCalled();
  });

  it.each(["DIARIO", "REGLAS", "ESCENARIOS"])("%s: se pide al servicio con esa tarea y nada más", async (tarea) => {
    const s = servicio();
    clienteAnalisisDelEntorno.mockReturnValue(s);
    const r = await POST(pedir({ tarea }));
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ estado: "ACEPTADO", lugar: "EN_CURSO" });
    expect(s.pedir).toHaveBeenCalledWith(tarea);
    expect(s.pedir.mock.calls[0]).toHaveLength(1);
  });
});

describe("POST · el interruptor de config_ia (falla cerrada)", () => {
  it.each([["sin configuración", null], ["con el interruptor apagado", { ...ENCENDIDA, analisisDemanda: false }]])("%s: 403 ANALISIS_APAGADO y no llama al servicio", async (_n, config) => {
    leerConfigIa.mockResolvedValue(config);
    const r = await POST(pedir({ tarea: "DIARIO" }));
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ codigo: "ANALISIS_APAGADO" });
    expect(clienteAnalisisDelEntorno).not.toHaveBeenCalled();
  });

  it("si la base falla al leer la config: 500 genérico, sin el mensaje, sin llamar al servicio", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    leerConfigIa.mockRejectedValueOnce(new Error("valor-real-4613"));
    const r = await POST(pedir({ tarea: "DIARIO" }));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("valor-real-4613");
    expect(clienteAnalisisDelEntorno).not.toHaveBeenCalled();
  });
});

describe("POST · lo que decide el servicio", () => {
  it.each([
    [{ ok: false, motivo: "ANALISIS_APAGADO" }, 403, "ANALISIS_APAGADO"],
    [{ ok: false, motivo: "TAREA_INACTIVA" }, 409, "TAREA_INACTIVA"],
    [{ ok: false, motivo: "OCUPADO" }, 429, "OCUPADO"],
    [{ ok: false, motivo: "SERVICIO_NO_DISPONIBLE" }, 503, "SERVICIO_NO_DISPONIBLE"],
    [{ ok: false, motivo: "SERVICIO_TOKEN" }, 503, "SERVICIO_NO_DISPONIBLE"],
    [{ ok: false, motivo: "RESPUESTA_INVALIDA" }, 502, "RESPUESTA_INVALIDA"],
  ])("%j: %i con el código %s", async (resultado, estado, codigo) => {
    clienteAnalisisDelEntorno.mockReturnValue(servicio(resultado as never));
    const r = await POST(pedir({ tarea: "DIARIO" }));
    expect(r.status).toBe(estado);
    expect(await r.json()).toMatchObject({ codigo });
  });

  it("ESPERA_MINIMA: 429 con los segundos que faltan, también en Retry-After", async () => {
    clienteAnalisisDelEntorno.mockReturnValue(servicio({ ok: false, motivo: "ESPERA_MINIMA", reintentarEnS: 75 }));
    const r = await POST(pedir({ tarea: "DIARIO" }));
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("75");
    expect(await r.json()).toMatchObject({ codigo: "ESPERA_MINIMA", reintentarEnS: 75 });
  });

  it("sin cliente del servicio (token o dirección que no valen): 503 y no se manda nada", async () => {
    clienteAnalisisDelEntorno.mockReturnValue(null);
    const r = await POST(pedir({ tarea: "DIARIO" }));
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ codigo: "SERVICIO_NO_DISPONIBLE" });
  });

  it("un pedido cada pocos segundos por usuario: el segundo seguido es 429 y no llega al servicio", async () => {
    const s = servicio();
    clienteAnalisisDelEntorno.mockReturnValue(s);
    expect((await POST(pedir({ tarea: "DIARIO" }))).status).toBe(202);
    const r = await POST(pedir({ tarea: "REGLAS" }));
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toMatch(/^[0-9]+$/);
    expect(s.pedir).toHaveBeenCalledTimes(1);
  });

  it("una excepción del servicio no sale: 502 genérico, sin el mensaje", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const s = servicio();
    s.pedir.mockRejectedValueOnce(new Error("valor-real-4613"));
    clienteAnalisisDelEntorno.mockReturnValue(s);
    const r = await POST(pedir({ tarea: "DIARIO" }));
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain("valor-real-4613");
  });
});

describe("GET · el estado", () => {
  it("200 con el estado del servicio, sin caché", async () => {
    const r = await GET(leerEstado());
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ estado: ESTADO });
  });

  it("sin cliente: 503; si el servicio no contesta: 503", async () => {
    clienteAnalisisDelEntorno.mockReturnValue(null);
    expect((await GET(leerEstado())).status).toBe(503);
    const s = servicio();
    s.estado.mockResolvedValueOnce({ ok: false, motivo: "SERVICIO_NO_DISPONIBLE" });
    clienteAnalisisDelEntorno.mockReturnValue(s);
    expect((await GET(leerEstado())).status).toBe(503);
  });
});
