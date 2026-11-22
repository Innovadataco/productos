// Las dos rutas de /edicion/ia (E8) con la sesión, la base y la sonda simuladas, con la protección de envío de
// /edicion/plan: el Origin (CSRF) antes que la sesión; el guardián del dueño (la familia, 403); el cuerpo JSON acotado y
// con claves exactas; el autor de la sesión, nunca del cuerpo; los errores genéricos y sin caché.
//  - POST /api/ia/config: una versión nueva contra la última que vio el formulario (409 si otra entró en medio).
//  - POST /api/ia/ollama: «identificar» o «probar» con el destino GUARDADO, nunca uno del cuerpo (I-24 de PI, SSRF):
//    control positivo con un cuerpo que trae otro destino. Un Ollama inalcanzable da 503 ESTRUCTURADO, nunca un 500.
//    Un pedido cada pocos segundos por usuario (429).
// Datos e IP inventados (la IP se arma al correr).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORIGENES_DESARROLLO } from "@/auth/origen";
import { ErrorConfigIa } from "@/ia/config/errores";
import type { SondaOllama } from "@/ia/config/sonda-ollama";
import { DESTINO_FICTICIO, LISTA_FICTICIA, VIGENTE_FICTICIA, cuerpoFicticio, ip } from "../../ia/config/apoyo/config.ficticio";

const exigirDuenoApi = vi.hoisted(() => vi.fn());
const crearVersionConfigIa = vi.hoisted(() => vi.fn());
const leerConfigIa = vi.hoisted(() => vi.fn());
const sondaDelEntorno = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirDuenoApi }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/ia/config/crear", async (original) => ({ ...(await original<typeof import("@/ia/config/crear")>()), crearVersionConfigIa }));
vi.mock("@/ia/config/leer", async (original) => ({ ...(await original<typeof import("@/ia/config/leer")>()), leerConfigIa }));
vi.mock("@/ia/config/sonda-ollama", async (original) => ({ ...(await original<typeof import("@/ia/config/sonda-ollama")>()), sondaDelEntorno }));
vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const { readFileSync } = await import("node:fs");
  const lista = real.leerModelosPermitidos(readFileSync(new URL("../../../fixtures/ia/modelos-ia-local-permitidos.ficticio.json", import.meta.url), "utf8"));
  return { ...real, LISTA_MODELOS_PI: lista };
});

import { POST as postConfig } from "@/app/api/ia/config/route";
import { POST as postOllama } from "@/app/api/ia/ollama/route";
import { reiniciarFrecuenciasIa } from "@/ia/config/frecuencia";

const ORIGEN = ORIGENES_DESARROLLO[0]!;
const DUENO = { ok: true, usuario: { id: "u-dueno-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" } };
const pedido = (ruta: string, cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request(`${ORIGEN}${ruta}`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGEN, ...cabeceras }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });

/** Una sonda espía: anota cada destino con que la llaman. */
function espia(conducta: "OK" | "INALCANZABLE" | "LANZA" = "OK"): SondaOllama & { readonly destinos: string[] } {
  const destinos: string[] = [];
  return {
    tipo: "DIRECTA",
    destinos,
    identificar: (destino) => {
      destinos.push(destino);
      if (conducta === "LANZA") return Promise.reject(new Error("valor-real-4613"));
      return Promise.resolve(conducta === "OK" ? { ok: true, modelos: [{ nombre: "qwen2.5:14b", tamanoBytes: 4613, digest: "4613a27c".repeat(8) }] } : { ok: false, motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" });
    },
    probar: (destino) => {
      destinos.push(destino);
      return Promise.resolve({ ok: true, latenciaMs: 41, smoke: "OK" });
    },
  };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  exigirDuenoApi.mockResolvedValue(DUENO);
  crearVersionConfigIa.mockResolvedValue({ version: 8 });
  leerConfigIa.mockResolvedValue(VIGENTE_FICTICIA);
  sondaDelEntorno.mockReturnValue(espia());
  reiniciarFrecuenciasIa();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const f of [exigirDuenoApi, crearVersionConfigIa, leerConfigIa, sondaDelEntorno]) f.mockReset();
});

const RUTAS = [
  ["/api/ia/config", postConfig, cuerpoFicticio()],
  ["/api/ia/ollama", postOllama, { accion: "identificar" }],
] as const;

describe.each(RUTAS)("POST %s · la protección de envío de /edicion/plan", (ruta, post, bien) => {
  it("otro origen: 403 sin mirar la sesión", async () => {
    const r = await post(pedido(ruta, bien, { origin: "https://otro.ejemplo.invalid" }));
    expect(r.status).toBe(403);
    expect(exigirDuenoApi).not.toHaveBeenCalled();
  });

  it("la familia (403) y sin sesión (401): la respuesta del guardián tal cual, sin leer la base ni la sonda", async () => {
    for (const estado of [403, 401]) {
      const respuesta = new Response(JSON.stringify({ error: "x" }), { status: estado });
      exigirDuenoApi.mockResolvedValueOnce({ ok: false, respuesta });
      expect(await post(pedido(ruta, bien))).toBe(respuesta);
    }
    expect(crearVersionConfigIa).not.toHaveBeenCalled();
    expect(leerConfigIa).not.toHaveBeenCalled();
  });

  it("un cuerpo que no es JSON: 400 sin caché", async () => {
    const r = await post(pedido(ruta, "{no es json"));
    expect(r.status).toBe(400);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/ia/config", () => {
  it("201 con la versión; el dominio recibe lo leído, el autor de la sesión y la última que vio el formulario", async () => {
    const r = await postConfig(pedido("/api/ia/config", cuerpoFicticio()));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ version: 8 });
    const [db, entrada, opciones] = crearVersionConfigIa.mock.calls[0]!;
    expect(db).toEqual({ soy: "la base" });
    expect(entrada).toMatchObject({ modo: "local-luego-nube", topeMicroUsd: 4_610_000n, modeloNube: "claude-sonnet-5-5" });
    expect(opciones).toEqual({ autorId: "u-dueno-4613", ultimaEsperada: 7 });
  });

  it("la nube sin tope: 400 con el campo y su código, sin escribir", async () => {
    const r = await postConfig(pedido("/api/ia/config", cuerpoFicticio({ modo: "nube", topeMensualUsd: "" })));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ codigo: "DATOS_INVALIDOS", campos: [{ campo: "topeMensualUsd", codigo: "TOPE_FALTA" }] });
    expect(crearVersionConfigIa).not.toHaveBeenCalled();
  });

  it("una clave de más (un autor o una llave): 400, el autor nunca sale del cuerpo", async () => {
    for (const extra of [{ autorId: "otro" }, { llave: "sk-ficticia" }]) expect((await postConfig(pedido("/api/ia/config", cuerpoFicticio(extra)))).status).toBe(400);
    expect(crearVersionConfigIa).not.toHaveBeenCalled();
  });

  it("otra versión en medio: 409 con el campo versionBase · CONFIG_CAMBIO", async () => {
    crearVersionConfigIa.mockRejectedValueOnce(new ErrorConfigIa("CONFIG_CAMBIO"));
    const r = await postConfig(pedido("/api/ia/config", cuerpoFicticio()));
    expect(r.status).toBe(409);
    expect((await r.json()).campos).toEqual([{ campo: "versionBase", codigo: "CONFIG_CAMBIO" }]);
  });

  it("un error inesperado: 500 genérico, sin su mensaje", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    crearVersionConfigIa.mockRejectedValueOnce(new Error("valor-real-4613"));
    const r = await postConfig(pedido("/api/ia/config", cuerpoFicticio()));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("valor-real-4613");
  });

  it("la lista de PI con la que valida es la que leyó la app (control positivo: un modelo fuera de la lista, 400)", async () => {
    expect(LISTA_FICTICIA.estado).toBe("LISTA");
    const tareas = { DIARIO: { activo: true, modeloLocal: "qwen2.5:32b" }, REGLAS: { activo: false, modeloLocal: "" }, ESCENARIOS: { activo: false, modeloLocal: "" } };
    const r = await postConfig(pedido("/api/ia/config", cuerpoFicticio({ tareas })));
    expect((await r.json()).campos).toContainEqual({ campo: "tareas.DIARIO.modeloLocal", codigo: "MODELO_FUERA_DE_LISTA" });
  });
});

describe("POST /api/ia/ollama · solo el destino guardado (I-24)", () => {
  it("un cuerpo que trae OTRO destino: la sonda usa el guardado (control positivo)", async () => {
    const s = espia();
    sondaDelEntorno.mockReturnValue(s);
    const otro = `http://${ip(100, 64, 3, 9)}:1`;
    const r = await postOllama(pedido("/api/ia/ollama", { accion: "identificar", destino: otro, ollamaHost: ip(100, 64, 3, 9), ollamaPuerto: "1" }));
    expect(r.status).toBe(200);
    expect(s.destinos).toEqual([DESTINO_FICTICIO]);
    expect(JSON.stringify(await r.json())).not.toContain(ip(100, 64, 3, 9));
  });

  it("identificar: 200 con los modelos marcados contra la lista de PI", async () => {
    const r = await postOllama(pedido("/api/ia/ollama", { accion: "identificar" }));
    expect(await r.json()).toEqual({
      accion: "identificar",
      resultado: { estado: "OK", modelos: [{ nombre: "qwen2.5:14b", tamanoBytes: 4613, digest: "4613a27c".repeat(8), enLista: true, digestCoincide: true, seleccionable: true, nota: "Recomendado para 008 (nota ficticia)" }] },
    });
  });

  it("probar: 200 con cada modelo de las tareas activas, en el destino guardado", async () => {
    const s = espia();
    sondaDelEntorno.mockReturnValue(s);
    const r = await postOllama(pedido("/api/ia/ollama", { accion: "probar" }));
    expect((await r.json()).resultado).toMatchObject({ estado: "OK", pruebas: [{ modelo: "qwen2.5:14b", ok: true }, { modelo: "gemma2:27b", ok: true }] });
    expect(new Set(s.destinos)).toEqual(new Set([DESTINO_FICTICIO]));
  });

  it("Ollama inalcanzable: 503 ESTRUCTURADO («Ollama inalcanzable»), nunca un 500", async () => {
    sondaDelEntorno.mockReturnValue(espia("INALCANZABLE"));
    const r = await postOllama(pedido("/api/ia/ollama", { accion: "identificar" }));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ accion: "identificar", error: "Ollama inalcanzable", resultado: { estado: "INALCANZABLE", detalle: "CONEXION_RECHAZADA" } });
  });

  it("una sonda que lanza: 502 estructurado y genérico, sin su mensaje", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sondaDelEntorno.mockReturnValue(espia("LANZA"));
    const r = await postOllama(pedido("/api/ia/ollama", { accion: "identificar" }));
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain("valor-real-4613");
  });

  it("sin destino guardado: 200 con SIN_DESTINO, sin llamar a la sonda", async () => {
    const s = espia();
    sondaDelEntorno.mockReturnValue(s);
    leerConfigIa.mockResolvedValueOnce(null);
    expect((await (await postOllama(pedido("/api/ia/ollama", { accion: "identificar" }))).json()).resultado).toEqual({ estado: "SIN_DESTINO" });
    expect(s.destinos).toEqual([]);
  });

  it("una acción que no es de la lista, o sin acción: 400", async () => {
    for (const c of [{ accion: "pull" }, {}, { accion: 4613 }]) expect((await postOllama(pedido("/api/ia/ollama", c))).status).toBe(400);
  });

  it("un pedido cada pocos segundos por usuario: el segundo, 429 con Retry-After, sin llamar a la sonda", async () => {
    const s = espia();
    sondaDelEntorno.mockReturnValue(s);
    expect((await postOllama(pedido("/api/ia/ollama", { accion: "identificar" }))).status).toBe(200);
    const r = await postOllama(pedido("/api/ia/ollama", { accion: "probar" }));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(s.destinos).toEqual([DESTINO_FICTICIO]);
  });

  it("guardar también tiene su límite de frecuencia por usuario", async () => {
    expect((await postConfig(pedido("/api/ia/config", cuerpoFicticio()))).status).toBe(201);
    expect((await postConfig(pedido("/api/ia/config", cuerpoFicticio()))).status).toBe(429);
  });
});
