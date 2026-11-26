// La app hacia el servicio inv-008-ia para el botón «Analizar con IA»:
//  - la dirección del servicio sale de configuración (INV_IA_SERVICIO_URL), con la de siempre por omisión, y se VALIDA:
//    http, sin usuario ni ruta, un solo nombre de servicio (sin puntos: ni dominios ni IP de internet) y un puerto
//    alto; el bucle local (127.0.0.1) solo fuera de producción, para las pruebas con un servicio falso. Si no cuadra,
//    no se manda nada (falla cerrada);
//  - el cliente manda solo la tarea, con el token; no lanza; descarta lo que no tiene la forma del contrato.
import { describe, expect, it, vi } from "vitest";
import { clienteAnalisis, clienteAnalisisDelEntorno } from "@/ia/config/analisis-servicio";
import { sondaDelEntorno } from "@/ia/config/sonda-ollama";
import { ORIGEN_SERVICIO_IA, VARIABLE_ORIGEN_SERVICIO_IA, VARIABLE_TOKEN_SERVICIO_IA, leerOrigenServicioIa, reiniciarAvisosOrigenParaPruebas, sondaServicio, type BuscarServicio } from "@/ia/config/sonda-servicio";

const TOKEN = "t0ken-FICTICIO_".repeat(3);
const responder = (status: number, cuerpo: unknown): BuscarServicio => vi.fn(async () => ({ status, text: async () => (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) }));
const ESTADO = { enCurso: "DIARIO", enEspera: null, reintentarEnS: 0, ultimo: { tarea: "REGLAS", estado: "PUBLICADO" } };

describe("leerOrigenServicioIa · la dirección sale de configuración y se valida", () => {
  it("sin variable (o vacía): la de siempre, el servicio del compose", () => {
    expect(leerOrigenServicioIa({})).toEqual({ ok: true, origen: ORIGEN_SERVICIO_IA });
    expect(leerOrigenServicioIa({ [VARIABLE_ORIGEN_SERVICIO_IA]: "" })).toEqual({ ok: true, origen: ORIGEN_SERVICIO_IA });
    expect(ORIGEN_SERVICIO_IA).toBe("http://inv-008-ia:8008");
  });

  it.each([
    ["http://inv-008-ia:8008", "http://inv-008-ia:8008"],
    ["http://inv-008-ia:8008/", "http://inv-008-ia:8008"],
    ["http://inv-008-ia:9100", "http://inv-008-ia:9100"],
  ])("un valor permitido (%s) se usa", (valor, origen) => {
    expect(leerOrigenServicioIa({ NODE_ENV: "production", [VARIABLE_ORIGEN_SERVICIO_IA]: valor })).toEqual({ ok: true, origen });
  });

  it.each(["http://inv-008-db:5432", "http://ip6-localhost:8008", "http://otro-servicio-ia:9100", "http://inv-008-app:3000"])(
    "en producción solo vale el host inv-008-ia (lista cerrada): otro nombre de una sola etiqueta (%s) no se usa", (valor) => {
      const r = leerOrigenServicioIa({ NODE_ENV: "production", [VARIABLE_ORIGEN_SERVICIO_IA]: valor });
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r)).not.toContain(valor);
      if (!r.ok) expect(r.motivo).toContain("el nombre");
    });

  it("fuera de producción, otro nombre de servicio de una sola etiqueta sigue valiendo (el servicio falso de las pruebas)", () => {
    expect(leerOrigenServicioIa({ NODE_ENV: "development", [VARIABLE_ORIGEN_SERVICIO_IA]: "http://otro-servicio-ia:9100" })).toEqual({ ok: true, origen: "http://otro-servicio-ia:9100" });
  });

  it.each([
    "https://inv-008-ia:8008", "ftp://inv-008-ia:8008", "inv-008-ia:8008", "http://inv-008-ia", "http://inv-008-ia:80",
    "http://usuario:clave@inv-008-ia:8008", "http://inv-008-ia:8008/analizar", "http://inv-008-ia:8008/?a=1", "http://inv-008-ia:8008/#x",
    "http://ejemplo.invalid:8008", "http://api.ejemplo.invalid:8008", "http://10.0.0.5:8008", "http://169.254.169.254:8008", "http://[::1]:8008",
    "http://127.0.0.1:8008", "http://localhost:8008", "http://inv-008-ia:70000", "http://inv-008-ia:0", "http://INV_008_IA:8008", "no es una url", "http://inv-008-ia:8008 ", " http://inv-008-ia:8008",
  ])("en producción, un valor no permitido (%s) no se usa: falla cerrada", (valor) => {
    const r = leerOrigenServicioIa({ NODE_ENV: "production", [VARIABLE_ORIGEN_SERVICIO_IA]: valor });
    expect(r.ok).toBe(false);
  });

  it("el bucle local (127.0.0.1) solo fuera de producción: para el servicio falso de las pruebas", () => {
    const valor = "http://127.0.0.1:5973";
    expect(leerOrigenServicioIa({ NODE_ENV: "development", [VARIABLE_ORIGEN_SERVICIO_IA]: valor })).toEqual({ ok: true, origen: valor });
    expect(leerOrigenServicioIa({ NODE_ENV: "test", [VARIABLE_ORIGEN_SERVICIO_IA]: valor })).toEqual({ ok: true, origen: valor });
    expect(leerOrigenServicioIa({ NODE_ENV: "production", [VARIABLE_ORIGEN_SERVICIO_IA]: valor }).ok).toBe(false);
    expect(leerOrigenServicioIa({ NODE_ENV: "development", [VARIABLE_ORIGEN_SERVICIO_IA]: "http://127.0.0.2:5973" }).ok).toBe(false);
  });

  it("el motivo no repite el valor (podría traer una clave)", () => {
    const r = leerOrigenServicioIa({ NODE_ENV: "production", [VARIABLE_ORIGEN_SERVICIO_IA]: "http://usuario:clave-4613@x.invalid:8008" });
    expect(JSON.stringify(r)).not.toContain("clave-4613");
  });

  it("la sonda del entorno la usa: con un origen inválido queda PENDIENTE; con uno válido, la del servicio en esa dirección", async () => {
    expect(sondaDelEntorno({ NODE_ENV: "production", [VARIABLE_TOKEN_SERVICIO_IA]: TOKEN, [VARIABLE_ORIGEN_SERVICIO_IA]: "http://ejemplo.invalid:8008" }).tipo).toBe("PENDIENTE");
    expect(sondaDelEntorno({ NODE_ENV: "production", [VARIABLE_TOKEN_SERVICIO_IA]: TOKEN, [VARIABLE_ORIGEN_SERVICIO_IA]: "http://otro-servicio-ia:9100" }).tipo).toBe("PENDIENTE");
    expect(sondaDelEntorno({ NODE_ENV: "development", [VARIABLE_TOKEN_SERVICIO_IA]: TOKEN, [VARIABLE_ORIGEN_SERVICIO_IA]: "http://otro-servicio-ia:9100" }).tipo).toBe("SERVICIO");
    const buscar = responder(200, { ok: true, modelos: [] });
    await sondaServicio(buscar, TOKEN, "http://otro-servicio-ia:9100").identificar("http://x");
    expect(vi.mocked(buscar).mock.calls[0]![0]).toBe("http://otro-servicio-ia:9100/identificar");
  });
});

describe("una dirección inválida se registra (el motivo, sin el valor) una sola vez", () => {
  const entorno = (valor: string) => ({ NODE_ENV: "production", [VARIABLE_TOKEN_SERVICIO_IA]: TOKEN, [VARIABLE_ORIGEN_SERVICIO_IA]: valor });

  it("la sonda y el cliente de análisis registran el motivo, nunca el valor, y no repiten la línea", () => {
    reiniciarAvisosOrigenParaPruebas();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const valor = "http://usuario:clave-4613@inv-008-db:5432";
      expect(sondaDelEntorno(entorno(valor)).tipo).toBe("PENDIENTE");
      expect(clienteAnalisisDelEntorno(entorno(valor))).toBeNull();
      expect(clienteAnalisisDelEntorno(entorno(valor))).toBeNull();
      const lineas = error.mock.calls.map((c) => String(c[0]));
      expect(lineas).toHaveLength(1);
      expect(lineas[0]).toContain("INV_IA_SERVICIO_URL no es válida (trae usuario)");
      expect(lineas.join(" ")).not.toContain("clave-4613");
      expect(lineas.join(" ")).not.toContain("inv-008-db");
      // otro motivo, otra línea
      expect(clienteAnalisisDelEntorno(entorno("http://ip6-localhost:8008"))).toBeNull();
      expect(error.mock.calls).toHaveLength(2);
    } finally {
      error.mockRestore();
    }
  });
});

describe("clienteAnalisis", () => {
  it("pedir: POST /analizar con solo la tarea y el token; 202 es aceptado con su lugar", async () => {
    const buscar = responder(202, { estado: "ACEPTADO", lugar: "EN_ESPERA" });
    expect(await clienteAnalisis(buscar, TOKEN, ORIGEN_SERVICIO_IA).pedir("REGLAS")).toEqual({ ok: true, lugar: "EN_ESPERA" });
    const [url, init] = vi.mocked(buscar).mock.calls[0]!;
    expect(url).toBe(`${ORIGEN_SERVICIO_IA}/analizar`);
    expect(init).toMatchObject({ method: "POST", body: '{"tarea":"REGLAS"}', redirect: "error", headers: { authorization: `Bearer ${TOKEN}` } });
  });

  it.each([
    [403, { error: "ANALISIS_APAGADO" }, { ok: false, motivo: "ANALISIS_APAGADO" }],
    [409, { error: "TAREA_INACTIVA" }, { ok: false, motivo: "TAREA_INACTIVA" }],
    [429, { error: "OCUPADO" }, { ok: false, motivo: "OCUPADO" }],
    [429, { error: "ESPERA_MINIMA", reintentarEnS: 75 }, { ok: false, motivo: "ESPERA_MINIMA", reintentarEnS: 75 }],
    [401, { error: "NO_AUTORIZADO" }, { ok: false, motivo: "SERVICIO_TOKEN" }],
    [500, { error: "ERROR_INTERNO" }, { ok: false, motivo: "SERVICIO_NO_DISPONIBLE" }],
  ])("el estado %i del servicio con %j: %j", async (estado, cuerpo, esperado) => {
    expect(await clienteAnalisis(responder(estado, cuerpo), TOKEN, ORIGEN_SERVICIO_IA).pedir("DIARIO")).toEqual(esperado);
  });

  it.each([
    { estado: "ACEPTADO", lugar: "OTRO" }, "no es json", [], { estado: "ACEPTADO" },
  ])("una respuesta 202 con otra forma (%j) se descarta", async (cuerpo) => {
    expect(await clienteAnalisis(responder(202, cuerpo), TOKEN, ORIGEN_SERVICIO_IA).pedir("DIARIO")).toEqual({ ok: false, motivo: "RESPUESTA_INVALIDA" });
  });

  it.each([
    { error: "ESPERA_MINIMA", reintentarEnS: -1 }, { error: "ESPERA_MINIMA", reintentarEnS: "75" }, { error: "ESPERA_MINIMA" }, { error: "ESPERA_MINIMA", reintentarEnS: 99999 },
  ])("un 429 ESPERA_MINIMA con segundos que no valen (%j) se descarta", async (cuerpo) => {
    expect(await clienteAnalisis(responder(429, cuerpo), TOKEN, ORIGEN_SERVICIO_IA).pedir("DIARIO")).toEqual({ ok: false, motivo: "RESPUESTA_INVALIDA" });
  });

  it("el servicio no contesta: SERVICIO_NO_DISPONIBLE, sin excepción y sin el mensaje", async () => {
    const buscar: BuscarServicio = vi.fn(async () => { throw new TypeError("fetch failed 4613"); });
    const r = await clienteAnalisis(buscar, TOKEN, ORIGEN_SERVICIO_IA).pedir("DIARIO");
    expect(r).toEqual({ ok: false, motivo: "SERVICIO_NO_DISPONIBLE" });
    expect(JSON.stringify(r)).not.toContain("4613");
  });

  it("estado: POST /estado-analisis con cuerpo vacío; copia solo los campos del contrato", async () => {
    const buscar = responder(200, { ...ESTADO, extra: "no" });
    const r = await clienteAnalisis(buscar, TOKEN, ORIGEN_SERVICIO_IA).estado();
    expect(r).toEqual({ ok: true, estado: ESTADO });
    const [url, init] = vi.mocked(buscar).mock.calls[0]!;
    expect(url).toBe(`${ORIGEN_SERVICIO_IA}/estado-analisis`);
    expect(init.body).toBe("{}");
  });

  it.each([{ ...ESTADO, enCurso: "OTRA" }, { ...ESTADO, reintentarEnS: -3 }, { ...ESTADO, ultimo: { tarea: "DIARIO", estado: "con espacios" } }, "no es json", []])(
    "un estado con otra forma (%j) se descarta", async (cuerpo) => {
      expect(await clienteAnalisis(responder(200, cuerpo), TOKEN, ORIGEN_SERVICIO_IA).estado()).toEqual({ ok: false, motivo: "RESPUESTA_INVALIDA" });
    });

  it("del entorno: sin token, o con un origen inválido, no hay cliente (el botón no manda nada)", () => {
    expect(clienteAnalisisDelEntorno({ NODE_ENV: "production" })).toBeNull();
    expect(clienteAnalisisDelEntorno({ NODE_ENV: "production", [VARIABLE_TOKEN_SERVICIO_IA]: "corto" })).toBeNull();
    expect(clienteAnalisisDelEntorno({ NODE_ENV: "production", [VARIABLE_TOKEN_SERVICIO_IA]: TOKEN, [VARIABLE_ORIGEN_SERVICIO_IA]: "http://ejemplo.invalid:8008" })).toBeNull();
    expect(clienteAnalisisDelEntorno({ NODE_ENV: "production", [VARIABLE_TOKEN_SERVICIO_IA]: TOKEN })).not.toBeNull();
  });
});
