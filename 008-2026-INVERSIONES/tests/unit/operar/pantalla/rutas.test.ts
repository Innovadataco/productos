// Las dos rutas de O5 con la sesión y la base simuladas:
//  - POST /api/operar/simular: el Origin (CSRF) antes que la sesión; con sesión (el dueño o la familia: no escribe); el
//    límite por usuario (429); el cuerpo con claves exactas (400); el resultado del motor con la tarifa vigente; nunca
//    guarda; ante un error, un 500 genérico sin cifras.
//  - POST /api/operar/tarifas: solo el dueño (la familia, 403); claves exactas; el autor de la sesión; 409 si otra
//    versión entró en medio.
// Datos inventados.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORIGENES_DESARROLLO } from "@/auth/origen";
import { ErrorTarifa } from "@/operar/tarifa/errores";
import { CONTEXTO, ESTADO, idDe, A } from "../simulador/apoyo/estado.ficticio";
import { cuerpoTarifa, tarifa } from "../tarifa/apoyo/tarifa.ficticio";

const exigirSesionApi = vi.hoisted(() => vi.fn());
const exigirDuenoApi = vi.hoisted(() => vi.fn());
const leerEntradasSimulador = vi.hoisted(() => vi.fn());
const crearVersionTarifa = vi.hoisted(() => vi.fn());
const analizarSimulacion = vi.hoisted(() => vi.fn());
const COMPARACION = {
  concentracion: { antes: null, despues: null }, volatilidad: { antes: null, despues: null }, pesoOperada: { antes: 0.2113, despues: 0.2371 },
  contribucionOperada: { antes: null, despues: null }, puntos: { aparecen: [], desaparecen: [] },
};
vi.mock("@/auth/sesion", () => ({ exigirSesionApi, exigirDuenoApi }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/operar/pantalla/leer", () => ({ leerEntradasSimulador }));
vi.mock("@/operar/pantalla/analisis", () => ({ analizarSimulacion }));
vi.mock("@/operar/tarifa/crear", () => ({ crearVersionTarifa }));

import { POST as simular } from "@/app/api/operar/simular/route";
import { POST as guardarTarifa } from "@/app/api/operar/tarifas/route";
import { reiniciarFrecuenciaSimulador, SIMULACIONES_POR_MINUTO } from "@/operar/pantalla/frecuencia";

const ORIGEN = ORIGENES_DESARROLLO[0]!;
const DUENO = { ok: true, usuario: { id: "u-dueno-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" } };
const FAMILIA = { ok: true, usuario: { id: "u-familia-379", email: "familia@ejemplo.invalid", rol: "FAMILIA" } };
const pedido = (ruta: string, cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request(`${ORIGEN}${ruta}`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGEN, ...cabeceras }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });
const cuerpoSim = (cambios: Record<string, unknown> = {}) => ({ instrumentoId: idDe(A), lado: "COMPRAR", cantidad: "3", precioLimite: "4.613,27", comisionista: "TRII", saldoComisionista: "", ...cambios });

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  exigirSesionApi.mockResolvedValue(DUENO);
  exigirDuenoApi.mockResolvedValue(DUENO);
  leerEntradasSimulador.mockResolvedValue({ estado: ESTADO, contexto: { ...CONTEXTO, tarifas: { COMPRA: tarifa() } }, caja: { fechaCorte: new Date(Date.UTC(2027, 2, 12)) } });
  crearVersionTarifa.mockResolvedValue({ version: 3 });
  analizarSimulacion.mockResolvedValue({ comparacion: COMPARACION, escenarios: null, nombres: new Map([[idDe(A), A]]) });
  reiniciarFrecuenciaSimulador();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const f of [exigirSesionApi, exigirDuenoApi, leerEntradasSimulador, crearVersionTarifa, analizarSimulacion]) f.mockReset();
});

describe("POST /api/operar/simular", () => {
  it("simula con la tarifa vigente, sin caché, con el comisionista del pedido", async () => {
    const r = await simular(pedido("/api/operar/simular", cuerpoSim()));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const cuerpo = (await r.json()) as { ok: boolean; vista: { comision: { fuente: string; valor: string } } };
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.vista.comision).toMatchObject({ fuente: "TARIFA", valor: "$ 50" });
    expect(leerEntradasSimulador).toHaveBeenCalledWith({ soy: "la base" }, expect.any(Date), "TRII");
  });

  it("con el saldo escrito, la caja es ese valor y se rotula; el análisis sale del motor y, si falla, la simulación sigue sin él", async () => {
    const r = await simular(pedido("/api/operar/simular", cuerpoSim({ saldoComisionista: "4.613,27" })));
    const cuerpo = (await r.json()) as { vista: { cajaAntes: string; cajaFuente: string; analisis: { frases: string[]; filas: { antes: string }[] } | null } };
    expect(cuerpo.vista.cajaAntes).toBe("$ 4.613");
    expect(cuerpo.vista.cajaFuente).toContain("escrito por usted");
    expect(cuerpo.vista.analisis?.filas[0]?.antes).toBe("21,13 %");
    expect(cuerpo.vista.analisis?.frases[0]).toMatch(/^Con esta compra, FICTICIA-A pasa de 21,13 % a 23,71 %/);
    expect(analizarSimulacion).toHaveBeenCalledWith({ soy: "la base" }, expect.objectContaining({ instrumentoId: idDe(A), cantidadDespues: 1240n }));
    // La caja del simulador llega al análisis (antes, la escrita; después, con la orden y la comisión) y se rotula.
    const caja = (analizarSimulacion.mock.calls[0]![1] as { caja: { antes: { toFixed(): string }; despues: { lt(x: unknown): boolean } } }).caja;
    expect(caja.antes.toFixed()).toBe("4613.27");
    expect(caja.despues.lt(caja.antes)).toBe(true);
    expect((cuerpo.vista.analisis as unknown as { notaCaja: string }).notaCaja).toContain("antes, el saldo que usted escribió; después, esa caja menos el valor de la orden y la comisión");
    const certificada = (await (await simular(pedido("/api/operar/simular", cuerpoSim()))).json()) as { vista: { analisis: { notaCaja: string } } };
    expect(certificada.vista.analisis.notaCaja).toContain("antes, la certificada por Acciones & Valores");
    leerEntradasSimulador.mockResolvedValueOnce({ estado: ESTADO, contexto: CONTEXTO, caja: { fechaCorte: null } });
    const sinCertificacion = (await (await simular(pedido("/api/operar/simular", cuerpoSim()))).json()) as { vista: { analisis: { notaCaja: string } } };
    expect(sinCertificacion.vista.analisis.notaCaja).toContain("antes, 0 (no hay certificación de Acciones & Valores)");
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    analizarSimulacion.mockRejectedValue(new RangeError("detalle con cifras 4613"));
    const sin = (await (await simular(pedido("/api/operar/simular", cuerpoSim()))).json()) as { ok: boolean; vista: { analisis: unknown } };
    expect(sin.ok).toBe(true);
    expect(sin.vista.analisis).toBeNull();
    expect(registro.mock.calls.flat().join(" ")).not.toContain("4613");
  });

  it("la familia también simula (no escribe nada)", async () => {
    exigirSesionApi.mockResolvedValue(FAMILIA);
    expect((await simular(pedido("/api/operar/simular", cuerpoSim()))).status).toBe(200);
  });

  it("un Origin ajeno se rechaza antes de mirar la sesión", async () => {
    const r = await simular(pedido("/api/operar/simular", cuerpoSim(), { origin: "https://ajeno.invalid" }));
    expect(r.status).toBe(403);
    expect(exigirSesionApi).not.toHaveBeenCalled();
  });

  it("sin sesión, la respuesta del guardián (401)", async () => {
    exigirSesionApi.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 401 }) });
    expect((await simular(pedido("/api/operar/simular", cuerpoSim()))).status).toBe(401);
    expect(leerEntradasSimulador).not.toHaveBeenCalled();
  });

  it("claves de más, un número ilegible o un cuerpo que no es JSON: 400 sin leer la base", async () => {
    expect((await simular(pedido("/api/operar/simular", { ...cuerpoSim(), hoy: "2027-03-17" }))).status).toBe(400);
    const r = await simular(pedido("/api/operar/simular", cuerpoSim({ cantidad: "1,5" })));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ campos: ["cantidad"] });
    expect((await simular(pedido("/api/operar/simular", "{no es json"))).status).toBe(400);
    expect((await simular(pedido("/api/operar/simular", "x".repeat(2000)))).status).toBe(400);
    expect(leerEntradasSimulador).not.toHaveBeenCalled();
  });

  it("los errores del dueño vuelven con 200 y ok: false", async () => {
    const r = await simular(pedido("/api/operar/simular", cuerpoSim({ instrumentoId: "id-no-existe" })));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: false });
  });

  it("pasada la cuota por minuto, 429 con Retry-After", async () => {
    for (let i = 0; i < SIMULACIONES_POR_MINUTO; i++) expect((await simular(pedido("/api/operar/simular", cuerpoSim()))).status).toBe(200);
    const r = await simular(pedido("/api/operar/simular", cuerpoSim()));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("un error de la base o del motor: 500 genérico, y al registro solo el nombre del error", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    leerEntradasSimulador.mockRejectedValue(new RangeError("valor-real-4613"));
    const r = await simular(pedido("/api/operar/simular", cuerpoSim()));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("4613");
    expect(registro.mock.calls.flat().join(" ")).not.toContain("valor-real");
    expect(registro.mock.calls.flat().join(" ")).toContain("RangeError");
  });
});

describe("POST /api/operar/tarifas", () => {
  it("el dueño guarda una versión nueva; el autor sale de la sesión", async () => {
    const r = await guardarTarifa(pedido("/api/operar/tarifas", cuerpoTarifa()));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ version: 3 });
    expect(crearVersionTarifa).toHaveBeenCalledWith({ soy: "la base" }, expect.objectContaining({ comisionista: "TRII", porcentaje: "0.2731" }), { autorId: DUENO.usuario.id, ultimaEsperada: 2 });
  });

  it("la familia recibe la respuesta del guardián (403) y nada se guarda", async () => {
    exigirDuenoApi.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 403 }) });
    expect((await guardarTarifa(pedido("/api/operar/tarifas", cuerpoTarifa()))).status).toBe(403);
    expect(crearVersionTarifa).not.toHaveBeenCalled();
  });

  it("un Origin ajeno: 403 antes del guardián", async () => {
    expect((await guardarTarifa(pedido("/api/operar/tarifas", cuerpoTarifa(), { origin: "https://ajeno.invalid" }))).status).toBe(403);
    expect(exigirDuenoApi).not.toHaveBeenCalled();
  });

  it("datos inválidos: 400 con los campos; cuerpo ilegible: 400", async () => {
    const r = await guardarTarifa(pedido("/api/operar/tarifas", cuerpoTarifa({ porcentaje: "101" })));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ campos: [{ campo: "porcentaje", codigo: "PORCENTAJE_INVALIDO" }] });
    expect((await guardarTarifa(pedido("/api/operar/tarifas", "{"))).status).toBe(400);
    expect(crearVersionTarifa).not.toHaveBeenCalled();
  });

  it("otra versión en medio: 409; un autor que no existe: 403; otro error: 500 genérico", async () => {
    crearVersionTarifa.mockRejectedValueOnce(new ErrorTarifa("TARIFA_CAMBIO"));
    const r = await guardarTarifa(pedido("/api/operar/tarifas", cuerpoTarifa()));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ campos: [{ campo: "versionBase", codigo: "TARIFA_CAMBIO" }] });
    crearVersionTarifa.mockRejectedValueOnce(new ErrorTarifa("AUTOR_INEXISTENTE"));
    expect((await guardarTarifa(pedido("/api/operar/tarifas", cuerpoTarifa()))).status).toBe(403);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    crearVersionTarifa.mockRejectedValueOnce(new Error("valor-real-4613"));
    const r500 = await guardarTarifa(pedido("/api/operar/tarifas", cuerpoTarifa()));
    expect(r500.status).toBe(500);
    expect(JSON.stringify(await r500.json())).not.toContain("4613");
  });
});
