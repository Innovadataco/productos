// POST /api/alertas/umbrales con la sesión y la base simuladas: el Origin (CSRF) antes que la sesión; solo el dueño (la familia,
// 403, sin tocar la base); el cuerpo con claves exactas (400, con el campo y el código, nunca el valor); 409 si otra versión entró
// en medio; 403 si el autor no existe; 201 con la versión; errores desconocidos, 500 genérico sin valores. Datos inventados.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORIGENES_DESARROLLO } from "@/auth/origen";
import { MENSAJE_SOLO_LECTURA } from "@/auth/respuestas";

const exigirDuenoApi = vi.hoisted(() => vi.fn());
const crearVersionUmbral = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirDuenoApi }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/edicion/alertas/crear", async (original) => ({ ...(await original<typeof import("@/app/edicion/alertas/crear")>()), crearVersionUmbral }));

import { POST } from "@/app/api/alertas/umbrales/route";
import { ErrorUmbral } from "@/app/edicion/alertas/errores";

const ORIGEN = ORIGENES_DESARROLLO[0]!;
const DUENO = { ok: true, usuario: { id: "u-dueno-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" } };
const CUERPO = {
  versionBase: 2, alertaCercaPct: "3,5", alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: "4", alertaMovimientoActiva: false,
  alertaCaidaPct: "2,25", alertaCaidaActiva: true, alertaDatoViejoMin: 45, alertaDatoViejoActiva: true, alertaExDiasHabiles: 5, alertaExActiva: true, motivo: "Motivo ficticio",
};
const pedido = (cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request(`${ORIGEN}/api/alertas/umbrales`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGEN, ...cabeceras }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  exigirDuenoApi.mockResolvedValue(DUENO);
  crearVersionUmbral.mockResolvedValue({ version: 3 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const f of [exigirDuenoApi, crearVersionUmbral]) f.mockReset();
  vi.restoreAllMocks();
});

describe("POST /api/alertas/umbrales", () => {
  it("el dueño guarda una versión: 201 con su número, el autor de la sesión y la versión de partida del formulario", async () => {
    const r = await POST(pedido(CUERPO));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ version: 3 });
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(crearVersionUmbral).toHaveBeenCalledWith({ soy: "la base" }, expect.objectContaining({ motivo: "Motivo ficticio", umbrales: expect.objectContaining({ alertaCercaPct: 3.5, alertaMovimientoActiva: false }) }), { autorId: "u-dueno-4613", ultimaEsperada: 2 });
  });

  it("la familia (el guardián responde 403) no llega a la base", async () => {
    exigirDuenoApi.mockResolvedValue({ ok: false, respuesta: new Response(JSON.stringify({ error: MENSAJE_SOLO_LECTURA }), { status: 403 }) });
    const r = await POST(pedido(CUERPO));
    expect(r.status).toBe(403);
    expect(crearVersionUmbral).not.toHaveBeenCalled();
  });

  it("sin sesión, la respuesta del guardián (401)", async () => {
    exigirDuenoApi.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 401 }) });
    expect((await POST(pedido(CUERPO))).status).toBe(401);
    expect(crearVersionUmbral).not.toHaveBeenCalled();
  });

  it("un Origin ajeno se rechaza (403) antes de mirar la sesión", async () => {
    const r = await POST(pedido(CUERPO, { origin: "https://ajeno.invalid" }));
    expect(r.status).toBe(403);
    expect(exigirDuenoApi).not.toHaveBeenCalled();
  });

  it("un valor fuera de rango es 400 con su campo y su código, sin repetir el valor y sin guardar", async () => {
    const r = await POST(pedido({ ...CUERPO, alertaCercaPct: "77" }));
    expect(r.status).toBe(400);
    const cuerpo = (await r.json()) as { codigo: string; campos: { campo: string; codigo: string }[] };
    expect(cuerpo.codigo).toBe("DATOS_INVALIDOS");
    expect(cuerpo.campos).toEqual([{ campo: "alertaCercaPct", codigo: "FUERA_DE_RANGO" }]);
    expect(JSON.stringify(cuerpo)).not.toContain("77");
    expect(crearVersionUmbral).not.toHaveBeenCalled();
  });

  it("claves de más, un cuerpo que no es JSON, sin content-type o demasiado grande: 400 sin guardar", async () => {
    expect((await POST(pedido({ ...CUERPO, autorId: "otro" }))).status).toBe(400);
    expect((await POST(pedido("{no es json"))).status).toBe(400);
    expect((await POST(pedido(JSON.stringify(CUERPO), { "content-type": "text/plain" }))).status).toBe(400);
    expect((await POST(pedido("x".repeat(20_000)))).status).toBe(400);
    expect(crearVersionUmbral).not.toHaveBeenCalled();
  });

  it("si otra versión entró en medio, 409 con la versión de partida marcada", async () => {
    crearVersionUmbral.mockRejectedValue(new ErrorUmbral("UMBRAL_CAMBIO"));
    const r = await POST(pedido(CUERPO));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ campos: [{ campo: "versionBase", codigo: "UMBRAL_CAMBIO" }] });
  });

  it("un autor que ya no existe es 403 genérico", async () => {
    crearVersionUmbral.mockRejectedValue(new ErrorUmbral("AUTOR_INEXISTENTE"));
    const r = await POST(pedido(CUERPO));
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ campos: [{ campo: "cuerpo", codigo: "AUTOR_INEXISTENTE" }] });
  });

  it("un error desconocido es 500 genérico y el registro no lleva el mensaje (puede traer valores)", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    crearVersionUmbral.mockRejectedValue(new Error("detalle con 3,5 y 4613"));
    const r = await POST(pedido(CUERPO));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toMatch(/4613|3,5/);
    expect(registro.mock.calls.flat().join(" ")).not.toMatch(/4613|3,5/);
  });
});
