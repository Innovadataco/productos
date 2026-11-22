/**
 * El generador falso: responde, falla, lanza, tarda o se cuelga, y cuenta las llamadas. Sin red.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIGEST_FICTICIO, MODELO_FICTICIO, crearGeneradorFalso } from "@/ia/generador-falso";
import { armarPedido, type PedidoGeneracion } from "@/ia/generador";
import { construirPaquete } from "@/ia/paquete";
import { entradaDiario } from "./apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "./apoyo/pedido.ficticio";

const pedido = (): PedidoGeneracion => armarPedido({ paquete: construirPaquete(entradaDiario()), prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS });
const senal = (): AbortSignal => new AbortController().signal;

describe("generador falso", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("RESPONDER: un éxito con los valores ficticios por omisión y la puerta configurada", async () => {
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda: '{"frases":[]}' } });
    await expect(falso.generar(pedido(), senal())).resolves.toEqual({
      ok: true, puerta: "local", salidaCruda: '{"frases":[]}', modelo: MODELO_FICTICIO, modeloDigest: DIGEST_FICTICIO, latenciaMs: 0, tokensEntrada: null, tokensSalida: null,
    });
  });

  it("RESPONDER con modelo, digest, latencia y tokens propios", async () => {
    const falso = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "RESPONDER", salidaCruda: "x", modelo: "m-ficticio", modeloDigest: "d-ficticio", latenciaMs: 4613, tokensEntrada: 1237, tokensSalida: 317 } });
    await expect(falso.generar(pedido(), senal())).resolves.toMatchObject({ puerta: "nube", modelo: "m-ficticio", modeloDigest: "d-ficticio", latenciaMs: 4613, tokensEntrada: 1237, tokensSalida: 317 });
  });

  it("FALLAR: un fallo con su motivo y un detalle por omisión", async () => {
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "FALLAR", motivo: "MODELO_NO_DISPONIBLE" } });
    await expect(falso.generar(pedido(), senal())).resolves.toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "FALLO_FICTICIO" });
    const conDetalle = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "FALLAR", motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES" } });
    await expect(conDetalle.generar(pedido(), senal())).resolves.toMatchObject({ motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES" });
  });

  it("LANZAR: rechaza la promesa, o lanza en la llamada misma si es síncrono", async () => {
    const asincrono = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "LANZAR", mensaje: "secreto" } });
    await expect(asincrono.generar(pedido(), senal())).rejects.toThrow("secreto");
    const sincrono = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "LANZAR", sincrono: true } });
    expect(() => sincrono.generar(pedido(), senal())).toThrow(Error);
    const porOmision = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "LANZAR" } });
    await expect(porOmision.generar(pedido(), senal())).rejects.toThrow(Error);
  });

  it("DEVOLVER: entrega tal cual algo que puede no cumplir el contrato", async () => {
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "DEVOLVER", resultado: "no es un resultado" } });
    await expect(falso.generar(pedido(), senal())).resolves.toBe("no es un resultado");
  });

  it("TARDAR: responde después de los milisegundos configurados", async () => {
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "TARDAR", ms: 1237, luego: { tipo: "RESPONDER", salidaCruda: "tarde" } } });
    let resuelto: unknown = null;
    const promesa = falso.generar(pedido(), senal());
    void promesa.then((r) => { resuelto = r; });
    await vi.advanceTimersByTimeAsync(1236);
    expect(resuelto).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await expect(promesa).resolves.toMatchObject({ ok: true, salidaCruda: "tarde" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("TARDAR: si la señal se aborta, deja de esperar y devuelve TIEMPO_AGOTADO", async () => {
    const falso = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "TARDAR", ms: 4613, luego: { tipo: "RESPONDER", salidaCruda: "tarde" } } });
    const control = new AbortController();
    const resultado = falso.generar(pedido(), control.signal);
    await vi.advanceTimersByTimeAsync(317);
    control.abort();
    await expect(resultado).resolves.toEqual({ ok: false, puerta: "nube", motivo: "TIEMPO_AGOTADO", detalle: "ABORTADO" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("TARDAR con la señal ya abortada devuelve TIEMPO_AGOTADO sin esperar", async () => {
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "TARDAR", ms: 4613, luego: { tipo: "RESPONDER", salidaCruda: "x" } } });
    const control = new AbortController();
    control.abort();
    await expect(falso.generar(pedido(), control.signal)).resolves.toMatchObject({ motivo: "TIEMPO_AGOTADO", detalle: "ABORTADO" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("COLGAR: nunca responde, aunque pase el tiempo o se aborte la señal", async () => {
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "COLGAR" } });
    const control = new AbortController();
    let resuelto = false;
    void falso.generar(pedido(), control.signal).then(() => { resuelto = true; });
    control.abort();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(resuelto).toBe(false);
  });

  it("una conducta por llamada, según su índice, y cuenta las llamadas con copias congeladas", async () => {
    const falso = crearGeneradorFalso({ puerta: "local", conducta: (i) => (i === 0 ? { tipo: "FALLAR", motivo: "MODELO_NO_DISPONIBLE" } : { tipo: "RESPONDER", salidaCruda: `r${i}` }) });
    expect(falso.llamadas()).toEqual([]);
    const p = pedido();
    await expect(falso.generar(p, senal())).resolves.toMatchObject({ ok: false });
    await expect(falso.generar(p, senal())).resolves.toMatchObject({ ok: true, salidaCruda: "r1" });
    const llamadas = falso.llamadas();
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0]).toBe(p);
    expect(Object.isFrozen(llamadas)).toBe(true);
    expect(falso.llamadas()).not.toBe(llamadas);
    expect(Object.isFrozen(falso)).toBe(true);
  });
});
