// POST /api/alertas/vistas con la sesión y la base simuladas: «Marcar vista» y «Marcar todas», solo el dueño (la familia, 403, sin
// tocar la base), el Origin antes que la sesión, claves exactas (400), una alerta que no existe es 404, y es idempotente: marcar
// lo ya marcado responde 200 con cero marcadas. GET /api/alertas/pendientes: la sesión (dueño o familia) y el conteo. Datos inventados.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORIGENES_DESARROLLO } from "@/auth/origen";
import { MENSAJE_SOLO_LECTURA } from "@/auth/respuestas";

const exigirDuenoApi = vi.hoisted(() => vi.fn());
const exigirSesionApi = vi.hoisted(() => vi.fn());
const marcarVista = vi.hoisted(() => vi.fn());
const marcarTodas = vi.hoisted(() => vi.fn());
const contarPendientes = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirDuenoApi, exigirSesionApi }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/alertas/marcar", () => ({ marcarVista, marcarTodas }));
vi.mock("@/app/alertas/datos", () => ({ contarPendientes }));

import { GET as pendientes } from "@/app/api/alertas/pendientes/route";
import { POST } from "@/app/api/alertas/vistas/route";

const ORIGEN = ORIGENES_DESARROLLO[0]!;
const DUENO = { ok: true, usuario: { id: "u-dueno-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" } };
const FAMILIA = { ok: true, usuario: { id: "u-familia-379", email: "familia@ejemplo.invalid", rol: "FAMILIA" } };
const pedido = (cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request(`${ORIGEN}/api/alertas/vistas`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGEN, ...cabeceras }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  exigirDuenoApi.mockResolvedValue(DUENO);
  exigirSesionApi.mockResolvedValue(FAMILIA);
  marcarVista.mockResolvedValue({ existe: true, marcadas: 1 });
  marcarTodas.mockResolvedValue({ marcadas: 3 });
  contarPendientes.mockResolvedValue(2);
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const f of [exigirDuenoApi, exigirSesionApi, marcarVista, marcarTodas, contarPendientes]) f.mockReset();
  vi.restoreAllMocks();
});

describe("POST /api/alertas/vistas", () => {
  it("«Marcar vista»: el dueño marca una alerta con su id de sesión; 200 con lo marcado", async () => {
    const r = await POST(pedido({ alertaId: "alerta-1" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ marcadas: 1 });
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(marcarVista).toHaveBeenCalledWith({ soy: "la base" }, "alerta-1", "u-dueno-4613");
  });

  it("«Marcar todas»: marca las de los últimos 30 días sin marcar con el día de Colombia de hoy", async () => {
    const r = await POST(pedido({ todas: true }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ marcadas: 3 });
    expect(marcarTodas).toHaveBeenCalledWith({ soy: "la base" }, "u-dueno-4613", expect.any(Date));
    expect((marcarTodas.mock.calls[0]![2] as Date).getUTCHours()).toBe(0);
  });

  it("es idempotente: marcar otra vez lo ya marcado responde 200 con cero", async () => {
    marcarVista.mockResolvedValue({ existe: true, marcadas: 0 });
    const r = await POST(pedido({ alertaId: "alerta-1" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ marcadas: 0 });
  });

  it("una alerta que no existe es 404 genérico", async () => {
    marcarVista.mockResolvedValue({ existe: false, marcadas: 0 });
    const r = await POST(pedido({ alertaId: "no-existe" }));
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ codigo: "ALERTA_INEXISTENTE" });
  });

  it("la familia (el guardián responde 403) no llega a la base", async () => {
    exigirDuenoApi.mockResolvedValue({ ok: false, respuesta: new Response(JSON.stringify({ error: MENSAJE_SOLO_LECTURA }), { status: 403 }) });
    for (const cuerpo of [{ alertaId: "alerta-1" }, { todas: true }]) expect((await POST(pedido(cuerpo))).status).toBe(403);
    expect(marcarVista).not.toHaveBeenCalled();
    expect(marcarTodas).not.toHaveBeenCalled();
  });

  it("sin sesión, el 401 del guardián; con un Origin ajeno, 403 antes de mirar la sesión", async () => {
    exigirDuenoApi.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 401 }) });
    expect((await POST(pedido({ todas: true }))).status).toBe(401);
    exigirDuenoApi.mockClear();
    expect((await POST(pedido({ todas: true }, { origin: "https://ajeno.invalid" }))).status).toBe(403);
    expect(exigirDuenoApi).not.toHaveBeenCalled();
  });

  it.each([
    ["claves de más", { alertaId: "a", todas: true }],
    ["todas distinto de verdadero", { todas: false }],
    ["todas como texto", { todas: "true" }],
    ["un id que no es de la forma", { alertaId: "Ab; DROP TABLE alerta" }],
    ["un id vacío", { alertaId: "" }],
    ["un id que no es texto", { alertaId: 4613 }],
    ["un cuerpo vacío", {}],
    ["un arreglo", []],
    ["un cuerpo que no es JSON", "{no es json"],
    ["un cuerpo demasiado grande", "x".repeat(5000)],
  ])("%s: 400 sin tocar la base", async (_n, cuerpo) => {
    expect((await POST(pedido(cuerpo))).status).toBe(400);
    expect(marcarVista).not.toHaveBeenCalled();
    expect(marcarTodas).not.toHaveBeenCalled();
  });

  it("un error de la base es 500 genérico, sin el mensaje en el registro", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    marcarTodas.mockRejectedValue(new Error("detalle con 4613"));
    const r = await POST(pedido({ todas: true }));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("4613");
    expect(registro.mock.calls.flat().join(" ")).not.toContain("4613");
  });
});

describe("GET /api/alertas/pendientes", () => {
  const consulta = () => new Request(`${ORIGEN}/api/alertas/pendientes`);

  it("la familia también lo lee (solo lectura): el conteo de los últimos 7 días sin marcar, sin caché", async () => {
    const r = await pendientes(consulta());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ pendientes: 2 });
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(contarPendientes).toHaveBeenCalledWith({ soy: "la base" }, expect.any(Date));
  });

  it("sin sesión, el 401 del guardián y no lee la base", async () => {
    exigirSesionApi.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 401 }) });
    expect((await pendientes(consulta())).status).toBe(401);
    expect(contarPendientes).not.toHaveBeenCalled();
  });

  it("un error de la base es 500 genérico", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    contarPendientes.mockRejectedValue(new Error("detalle"));
    expect((await pendientes(consulta())).status).toBe(500);
  });
});
