/**
 * Las dos puertas: el modo, el orden, el primer éxito o todos los fallos, la puerta sin generador, la excepción sin su
 * mensaje, el límite del orquestador y el resultado que no cumple el contrato. Con el generador falso, sin red.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaqueteHechos } from "@/ia/contrato";
import { ErrorPedido, armarPedido, type Generador, type PedidoGeneracion, type ResultadoGeneracion } from "@/ia/generador";
import { crearGeneradorFalso, type ConductaFalsa } from "@/ia/generador-falso";
import { construirPaquete } from "@/ia/paquete";
import { ErrorPuertas, MODOS_PUERTAS, generarConPuertas, leerModoPuertas, ordenDePuertas, type ModoPuertas } from "@/ia/puertas";
import { ESPECIE_ALFA, entradaDiario } from "./apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "./apoyo/pedido.ficticio";

const paquete = (): PaqueteHechos => construirPaquete(entradaDiario());
const pedidoDe = (p: PaqueteHechos, limiteMs = LIMITE_FICTICIO_MS): PedidoGeneracion => armarPedido({ paquete: p, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs });
const responder = (salidaCruda = '{"frases":[]}'): ConductaFalsa => ({ tipo: "RESPONDER", salidaCruda });
const fallar: ConductaFalsa = { tipo: "FALLAR", motivo: "MODELO_NO_DISPONIBLE", detalle: "SIN_RESPUESTA" };

async function correr(modo: ModoPuertas, local: ConductaFalsa | null, nube: ConductaFalsa | null) {
  const p = paquete();
  const falsos = {
    local: local === null ? null : crearGeneradorFalso({ puerta: "local", conducta: local }),
    nube: nube === null ? null : crearGeneradorFalso({ puerta: "nube", conducta: nube }),
  };
  const generadores = [falsos.local, falsos.nube].filter((g): g is NonNullable<typeof g> => g !== null);
  const resultado = await generarConPuertas(generadores, modo, pedidoDe(p), p);
  return { resultado, falsos };
}

describe("leerModoPuertas", () => {
  it("sin valor (o vacío) queda apagado: cerrado por omisión", () => {
    expect(leerModoPuertas(undefined)).toBe("apagado");
    expect(leerModoPuertas("")).toBe("apagado");
  });

  it.each(MODOS_PUERTAS)("acepta «%s»", (modo) => {
    expect(leerModoPuertas(modo)).toBe(modo);
  });

  it.each(["LOCAL", " local", "local ", "nube-luego-local", "ambas", "FICTICIA-ALFA"])("rechaza «%s» sin repetir el valor", (valor) => {
    expect(() => leerModoPuertas(valor)).toThrow(ErrorPuertas);
    try {
      leerModoPuertas(valor);
    } catch (e) {
      expect((e as ErrorPuertas).codigo).toBe("MODO_PUERTAS_INVALIDO");
      expect((e as Error).message).not.toContain(valor.trim() || "∅");
    }
  });

  it("la lista de modos es exacta y está congelada", () => {
    expect([...MODOS_PUERTAS]).toEqual(["apagado", "local", "nube", "local-luego-nube"]);
    expect(Object.isFrozen(MODOS_PUERTAS)).toBe(true);
  });
});

describe("ordenDePuertas", () => {
  it.each([
    ["apagado", []],
    ["local", ["local"]],
    ["nube", ["nube"]],
    ["local-luego-nube", ["local", "nube"]],
  ] as const)("%s → %j, congelado", (modo, orden) => {
    expect([...ordenDePuertas(modo)]).toEqual(orden);
    expect(Object.isFrozen(ordenDePuertas(modo))).toBe(true);
  });

  it("un modo que no es de la lista lanza", () => {
    expect(() => ordenDePuertas("otro" as ModoPuertas)).toThrow(ErrorPuertas);
  });
});

describe("generarConPuertas · orden y resultados", () => {
  it("local responde: es el éxito y la nube no se llama", async () => {
    const { resultado, falsos } = await correr("local-luego-nube", responder(), responder());
    expect(resultado).toMatchObject({ estado: "EXITO", ok: true, exito: { puerta: "local" }, fallosPrevios: [] });
    expect(falsos.local?.llamadas()).toHaveLength(1);
    expect(falsos.nube?.llamadas()).toHaveLength(0);
  });

  it("local falla y la nube responde: el éxito de la nube con el fallo previo de local", async () => {
    const { resultado, falsos } = await correr("local-luego-nube", fallar, responder());
    expect(resultado).toEqual({
      estado: "EXITO",
      ok: true,
      exito: expect.objectContaining({ ok: true, puerta: "nube" }),
      fallosPrevios: [{ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "SIN_RESPUESTA" }],
    });
    expect(falsos.local?.llamadas()).toHaveLength(1);
    expect(falsos.nube?.llamadas()).toHaveLength(1);
  });

  it("fallan las dos: todos los fallos, en orden", async () => {
    const { resultado } = await correr("local-luego-nube", fallar, { tipo: "FALLAR", motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES" });
    expect(resultado).toEqual({
      estado: "FALLO",
      ok: false,
      fallos: [
        { ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "SIN_RESPUESTA" },
        { ok: false, puerta: "nube", motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES" },
      ],
    });
  });

  it("apagado: ningún generador se llama y el estado lo dice (no es un fallo)", async () => {
    const { resultado, falsos } = await correr("apagado", responder(), responder());
    expect(resultado).toEqual({ estado: "APAGADO", ok: false });
    expect(falsos.local?.llamadas()).toHaveLength(0);
    expect(falsos.nube?.llamadas()).toHaveLength(0);
  });

  it("solo la puerta del modo se prueba", async () => {
    const { resultado, falsos } = await correr("nube", responder(), responder());
    expect(resultado).toMatchObject({ estado: "EXITO", ok: true, exito: { puerta: "nube" } });
    expect(falsos.local?.llamadas()).toHaveLength(0);
  });

  it("una puerta del orden sin generador es PUERTA_APAGADA, no una excepción", async () => {
    const { resultado, falsos } = await correr("local-luego-nube", null, responder());
    expect(resultado).toMatchObject({ estado: "EXITO", ok: true, exito: { puerta: "nube" }, fallosPrevios: [{ puerta: "local", motivo: "PUERTA_APAGADA", detalle: "SIN_GENERADOR" }] });
    expect(falsos.nube?.llamadas()).toHaveLength(1);
    const sinNinguno = await correr("nube", null, null);
    expect(sinNinguno.resultado).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "nube", motivo: "PUERTA_APAGADA", detalle: "SIN_GENERADOR" }] });
  });

  it.each([
    ["asíncrona", { tipo: "LANZAR", mensaje: `${ESPECIE_ALFA} 4613.27 secreto` }],
    ["síncrona", { tipo: "LANZAR", mensaje: `${ESPECIE_ALFA} 4613.27 secreto`, sincrono: true }],
  ] as const)("una excepción %s es ERROR_PROVEEDOR sin su mensaje, y se pasa a la siguiente puerta", async (_caso, lanzar) => {
    const { resultado } = await correr("local-luego-nube", lanzar, fallar);
    expect(resultado).toMatchObject({ estado: "FALLO", ok: false, fallos: [{ puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "EXCEPCION" }, { puerta: "nube" }] });
    const json = JSON.stringify(resultado);
    expect(json).not.toContain("secreto");
    expect(json).not.toContain(ESPECIE_ALFA);
    expect(json).not.toContain("4613");
  });

  it("el resultado y sus listas están congelados", async () => {
    const { resultado } = await correr("local-luego-nube", fallar, responder());
    expect(Object.isFrozen(resultado)).toBe(true);
    if (resultado.ok) expect(Object.isFrozen(resultado.fallosPrevios) && Object.isFrozen(resultado.exito) && Object.isFrozen(resultado.fallosPrevios[0])).toBe(true);
  });

  it("cada generador recibe una copia congelada del pedido, igual al revisado, con solo los campos del contrato", async () => {
    const p = paquete();
    const pedido = pedidoDe(p);
    const falso = crearGeneradorFalso({ puerta: "local", conducta: responder() });
    await generarConPuertas([falso], "local", pedido, p);
    const [recibido] = falso.llamadas();
    expect(recibido).toEqual(pedido);
    expect(recibido).not.toBe(pedido);
    expect(recibido?.vista).not.toBe(pedido.vista);
    expect(Object.isFrozen(recibido) && Object.isFrozen(recibido?.vista) && Object.isFrozen(recibido?.vista.hechos[0])).toBe(true);
    expect(Object.keys(recibido ?? {}).sort()).toEqual(["esquemaSalida", "limiteMs", "prompt", "vista"]);
  });
});

describe("generarConPuertas · límite del orquestador", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("un generador colgado se corta en el límite con TIEMPO_AGOTADO, la señal se aborta y no quedan temporizadores", async () => {
    vi.useFakeTimers();
    const p = paquete();
    let senal: AbortSignal | null = null;
    const colgado: Generador = { puerta: "local", generar: (_pedido, s) => { senal = s; return new Promise<ResultadoGeneracion>(() => undefined); } };
    const nube = crearGeneradorFalso({ puerta: "nube", conducta: responder("de la nube") });
    let resultado: unknown = null;
    const promesa = generarConPuertas([colgado, nube], "local-luego-nube", pedidoDe(p, 1237), p);
    void promesa.then((r) => { resultado = r; });
    await vi.advanceTimersByTimeAsync(1236);
    expect(resultado).toBeNull();
    expect((senal as AbortSignal | null)?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promesa).resolves.toMatchObject({ estado: "EXITO", ok: true, exito: { puerta: "nube", salidaCruda: "de la nube" }, fallosPrevios: [{ puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_ORQUESTADOR" }] });
    expect((senal as AbortSignal | null)?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("un generador que tarda más que el límite lo corta el orquestador; uno que tarda menos responde", async () => {
    vi.useFakeTimers();
    const p = paquete();
    const lento = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "TARDAR", ms: 1238, luego: { tipo: "RESPONDER", salidaCruda: "tarde" } } });
    const promesaLenta = generarConPuertas([lento], "local", pedidoDe(p, 1237), p);
    await vi.advanceTimersByTimeAsync(1237);
    await expect(promesaLenta).resolves.toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_ORQUESTADOR" }] });
    const rapido = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "TARDAR", ms: 1236, luego: { tipo: "RESPONDER", salidaCruda: "a tiempo" } } });
    const promesaRapida = generarConPuertas([rapido], "local", pedidoDe(p, 1237), p);
    await vi.advanceTimersByTimeAsync(1236);
    await expect(promesaRapida).resolves.toMatchObject({ estado: "EXITO", ok: true, exito: { salidaCruda: "a tiempo" } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("un rechazo que llega después del límite no queda sin manejar", async () => {
    vi.useFakeTimers();
    const p = paquete();
    const tardio: Generador = { puerta: "local", generar: () => new Promise((_resolver, rechazar) => setTimeout(() => rechazar(new Error("tarde")), 4613)) };
    const promesa = generarConPuertas([tardio], "local", pedidoDe(p, 1237), p);
    await vi.advanceTimersByTimeAsync(4613);
    await expect(promesa).resolves.toMatchObject({ estado: "FALLO", ok: false, fallos: [{ motivo: "TIEMPO_AGOTADO" }] });
  });
});

describe("generarConPuertas · resultados que no cumplen el contrato", () => {
  const exito = { ok: true, puerta: "local", salidaCruda: "x", modelo: "m-ficticio", modeloDigest: "d-ficticio", latenciaMs: 317, tokensEntrada: null, tokensSalida: 41 };

  it.each([
    ["nulo", null, "RESULTADO_INVALIDO"],
    ["un texto", "listo", "RESULTADO_INVALIDO"],
    ["sin ok", { salidaCruda: "x" }, "RESULTADO_INVALIDO"],
    ["ok que no es booleano", { ...exito, ok: "si" }, "RESULTADO_INVALIDO"],
    ["sin salida", { ...exito, salidaCruda: undefined }, "RESULTADO_INVALIDO"],
    ["un modelo con espacios", { ...exito, modelo: "modelo ficticio" }, "RESULTADO_INVALIDO"],
    ["un digest vacío", { ...exito, modeloDigest: "" }, "RESULTADO_INVALIDO"],
    ["una latencia negativa", { ...exito, latenciaMs: -1 }, "RESULTADO_INVALIDO"],
    ["tokens con decimales", { ...exito, tokensEntrada: 1.5 }, "RESULTADO_INVALIDO"],
    ["una salida demasiado larga", { ...exito, salidaCruda: "x".repeat(65_537) }, "SALIDA_DEMASIADO_LARGA"],
    ["un motivo desconocido", { ok: false, puerta: "local", motivo: "OTRO", detalle: "X" }, "MOTIVO_DESCONOCIDO"],
  ])("%s → ERROR_PROVEEDOR (%s)", async (_caso, devuelto, detalle) => {
    const { resultado } = await correr("local", { tipo: "DEVOLVER", resultado: devuelto }, null);
    expect(resultado).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle }] });
  });

  it("un detalle con datos o fuera del patrón se reemplaza: nunca sale lo que puso el proveedor", async () => {
    for (const detalle of [`${ESPECIE_ALFA} 4613`, "detalle en minúsculas", "CODIGO_7", "A".repeat(65), 7]) {
      const { resultado } = await correr("local", { tipo: "DEVOLVER", resultado: { ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle } }, null);
      expect(resultado).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "DETALLE_NO_VALIDO" }] });
    }
  });

  it("se copian solo los campos del contrato y la puerta es siempre la del generador registrado", async () => {
    const { resultado } = await correr("nube", null, { tipo: "DEVOLVER", resultado: { ...exito, puerta: "local", extra: ESPECIE_ALFA } });
    expect(resultado).toEqual({ estado: "EXITO", ok: true, exito: { ...exito, puerta: "nube" }, fallosPrevios: [] });
    const fallo = await correr("nube", null, { tipo: "DEVOLVER", resultado: { ok: false, puerta: "local", motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES", extra: "x" } });
    expect(fallo.resultado).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "nube", motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES" }] });
  });
});

describe("generarConPuertas · configuración y pedido inválidos (lanza antes de llamar a nadie)", () => {
  it("dos generadores de la misma puerta, o una puerta que no existe", async () => {
    const p = paquete();
    const a = crearGeneradorFalso({ puerta: "local", conducta: responder() });
    const b = crearGeneradorFalso({ puerta: "local", conducta: responder() });
    await expect(generarConPuertas([a, b], "local", pedidoDe(p), p)).rejects.toMatchObject({ codigo: "GENERADOR_DUPLICADO" });
    const rara = { puerta: "otra", generar: a.generar } as unknown as Generador;
    await expect(generarConPuertas([rara], "local", pedidoDe(p), p)).rejects.toMatchObject({ codigo: "PUERTA_INVALIDA" });
    await expect(generarConPuertas([a], "otro" as ModoPuertas, pedidoDe(p), p)).rejects.toMatchObject({ codigo: "MODO_PUERTAS_INVALIDO" });
    expect(a.llamadas()).toHaveLength(0);
    expect(b.llamadas()).toHaveLength(0);
  });

  it.each([
    ["con el paquete completo de más", (p: PaqueteHechos, pedido: PedidoGeneracion) => ({ ...pedido, paquete: p })],
    ["con un límite inválido", (_p: PaqueteHechos, pedido: PedidoGeneracion) => ({ ...pedido, limiteMs: 0 })],
    ["con el hash del prompt cambiado", (_p: PaqueteHechos, pedido: PedidoGeneracion) => ({ ...pedido, prompt: { ...pedido.prompt, hash: "0".repeat(64) } })],
  ])("un pedido %s: ErrorPedido y ningún generador llamado", async (_caso, mutar) => {
    const p = paquete();
    const falso = crearGeneradorFalso({ puerta: "local", conducta: responder() });
    await expect(generarConPuertas([falso], "local", mutar(p, pedidoDe(p)) as PedidoGeneracion, p)).rejects.toBeInstanceOf(ErrorPedido);
    expect(falso.llamadas()).toHaveLength(0);
  });
});
