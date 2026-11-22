// POST /api/proyecciones (frente proyecciones-pantalla; contrato de src/proyecciones/proyectar.ts) con la sesión y el
// cálculo simulados: Origin de la lista, sesión obligatoria antes de leer el cuerpo, cuerpo JSON chico con EXACTAMENTE
// los cinco controles, turno (uno en vuelo y frecuencia) con 429 y Retry-After, `no-store` siempre, `hoy` nunca del
// cliente y errores genéricos (el registro sin cifras). Inventado.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { reiniciarTurnoParaPruebas } from "@/app/proyecciones/turno";
import { resultadoFicticio } from "./ficticio";

const exigirSesionApi = vi.hoisted(() => vi.fn());
const proyectar = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesionApi }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/proyecciones/proyectar", () => ({ proyectar }));

import { POST } from "@/app/api/proyecciones/route";

const ORIGEN = "http://127.0.0.1:5008";
const BIEN = { horizonteMeses: 37, aportePeriodico: 413.71, frecuenciaAporte: "TRIMESTRAL", reinvertirDividendos: false, caidaInicialPct: 13.7 };
const pedido = (cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request(`${ORIGEN}/api/proyecciones`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGEN, ...cabeceras },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
const SESION = { ok: true, usuario: { id: "u-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" } };

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  exigirSesionApi.mockResolvedValue(SESION);
  proyectar.mockResolvedValue({ ok: true, resultado: resultadoFicticio() });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  exigirSesionApi.mockReset();
  proyectar.mockReset();
  reiniciarTurnoParaPruebas();
});

const sinCache = (r: Response) => expect(r.headers.get("cache-control")).toBe("no-store");

describe("POST /api/proyecciones", () => {
  it("200 con la vista (sin posiciones), no-store; proyecta con trayectorias y semilla del servidor y SIN `hoy`", async () => {
    const r = await POST(pedido(BIEN));
    expect(r.status).toBe(200);
    sinCache(r);
    expect(await r.json()).toEqual({ vista: aVistaProyeccion(resultadoFicticio()) });
    expect(proyectar).toHaveBeenCalledTimes(1);
    const [base, parametros, ...resto] = proyectar.mock.calls[0]!;
    expect(base).toEqual({ soy: "la base" });
    expect(parametros).toEqual({ ...BIEN, trayectorias: 2000, semilla: expect.any(Number) });
    expect(resto).toEqual([]);
  });

  it("403 desde otro origen, sin tocar la sesión", async () => {
    const r = await POST(pedido(BIEN, { origin: "https://otro.ejemplo.invalid" }));
    expect(r.status).toBe(403);
    sinCache(r);
    expect(exigirSesionApi).not.toHaveBeenCalled();
  });

  it("503 en producción sin APP_ORIGEN válida (no se puede verificar el Origin)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGEN", "");
    expect((await POST(pedido(BIEN))).status).toBe(503);
  });

  it("401 sin sesión: no lee el cuerpo ni proyecta", async () => {
    exigirSesionApi.mockResolvedValueOnce({ ok: false, respuesta: Response.json({ error: "No autenticado" }, { status: 401, headers: { "Cache-Control": "no-store" } }) });
    const p = pedido(BIEN);
    const r = await POST(p);
    expect(r.status).toBe(401);
    expect(p.bodyUsed).toBe(false);
    expect(proyectar).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON roto", "{horizonte", {}],
    ["sin content-type JSON", JSON.stringify(BIEN), { "content-type": "text/plain" }],
    ["cuerpo de más de 1 KB", JSON.stringify({ ...BIEN, relleno: "x".repeat(1100) }), {}],
    ["content-length que anuncia más de 1 KB", JSON.stringify(BIEN), { "content-length": "4613" }],
    ["un campo de más (hoy)", JSON.stringify({ ...BIEN, hoy: "2027-01-04" }), {}],
    ["trayectorias del cliente", JSON.stringify({ ...BIEN, trayectorias: 9999 }), {}],
    ["horizonte fuera de la pantalla", JSON.stringify({ ...BIEN, horizonteMeses: 240 }), {}],
  ])("400 genérico (%s), sin proyectar", async (_caso, cuerpo, cabeceras) => {
    const r = await POST(pedido(cuerpo, cabeceras as Record<string, string>));
    expect(r.status).toBe(400);
    sinCache(r);
    expect((await r.json()).error).toBe("Parámetros no válidos.");
    expect(proyectar).not.toHaveBeenCalled();
  });

  it("400 con los campos y códigos (sin cifras del portafolio) si un control está fuera de rango", async () => {
    const r = await POST(pedido({ ...BIEN, caidaInicialPct: 99.5 }));
    expect(await r.json()).toEqual({ error: "Parámetros no válidos.", campos: [{ campo: "caidaInicialPct", codigo: "FUERA_DE_RANGO" }] });
  });

  it("el motor rechaza por trabajo (DEMASIADO_TRABAJO): 400 con el código", async () => {
    proyectar.mockResolvedValueOnce({ ok: false, errores: [{ campo: "trayectorias", codigo: "DEMASIADO_TRABAJO" }] });
    const r = await POST(pedido(BIEN));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Parámetros no válidos.", campos: [{ campo: "trayectorias", codigo: "DEMASIADO_TRABAJO" }] });
  });

  it("429 con Retry-After si ya hay una proyección en vuelo del mismo usuario", async () => {
    let soltar = () => undefined as void;
    proyectar.mockImplementationOnce(() => new Promise((r) => { soltar = () => r({ ok: true, resultado: resultadoFicticio() }); }));
    const primera = POST(pedido(BIEN));
    await vi.waitFor(() => expect(proyectar).toHaveBeenCalledTimes(1));
    const r = await POST(pedido(BIEN));
    expect(r.status).toBe(429);
    sinCache(r);
    expect(r.headers.get("retry-after")).toBe("1");
    expect(await r.json()).toEqual({ error: "Hay un cálculo en curso. Intente de nuevo en un momento." });
    soltar();
    expect((await primera).status).toBe(200);
  });

  it("429 con Retry-After al pasar el límite de frecuencia", async () => {
    for (let k = 0; k < 30; k += 1) expect((await POST(pedido(BIEN))).status).toBe(200);
    const r = await POST(pedido(BIEN));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("500 genérico si el cálculo falla: el registro dice solo el nombre del error, sin cifras ni mensaje", async () => {
    proyectar.mockRejectedValueOnce(new RangeError("valor 46137.41 de FICTA"));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await POST(pedido(BIEN));
    expect(r.status).toBe(500);
    sinCache(r);
    expect(await r.json()).toEqual({ error: "No se pudo calcular la proyección. Intente de nuevo." });
    expect(registro).toHaveBeenCalledWith("[proyecciones] no se pudo calcular (RangeError)");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("46137");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("FICTA");
  });

  it("500 genérico si falla la revalidación de la sesión (la base caída)", async () => {
    exigirSesionApi.mockRejectedValueOnce(Object.assign(new Error("Can't reach postgresql://u:clave@h"), { name: "PrismaClientInitializationError" }));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await POST(pedido(BIEN));
    expect(r.status).toBe(500);
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave");
  });

  it("la base del tipo: la ruta pasa la `db` del proceso", async () => {
    await POST(pedido(BIEN));
    expect((proyectar.mock.calls[0]![0] as PrismaClient & { soy: string }).soy).toBe("la base");
  });
});
