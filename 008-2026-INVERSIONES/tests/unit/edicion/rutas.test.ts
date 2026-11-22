// Las rutas de escritura del área de edición (fase B, PR-B) con la sesión y el dominio simulados: el Origin (CSRF) va
// antes que la sesión; el guardián del dueño decide (su 401 o 403 sale tal cual, sin leer el cuerpo ni escribir); el
// cuerpo es JSON acotado con claves exactas; el autor sale SIEMPRE de la sesión, nunca del cuerpo (IDOR); cada ruta
// llama a la función del dominio que corresponde, con lo leído; los errores salen genéricos y sin caché. Inventado.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORIGENES_DESARROLLO } from "@/auth/origen";
import { ErrorPlan } from "@/plan/errores";

const exigirDuenoApi = vi.hoisted(() => vi.fn());
const crearVersionPlan = vi.hoisted(() => vi.fn());
const registrarDecision = vi.hoisted(() => vi.fn());
const registrarDecisionConOrden = vi.hoisted(() => vi.fn());
const corregirDecision = vi.hoisted(() => vi.fn());
const enlazarOrden = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirDuenoApi }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/plan/versiones", () => ({ crearVersionPlan }));
vi.mock("@/plan/decisiones", () => ({ registrarDecision, registrarDecisionConOrden, corregirDecision }));
vi.mock("@/plan/enlaces", () => ({ enlazarOrden }));

import { POST as postDecision } from "@/app/api/decisiones/route";
import { POST as postEnlace } from "@/app/api/decisiones/enlaces/route";
import { POST as postVersion } from "@/app/api/plan/versiones/route";

const ORIGEN = ORIGENES_DESARROLLO[0]!;
const DUENO = { ok: true, usuario: { id: "u-dueno-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" } };
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const pedido = (ruta: string, cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request(`${ORIGEN}${ruta}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGEN, ...cabeceras },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });

const VERSION = {
  vigenteDesde: "2027-02-11", motivo: "Ajuste ficticio", versionBase: 3,
  reglas: [{ instrumentoId: "inst-a", condicion: "CIERRE_BAJO", nivel: "37.911,47", accion: "COMPRAR", cantidad: "", plazoHasta: "", detalle: "Comprar bajo el nivel (ficticia)" }],
};
const DECISION = { fechaDecision: "2027-02-12", instrumentoId: "inst-a", accion: "VENDER", cantidad: "1.237", reglaId: null, excepcion: false, motivo: "Vender (ficticio)", ordenId: null, corrige: null };
const ENLACE = { decisionId: "decision-a", ordenId: "orden-a" };

const RUTAS = [
  ["/api/plan/versiones", postVersion, VERSION],
  ["/api/decisiones", postDecision, DECISION],
  ["/api/decisiones/enlaces", postEnlace, ENLACE],
] as const;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  exigirDuenoApi.mockResolvedValue(DUENO);
  crearVersionPlan.mockResolvedValue({ id: "v-id", version: 4, reglaIds: ["r-1"] });
  registrarDecision.mockResolvedValue({ id: "decision-nueva", planVersionId: "v-id", version: 4 });
  registrarDecisionConOrden.mockResolvedValue({ id: "decision-con-orden", planVersionId: "v-id", version: 4, enlaceId: "e-1" });
  corregirDecision.mockResolvedValue({ id: "decision-corregida", planVersionId: "v-id", version: 4, enlacesMovidos: 2 });
  enlazarOrden.mockResolvedValue({ id: "e-2", reemplazaId: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const f of [exigirDuenoApi, crearVersionPlan, registrarDecision, registrarDecisionConOrden, corregirDecision, enlazarOrden]) f.mockReset();
});

const dominio = () => [crearVersionPlan, registrarDecision, registrarDecisionConOrden, corregirDecision, enlazarOrden].reduce((s, f) => s + f.mock.calls.length, 0);

describe.each(RUTAS)("POST %s · lo común", (ruta, post, bien) => {
  it("otro origen: 403 sin mirar la sesión ni escribir", async () => {
    const r = await post(pedido(ruta, bien, { origin: "https://otro.ejemplo.invalid" }));
    expect(r.status).toBe(403);
    expect(exigirDuenoApi).not.toHaveBeenCalled();
    expect(dominio()).toBe(0);
  });

  it("producción sin APP_ORIGEN: 503 (falla cerrada)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGEN", "");
    expect((await post(pedido(ruta, bien))).status).toBe(503);
    expect(dominio()).toBe(0);
  });

  it("la respuesta del guardián (familia 403, sin sesión 401) sale tal cual y no se escribe nada", async () => {
    for (const estado of [403, 401]) {
      const respuesta = new Response(JSON.stringify({ error: "x" }), { status: estado });
      exigirDuenoApi.mockResolvedValueOnce({ ok: false, respuesta });
      expect(await post(pedido(ruta, bien))).toBe(respuesta);
    }
    expect(dominio()).toBe(0);
  });

  it("cuerpo que no es JSON, ilegible, demasiado grande o con claves de más (el autor): 400 sin escribir", async () => {
    for (const p of [
      pedido(ruta, bien, { "content-type": "text/plain" }),
      pedido(ruta, "{no es json"),
      pedido(ruta, { ...bien, relleno: "x".repeat(1_100_000) }),
      pedido(ruta, { ...bien, autorId: "otro-usuario" }),
    ]) {
      const r = await post(p);
      expect(r.status).toBe(400);
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
    expect(dominio()).toBe(0);
  });

  it("un error inesperado del dominio: 500 genérico (sin su mensaje)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const f of [crearVersionPlan, registrarDecision, enlazarOrden]) f.mockRejectedValue(new Error("valor-real-4613"));
    const r = await post(pedido(ruta, bien));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("valor-real-4613");
  });
});

describe("POST /api/plan/versiones", () => {
  it("201 con el número; el dominio recibe lo leído, el autor de la sesión y la última versión que vio el formulario", async () => {
    const r = await postVersion(pedido("/api/plan/versiones", VERSION));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ version: 4 });
    expect(crearVersionPlan).toHaveBeenCalledWith(
      { soy: "la base" },
      {
        vigenteDesde: dia("2027-02-11"), motivo: "Ajuste ficticio", autorId: "u-dueno-4613",
        reglas: [{ instrumentoId: "inst-a", condicion: "CIERRE_BAJO", nivel: "37911.47", accion: "COMPRAR", cantidad: null, plazoHasta: null, detalle: "Comprar bajo el nivel (ficticia)" }],
      },
      { ultimaEsperada: 3 },
    );
  });

  it("un dato ilegible: 400 con el campo, sin llamar al dominio; un ErrorPlan del dominio sale con su estado", async () => {
    const r = await postVersion(pedido("/api/plan/versiones", { ...VERSION, reglas: [{ ...VERSION.reglas[0], nivel: "1.5" }] }));
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toEqual([{ campo: "reglas[0].nivel", codigo: "NIVEL_NO_RECONOCIDO" }]);
    expect(crearVersionPlan).not.toHaveBeenCalled();
    crearVersionPlan.mockRejectedValueOnce(new ErrorPlan("PLAN_CAMBIO"));
    expect((await postVersion(pedido("/api/plan/versiones", VERSION))).status).toBe(409);
  });
});

describe("POST /api/decisiones", () => {
  it("sin orden ni corrección: registrarDecision, con el autor de la sesión", async () => {
    const r = await postDecision(pedido("/api/decisiones", DECISION));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id: "decision-nueva" });
    expect(registrarDecision).toHaveBeenCalledWith(
      { soy: "la base" },
      { fechaDecision: dia("2027-02-12"), instrumentoId: "inst-a", accion: "VENDER", cantidad: 1237n, reglaId: null, excepcion: false, motivo: "Vender (ficticio)", autorId: "u-dueno-4613" },
    );
  });

  it("con su orden: registrarDecisionConOrden (una sola transacción)", async () => {
    const r = await postDecision(pedido("/api/decisiones", { ...DECISION, ordenId: "orden-a" }));
    expect(await r.json()).toEqual({ id: "decision-con-orden" });
    expect(registrarDecisionConOrden).toHaveBeenCalledWith({ soy: "la base" }, expect.objectContaining({ autorId: "u-dueno-4613" }), "orden-a");
    expect(registrarDecision).not.toHaveBeenCalled();
  });

  it("con `corrige`: corregirDecision de esa decisión", async () => {
    const r = await postDecision(pedido("/api/decisiones", { ...DECISION, corrige: "decision-vieja" }));
    expect(await r.json()).toEqual({ id: "decision-corregida" });
    expect(corregirDecision).toHaveBeenCalledWith({ soy: "la base" }, "decision-vieja", expect.objectContaining({ autorId: "u-dueno-4613", motivo: "Vender (ficticio)" }));
  });

  it("orden y corrección a la vez: 400 sin escribir", async () => {
    const r = await postDecision(pedido("/api/decisiones", { ...DECISION, corrige: "decision-vieja", ordenId: "orden-a" }));
    expect(r.status).toBe(400);
    expect(dominio()).toBe(0);
  });
});

describe("POST /api/decisiones/enlaces", () => {
  it("201 con la decisión; enlazarOrden con el autor de la sesión y sin motivo (cambiar un enlace no es de la web)", async () => {
    const r = await postEnlace(pedido("/api/decisiones/enlaces", ENLACE));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ decisionId: "decision-a" });
    expect(enlazarOrden).toHaveBeenCalledWith({ soy: "la base" }, { ordenId: "orden-a", decisionId: "decision-a", autorId: "u-dueno-4613", motivo: null });
  });

  it("una orden ya enlazada: 409 con su código", async () => {
    enlazarOrden.mockRejectedValueOnce(new ErrorPlan("ORDEN_YA_ENLAZADA"));
    const r = await postEnlace(pedido("/api/decisiones/enlaces", ENLACE));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ codigo: "ORDEN_YA_ENLAZADA" });
  });
});
