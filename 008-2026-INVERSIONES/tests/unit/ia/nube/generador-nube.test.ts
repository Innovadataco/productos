/**
 * `crearGeneradorNube`: la puerta nube con el cliente del SDK inyectado (un doble), sin red ni llave real.
 * - Apagada sin llave o sin tope: PUERTA_APAGADA sin pedir el gasto ni construir el cliente.
 * - El tope del mes, antes de llamar: lo gastado + lo reservado + el costo máximo de esta llamada; «justo» cabe.
 * - La llamada exacta (cuerpo y opciones), y el `model` y el `usage` leídos.
 * - Los errores, traducidos sin rechazar nunca; y la reserva de lo que pudo cobrarse sin saberse.
 */
import { APIConnectionError, APIError, APIUserAbortError } from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoGeneracion, ResultadoGeneracion } from "@/ia/generador";
import { CODIGOS_APAGADO_NUBE, LlaveNube, TECHO_TOPE_MICRO_USD, type ConfigNube } from "@/ia/nube/config";
import { crearGeneradorNube, type DependenciasNube } from "@/ia/nube/generador-nube";
import { MODELO_NUBE, armarCuerpoNube } from "@/ia/nube/peticion";
import { costoMaximoMicroUsd, costoMicroUsd, type GastoDelMes } from "@/ia/nube/tope";
import { generarConPuertas } from "@/ia/puertas";
import { LIMITE_FICTICIO_MS } from "../apoyo/pedido.ficticio";
import { crearClienteDoble, type ConductaCliente } from "./apoyo/cliente-doble";
import {
  GASTO_FICTICIO, LLAVE_FICTICIA, MENSAJE_DEL_PROVEEDOR, OTRO_MES_FICTICIO, SALIDA_FICTICIA, cuerpoErrorFicticio, mensajeFicticio, pedidoFicticio,
} from "./apoyo/datos.ficticio";
import { fetchProhibido } from "./apoyo/fetch-falso";

const LLAVE = LlaveNube.desdeTexto(LLAVE_FICTICIA) as LlaveNube;
const configLista = (topeMicroUsd: bigint): ConfigNube => ({ lista: true, llave: LLAVE, topeMicroUsd });
const viva = (): AbortSignal => new AbortController().signal;

function armadoDe(pedido: PedidoGeneracion) {
  const armado = armarCuerpoNube(pedido);
  if (!armado.ok) throw new Error(armado.detalle);
  return armado;
}

const GASTADO = costoMicroUsd(GASTO_FICTICIO);
const MAXIMO = costoMaximoMicroUsd(armadoDe(pedidoFicticio().pedido).json, 8192);
const JUSTO = GASTADO + MAXIMO;

interface Montaje {
  readonly generador: ReturnType<typeof crearGeneradorNube>;
  readonly doble: ReturnType<typeof crearClienteDoble>;
  readonly gastoDelMes: ReturnType<typeof vi.fn<() => Promise<GastoDelMes>>>;
}

function montar(config: ConfigNube, conducta: ConductaCliente = () => Promise.resolve(mensajeFicticio()), extra: Partial<DependenciasNube> = {}): Montaje {
  const doble = crearClienteDoble(conducta);
  const gastoDelMes = vi.fn(() => Promise.resolve<GastoDelMes>(GASTO_FICTICIO));
  const generador = crearGeneradorNube(config, { gastoDelMes, crearCliente: doble.crearCliente, ...extra });
  return { generador, doble, gastoDelMes };
}

const generar = (m: Montaje, pedido: PedidoGeneracion = pedidoFicticio().pedido, senal: AbortSignal = viva()): Promise<ResultadoGeneracion> => m.generador.generar(pedido, senal);
const fallo = (motivo: string, detalle: string) => ({ ok: false, puerta: "nube", motivo, detalle });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchProhibido());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apagada: sin intentar nada", () => {
  it.each(CODIGOS_APAGADO_NUBE.filter((c) => c !== "CLIENTE_NO_CONSTRUIDO"))("configuración no lista (%s) → PUERTA_APAGADA, sin gasto ni cliente", async (detalle) => {
    const m = montar({ lista: false, detalle });
    expect(await generar(m)).toEqual(fallo("PUERTA_APAGADA", detalle));
    expect(m.gastoDelMes).not.toHaveBeenCalled();
    expect(m.doble.construcciones()).toHaveLength(0);
    expect(m.doble.llamadas()).toHaveLength(0);
  });

  it.each([
    ["una llave imitada", { lista: true, llave: { revelar: () => LLAVE_FICTICIA }, topeMicroUsd: JUSTO }, "LLAVE_INVALIDA"],
    ["un tope cero", { lista: true, llave: LLAVE, topeMicroUsd: 0n }, "TOPE_INVALIDO"],
    ["un tope negativo", { lista: true, llave: LLAVE, topeMicroUsd: -4613n }, "TOPE_INVALIDO"],
    ["un tope en número", { lista: true, llave: LLAVE, topeMicroUsd: 4613 }, "TOPE_INVALIDO"],
    ["un tope sobre el techo", { lista: true, llave: LLAVE, topeMicroUsd: TECHO_TOPE_MICRO_USD + 1n }, "TOPE_FUERA_DE_RANGO"],
    ["una configuración nula", null, "SIN_LLAVE"],
    ["un detalle que no es de la lista", { lista: false, detalle: "FICTICIA_ALFA" }, "SIN_LLAVE"],
  ])("%s → PUERTA_APAGADA · %s", async (_caso, config, detalle) => {
    const m = montar(config as unknown as ConfigNube);
    expect(await generar(m)).toEqual(fallo("PUERTA_APAGADA", detalle));
    expect(m.gastoDelMes).not.toHaveBeenCalled();
    expect(m.doble.construcciones()).toHaveLength(0);
  });

  it("si el SDK no se deja construir → PUERTA_APAGADA · CLIENTE_NO_CONSTRUIDO, sin gasto", async () => {
    const gastoDelMes = vi.fn(() => Promise.resolve(GASTO_FICTICIO));
    const generador = crearGeneradorNube(configLista(JUSTO), { gastoDelMes, crearCliente: () => { throw new Error(LLAVE_FICTICIA); } });
    const resultado = await generador.generar(pedidoFicticio().pedido, viva());
    expect(resultado).toEqual(fallo("PUERTA_APAGADA", "CLIENTE_NO_CONSTRUIDO"));
    expect(JSON.stringify(resultado)).not.toContain(LLAVE_FICTICIA);
    expect(gastoDelMes).not.toHaveBeenCalled();
  });

  it("el generador es de la puerta nube, congelado, con solo puerta y generar", () => {
    const { generador } = montar({ lista: false, detalle: "SIN_LLAVE" });
    expect(generador.puerta).toBe("nube");
    expect(Object.keys(generador).sort()).toEqual(["generar", "puerta"]);
    expect(Object.isFrozen(generador)).toBe(true);
    expect(JSON.stringify(montar(configLista(JUSTO)).generador)).toBe('{"puerta":"nube"}');
  });

  it("por generarConPuertas, sin llave: FALLO con PUERTA_APAGADA · SIN_LLAVE", async () => {
    const { paquete, pedido } = pedidoFicticio();
    const m = montar({ lista: false, detalle: "SIN_LLAVE" });
    expect(await generarConPuertas([m.generador], "nube", pedido, paquete)).toEqual({ estado: "FALLO", ok: false, fallos: [fallo("PUERTA_APAGADA", "SIN_LLAVE")] });
  });
});

describe("la llamada y la respuesta", () => {
  it("construye el cliente UNA vez, con la llave y el fetch base, y llama con el cuerpo armado y las opciones exactas", async () => {
    const fetchBase = vi.fn() as unknown as typeof fetch;
    const m = montar(configLista(JUSTO), undefined, { fetch: fetchBase });
    const { pedido } = pedidoFicticio();
    const senal = viva();
    await m.generador.generar(pedido, senal);
    await m.generador.generar(pedido, senal);
    expect(m.doble.construcciones()).toHaveLength(1);
    const [construccion] = m.doble.construcciones();
    expect(LlaveNube.es(construccion?.llave)).toBe(true);
    expect(construccion?.llave.revelar()).toBe(LLAVE_FICTICIA);
    expect(construccion?.fetchBase).toBe(fetchBase);
    const [llamada] = m.doble.llamadas();
    expect(llamada?.cuerpo).toEqual(armadoDe(pedido).cuerpo);
    expect(llamada?.opciones).toEqual({ signal: senal, timeout: LIMITE_FICTICIO_MS, maxRetries: 0 });
    expect(llamada?.opciones.signal).toBe(senal);
  });

  it("sin fetch inyectado, el fetch base es el global", () => {
    const m = montar(configLista(JUSTO));
    expect(m.doble.construcciones()[0]?.fetchBase).toBe(globalThis.fetch);
  });

  it("el éxito trae la salida, el modelo, el model de la respuesta, los tokens de usage y la latencia del reloj", async () => {
    const tiempos = [1000, 1317];
    const m = montar(configLista(JUSTO), () => Promise.resolve(mensajeFicticio({ model: "claude-opus-5-5-ficticio" })), { ahora: () => tiempos.shift() ?? 0 });
    expect(await generar(m)).toEqual({
      ok: true, puerta: "nube", salidaCruda: SALIDA_FICTICIA, modelo: MODELO_NUBE, modeloDigest: "claude-opus-5-5-ficticio", latenciaMs: 317, tokensEntrada: 5561, tokensSalida: 379,
    });
  });

  it("una respuesta que no es un Message → ERROR_PROVEEDOR · RESPUESTA_INVALIDA", async () => {
    const m = montar(configLista(JUSTO), () => Promise.resolve("texto plano"));
    expect(await generar(m)).toEqual(fallo("ERROR_PROVEEDOR", "RESPUESTA_INVALIDA"));
  });
});

describe("el tope del mes, antes de llamar", () => {
  it("debajo del tope: llama", async () => {
    const m = montar(configLista(JUSTO + 4613n));
    expect(await generar(m)).toMatchObject({ ok: true });
    expect(m.doble.llamadas()).toHaveLength(1);
  });

  it("justo en el tope: llama", async () => {
    const m = montar(configLista(JUSTO));
    expect(await generar(m)).toMatchObject({ ok: true });
    expect(m.doble.llamadas()).toHaveLength(1);
  });

  it("un micro-USD encima: TOPE_MENSUAL · TOPE_DEL_MES, sin llamar", async () => {
    const m = montar(configLista(JUSTO - 1n));
    expect(await generar(m)).toEqual(fallo("TOPE_MENSUAL", "TOPE_DEL_MES"));
    expect(m.gastoDelMes).toHaveBeenCalledTimes(1);
    expect(m.doble.llamadas()).toHaveLength(0);
  });

  it.each([
    ["rechaza", () => Promise.reject(new Error(MENSAJE_DEL_PROVEEDOR))],
    ["lanza en la llamada", () => { throw new Error(MENSAJE_DEL_PROVEEDOR); }],
    ["devuelve algo inválido", () => Promise.resolve({ tokensEntrada: -1, tokensSalida: 4613 })],
    ["devuelve sin mes", () => Promise.resolve({ tokensEntrada: 37911, tokensSalida: 4613 })],
    ["devuelve undefined", () => Promise.resolve(undefined)],
  ])("si el gasto %s: TOPE_MENSUAL · GASTO_NO_VERIFICABLE, sin llamar", async (_caso, gastoDelMes) => {
    const doble = crearClienteDoble(() => Promise.resolve(mensajeFicticio()));
    const generador = crearGeneradorNube(configLista(TECHO_TOPE_MICRO_USD), { gastoDelMes: gastoDelMes as () => Promise<GastoDelMes>, crearCliente: doble.crearCliente });
    expect(await generador.generar(pedidoFicticio().pedido, viva())).toEqual(fallo("TOPE_MENSUAL", "GASTO_NO_VERIFICABLE"));
    expect(doble.llamadas()).toHaveLength(0);
  });

  it("si el gasto se cuelga y la señal se aborta: TIEMPO_AGOTADO · ABORTADO, sin llamar (y el rechazo tardío no queda suelto)", async () => {
    let rechazar!: (e: unknown) => void;
    const doble = crearClienteDoble(() => Promise.resolve(mensajeFicticio()));
    const generador = crearGeneradorNube(configLista(TECHO_TOPE_MICRO_USD), {
      gastoDelMes: () => new Promise((_si, no) => { rechazar = no; }),
      crearCliente: doble.crearCliente,
    });
    const control = new AbortController();
    const promesa = generador.generar(pedidoFicticio().pedido, control.signal);
    control.abort();
    expect(await promesa).toEqual(fallo("TIEMPO_AGOTADO", "ABORTADO"));
    rechazar(new Error("tarde"));
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(doble.llamadas()).toHaveLength(0);
  });

  it("con la señal ya abortada: TIEMPO_AGOTADO · ABORTADO, sin pedir el gasto", async () => {
    const m = montar(configLista(JUSTO));
    expect(await generar(m, pedidoFicticio().pedido, AbortSignal.abort())).toEqual(fallo("TIEMPO_AGOTADO", "ABORTADO"));
    expect(m.gastoDelMes).not.toHaveBeenCalled();
  });
});

describe("un pedido que no debe salir: falla sin gasto ni llamada", () => {
  const base = (): PedidoGeneracion => pedidoFicticio().pedido;
  it.each([
    ["PEDIDO_INVALIDO", (p: PedidoGeneracion) => ({ ...p, limiteMs: 0 })],
    ["VISTA_NO_CIEGA", (p: PedidoGeneracion) => ({ ...p, vista: { ...p.vista, hoy: "x" } })],
    ["ESQUEMA_NO_ADMITIDO", (p: PedidoGeneracion) => ({ ...p, esquemaSalida: { type: "object", properties: { frases: {} } } })],
  ])("%s", async (detalle, mutar) => {
    const m = montar(configLista(JUSTO));
    expect(await generar(m, mutar(base()) as unknown as PedidoGeneracion)).toEqual(fallo("ERROR_PROVEEDOR", detalle));
    expect(m.gastoDelMes).not.toHaveBeenCalled();
    expect(m.doble.llamadas()).toHaveLength(0);
  });
});

describe("los errores del cliente, sin rechazar nunca", () => {
  const deEstado = (estado: number, tipo: string): APIError => APIError.generate(estado, cuerpoErrorFicticio(tipo), undefined, new Headers());

  it.each([
    ["un 529 rechazado", () => Promise.reject(deEstado(529, "overloaded_error")), "MODELO_NO_DISPONIBLE", "SOBRECARGA"],
    ["un 401 rechazado", () => Promise.reject(deEstado(401, "authentication_error")), "ERROR_PROVEEDOR", "NO_AUTORIZADO"],
    ["un aborto", () => Promise.reject(new APIUserAbortError()), "TIEMPO_AGOTADO", "ABORTADO"],
    ["una excepción en la llamada misma", () => { throw new Error(`${MENSAJE_DEL_PROVEEDOR} ${LLAVE_FICTICIA}`); }, "ERROR_PROVEEDOR", "EXCEPCION_INTERNA"],
  ])("%s → %s · %s", async (_caso, conducta, motivo, detalle) => {
    const m = montar(configLista(JUSTO), conducta);
    const resultado = await generar(m);
    expect(resultado).toEqual(fallo(motivo, detalle));
    expect(JSON.stringify(resultado)).not.toContain(LLAVE_FICTICIA);
    expect(JSON.stringify(resultado)).not.toContain("secreto");
  });
});

describe("la reserva: lo que pudo cobrarse sin saberse cuenta en el tope del mismo mes", () => {
  const TOPE_DOS_MENOS_UNO = GASTADO + 2n * MAXIMO - 1n;

  it.each([
    ["un aborto en vuelo", () => Promise.reject(new APIUserAbortError())],
    ["una conexión cortada", () => Promise.reject(new APIConnectionError({ cause: new TypeError("fetch failed") }))],
    ["un 200 ilegible", () => Promise.resolve("texto plano")],
  ])("después de %s, la siguiente no cabe con un micro-USD de menos y sí con el justo", async (_caso, primera) => {
    const conducta: ConductaCliente = (_l, indice) => (indice === 0 ? primera() : Promise.resolve(mensajeFicticio()));
    const corto = montar(configLista(TOPE_DOS_MENOS_UNO), conducta);
    await generar(corto);
    expect(await generar(corto)).toEqual(fallo("TOPE_MENSUAL", "TOPE_DEL_MES"));
    expect(corto.doble.llamadas()).toHaveLength(1);
    const justo = montar(configLista(TOPE_DOS_MENOS_UNO + 1n), conducta);
    await generar(justo);
    expect(await generar(justo)).toMatchObject({ ok: true });
    expect(justo.doble.llamadas()).toHaveLength(2);
  });

  it.each([
    ["un 400 (respuesta HTTP de error: no se cobra)", () => Promise.reject(APIError.generate(400, cuerpoErrorFicticio("invalid_request_error"), undefined, new Headers()))],
    ["un 529", () => Promise.reject(APIError.generate(529, cuerpoErrorFicticio("overloaded_error"), undefined, new Headers()))],
    ["un éxito (sus tokens los cuenta el registro)", () => Promise.resolve(mensajeFicticio())],
  ])("después de %s no hay reserva", async (_caso, primera) => {
    const conducta: ConductaCliente = (_l, indice) => (indice === 0 ? primera() : Promise.resolve(mensajeFicticio()));
    const m = montar(configLista(TOPE_DOS_MENOS_UNO), conducta);
    await generar(m);
    expect(await generar(m)).toMatchObject({ ok: true });
  });

  it("la reserva es del mes: en el mes siguiente no cuenta", async () => {
    const meses = [GASTO_FICTICIO, { ...GASTO_FICTICIO, mes: OTRO_MES_FICTICIO }];
    const doble = crearClienteDoble((_l, indice) => (indice === 0 ? Promise.reject(new APIUserAbortError()) : Promise.resolve(mensajeFicticio())));
    const generador = crearGeneradorNube(configLista(TOPE_DOS_MENOS_UNO), { gastoDelMes: () => Promise.resolve(meses.shift() ?? GASTO_FICTICIO), crearCliente: doble.crearCliente });
    await generador.generar(pedidoFicticio().pedido, viva());
    expect(await generador.generar(pedidoFicticio().pedido, viva())).toMatchObject({ ok: true });
  });
});
