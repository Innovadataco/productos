/**
 * El pedido HTTP de la puerta local, con un `fetch` falso: método y cabeceras fijos, sin seguir redirecciones, cuerpo
 * con tope de bytes leído por flujo, UTF-8 estricto y JSON. Cada fallo vuelve clasificado (nunca lanza) y sin datos del
 * proveedor:
 * - aborto (límite o señal) → TIEMPO_AGOTADO;
 * - conexión rechazada, fallo de red o corte a mitad del cuerpo → MODELO_NO_DISPONIBLE;
 * - estado que no es 2xx, cuerpo grande o inválido → ERROR_PROVEEDOR.
 */
import { afterEach, describe, expect, it } from "vitest";
import { BYTES_MAXIMOS_GENERAR, BYTES_MAXIMOS_TAGS, pedirJsonLocal, type PeticionLocal } from "@/ia/local/http";
import { abrirPlazo, type Plazo } from "@/ia/local/plazo";
import { bytes, conexionRechazada, crearOllamaFalso, diferido, flujoVigilado, hostInalcanzable, json, respuestaCruda, vigilarFalsos, type RespuestaFalsa } from "./apoyo/ollama-falso";
import { URL_GENERAR, URL_TAGS } from "./apoyo/red.ficticio";

vigilarFalsos();

const TOPE = 4613;
const GET: PeticionLocal = { method: "GET" };
const POST: PeticionLocal = { method: "POST", body: '{"model":"ficticio-local:7b"}' };
const abiertos: Plazo[] = [];

afterEach(() => {
  for (const plazo of abiertos) plazo.cerrar();
  abiertos.length = 0;
});

function plazo(afuera?: AbortSignal): Plazo {
  const p = abrirPlazo(afuera, 37_911);
  abiertos.push(p);
  return p;
}

async function pedir(respuesta: RespuestaFalsa, peticion: PeticionLocal = GET, url = URL_TAGS, tope = TOPE) {
  const falso = crearOllamaFalso(() => respuesta);
  const resultado = await pedirJsonLocal(falso.fetch, url, peticion, tope, plazo());
  return { resultado, falso };
}

describe("pedirJsonLocal · lo que manda", () => {
  it("GET: método, cabecera accept, sin cuerpo, redirect manual y la señal del plazo", async () => {
    const falso = crearOllamaFalso(() => json({ models: [] }));
    const p = plazo();
    const resultado = await pedirJsonLocal(falso.fetch, URL_TAGS, GET, TOPE, p);
    expect(resultado).toEqual({ ok: true, datos: { models: [] } });
    const [llamada] = falso.llamadas();
    expect(falso.llamadas()).toHaveLength(1);
    expect(llamada).toMatchObject({ url: URL_TAGS, method: "GET", headers: { accept: "application/json" }, body: undefined, redirect: "manual" });
    expect(llamada?.signal).toBe(p.senal);
  });

  it("POST: el cuerpo tal cual y content-type JSON", async () => {
    const { resultado, falso } = await pedir(json({ done: true }), POST, URL_GENERAR);
    expect(resultado).toEqual({ ok: true, datos: { done: true } });
    expect(falso.llamadas()[0]).toMatchObject({ method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: POST.method === "POST" ? POST.body : "" });
  });

  it("los topes por ruta tienen nombre y el de generate es mayor que el de tags", () => {
    expect(BYTES_MAXIMOS_TAGS).toBe(262_144);
    expect(BYTES_MAXIMOS_GENERAR).toBe(1_048_576);
  });
});

describe("pedirJsonLocal · red", () => {
  it("conexión rechazada (nadie escucha en el puerto) → MODELO_NO_DISPONIBLE CONEXION_RECHAZADA", async () => {
    const { resultado } = await pedir({ tipo: "RECHAZAR", error: conexionRechazada() });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA" });
  });

  it.each([
    ["host inalcanzable", hostInalcanzable()],
    ["un TypeError sin causa", new TypeError("fetch failed")],
    ["una causa que no es objeto", new TypeError("fetch failed", { cause: "ECONNREFUSED" })],
  ])("%s → MODELO_NO_DISPONIBLE FALLO_DE_RED", async (_n, error) => {
    const { resultado } = await pedir({ tipo: "RECHAZAR", error });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "FALLO_DE_RED" });
  });

  it.each([
    ["un Error que no es TypeError", new Error("defecto propio FICTICIA-ALFA")],
    ["un RangeError", new RangeError("defecto propio")],
    ["algo que no es un Error", "ficticio"],
    ["null", null],
  ])("un rechazo que no es de red (%s) es un defecto del cliente → ERROR_PROVEEDOR EXCEPCION_INTERNA", async (_n, error) => {
    const { resultado } = await pedir({ tipo: "RECHAZAR", error });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "EXCEPCION_INTERNA" });
  });

  it("un fetch que lanza en la llamada misma (el estándar nunca lo hace) → ERROR_PROVEEDOR EXCEPCION_INTERNA, sin lanzar", async () => {
    const { resultado } = await pedir({ tipo: "LANZAR", error: new TypeError("síncrono FICTICIA-ALFA") });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "EXCEPCION_INTERNA" });
  });

  it("el flujo se corta a mitad del cuerpo → MODELO_NO_DISPONIBLE CONEXION_CORTADA", async () => {
    const f = flujoVigilado([bytes('{"models":[')], "FALLAR");
    const { resultado } = await pedir({ tipo: "FLUJO", flujo: f.flujo });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_CORTADA" });
  });
});

describe("pedirJsonLocal · estados HTTP (se mira el estado, no `ok`)", () => {
  it.each([
    [301, "HTTP_REDIRECCION"], [302, "HTTP_REDIRECCION"], [307, "HTTP_REDIRECCION"], [308, "HTTP_REDIRECCION"],
    [403, "HTTP_PROHIBIDO"], [404, "HTTP_NO_ENCONTRADO"],
    [400, "HTTP_ERROR_CLIENTE"], [405, "HTTP_ERROR_CLIENTE"], [429, "HTTP_ERROR_CLIENTE"],
    [500, "HTTP_ERROR_SERVIDOR"], [502, "HTTP_ERROR_SERVIDOR"], [503, "HTTP_ERROR_SERVIDOR"],
  ] as const)("%i → ERROR_PROVEEDOR %s, con el cuerpo cancelado sin leer", async (estado, detalle) => {
    const f = flujoVigilado([bytes('{"error":"FICTICIA-ALFA 4613.27"}')]);
    const { resultado, falso } = await pedir({ tipo: "FLUJO", flujo: f.flujo, estado });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle });
    expect(falso.llamadas()).toHaveLength(1);
    expect(f.cancelado()).toBe(true);
    expect(f.leido()).toBe(false);
    expect(JSON.stringify(resultado)).not.toMatch(/FICTICIA|4613/);
  });

  it.each([0, 199, 600, 1.5, -200, Number.NaN, "200"])("estado %s → ERROR_PROVEEDOR HTTP_ESTADO_INVALIDO", async (estado) => {
    const { resultado } = await pedir({ tipo: "CRUDA", respuesta: respuestaCruda(estado, { ok: true }) });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "HTTP_ESTADO_INVALIDO" });
  });

  it("un 500 que dice ok:true sigue siendo un error del servidor", async () => {
    const { resultado } = await pedir({ tipo: "CRUDA", respuesta: respuestaCruda(500, { ok: true, cuerpo: flujoVigilado([bytes("{}")]).flujo }) });
    expect(resultado).toMatchObject({ ok: false, detalle: "HTTP_ERROR_SERVIDOR" });
  });

  it("un 200 que dice ok:false se lee (manda el estado)", async () => {
    const { resultado } = await pedir({ tipo: "CRUDA", respuesta: respuestaCruda(200, { ok: false, cuerpo: flujoVigilado([bytes('{"a":true}')]).flujo }) });
    expect(resultado).toEqual({ ok: true, datos: { a: true } });
  });

  it("cancelar un cuerpo que rechaza no hace lanzar", async () => {
    const f = flujoVigilado([bytes("{}")], "TERMINAR", true);
    const { resultado } = await pedir({ tipo: "FLUJO", flujo: f.flujo, estado: 503 });
    expect(resultado).toMatchObject({ ok: false, detalle: "HTTP_ERROR_SERVIDOR" });
  });
});

describe("pedirJsonLocal · el cuerpo", () => {
  it("un content-length mayor que el tope se rechaza sin leer y se cancela", async () => {
    const f = flujoVigilado([bytes("{}")]);
    const { resultado } = await pedir({ tipo: "FLUJO", flujo: f.flujo, encabezados: { "content-length": String(TOPE + 1) } });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "CUERPO_DEMASIADO_GRANDE" });
    expect(f.leido()).toBe(false);
    expect(f.cancelado()).toBe(true);
  });

  it("trozos que pasan el tope cortan la lectura y cancelan el flujo", async () => {
    const trozo = bytes(`"${"x".repeat(1237)}"`);
    const f = flujoVigilado([trozo, trozo, trozo, trozo], "COLGAR");
    const { resultado } = await pedir({ tipo: "FLUJO", flujo: f.flujo });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "CUERPO_DEMASIADO_GRANDE" });
    expect(f.cancelado()).toBe(true);
  });

  it("un cuerpo de exactamente el tope se acepta", async () => {
    const texto = `"${"y".repeat(TOPE - 2)}"`;
    const { resultado } = await pedir({ tipo: "TEXTO", texto });
    expect(resultado).toEqual({ ok: true, datos: "y".repeat(TOPE - 2) });
  });

  it("un content-length que no es número no frena la lectura (manda el tope del flujo)", async () => {
    const { resultado } = await pedir({ tipo: "TEXTO", texto: '{"b":false}', encabezados: { "content-length": "ficticio" } });
    expect(resultado).toEqual({ ok: true, datos: { b: false } });
  });

  it.each([
    ["JSON inválido con datos del proveedor", bytes("FICTICIA-ALFA 4613.27 no es JSON")],
    ["vacío", bytes("")],
    ["UTF-8 inválido", new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d])],
  ])("%s → ERROR_PROVEEDOR CUERPO_INVALIDO, sin repetir el cuerpo", async (_n, contenido) => {
    const { resultado } = await pedir({ tipo: "FLUJO", flujo: flujoVigilado([contenido]).flujo });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "CUERPO_INVALIDO" });
    expect(JSON.stringify(resultado)).not.toMatch(/FICTICIA|4613/);
  });

  it("un 200 sin cuerpo → ERROR_PROVEEDOR CUERPO_INVALIDO", async () => {
    const { resultado } = await pedir({ tipo: "CRUDA", respuesta: respuestaCruda(200, { ok: true, cuerpo: null }) });
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "CUERPO_INVALIDO" });
  });
});

describe("pedirJsonLocal · el plazo", () => {
  it("la señal se aborta mientras el fetch (que la ignora) no responde → TIEMPO_AGOTADO con la causa del plazo", async () => {
    const afuera = new AbortController();
    const falso = crearOllamaFalso(() => ({ tipo: "COLGAR" }));
    const espera = pedirJsonLocal(falso.fetch, URL_TAGS, GET, TOPE, plazo(afuera.signal));
    afuera.abort();
    await expect(espera).resolves.toEqual({ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
  });

  it("con el plazo ya abortado no llama al fetch", async () => {
    const afuera = new AbortController();
    afuera.abort();
    const falso = crearOllamaFalso(() => json({}));
    const resultado = await pedirJsonLocal(falso.fetch, URL_TAGS, GET, TOPE, plazo(afuera.signal));
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("un rechazo del fetch que llega después del aborto es TIEMPO_AGOTADO, no un fallo de red", async () => {
    const afuera = new AbortController();
    const llega = diferido<never>();
    const falso = crearOllamaFalso(() => ({ tipo: "PROMESA", promesa: llega.promesa }));
    const espera = pedirJsonLocal(falso.fetch, URL_TAGS, GET, TOPE, plazo(afuera.signal));
    await Promise.resolve();
    afuera.abort();
    llega.rechazar(new DOMException("This operation was aborted", "AbortError"));
    await expect(espera).resolves.toMatchObject({ motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
  });

  it("el cuerpo colgado se corta con el aborto y el flujo se cancela", async () => {
    const afuera = new AbortController();
    const f = flujoVigilado([bytes('{"models":')], "COLGAR");
    const falso = crearOllamaFalso(() => ({ tipo: "FLUJO", flujo: f.flujo }));
    const espera = pedirJsonLocal(falso.fetch, URL_TAGS, GET, TOPE, plazo(afuera.signal));
    await new Promise((r) => setTimeout(r, 7));
    afuera.abort();
    await expect(espera).resolves.toMatchObject({ motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
    expect(f.cancelado()).toBe(true);
  });

  it("una respuesta que llega después del aborto se cancela sin leerla", async () => {
    const afuera = new AbortController();
    const llega = diferido<Response>();
    const falso = crearOllamaFalso(() => ({ tipo: "PROMESA", promesa: llega.promesa }));
    const espera = pedirJsonLocal(falso.fetch, URL_TAGS, GET, TOPE, plazo(afuera.signal));
    afuera.abort();
    await expect(espera).resolves.toMatchObject({ motivo: "TIEMPO_AGOTADO" });
    const f = flujoVigilado([bytes("{}")]);
    llega.resolver(new Response(f.flujo));
    await new Promise((r) => setTimeout(r, 7));
    expect(f.cancelado()).toBe(true);
    expect(f.leido()).toBe(false);
  });
});
