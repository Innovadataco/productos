/**
 * El plazo de un pedido: una señal propia que se aborta con la señal de afuera o con el límite propio, que dice cuál
 * de las dos la abortó, que deja esperar una promesa sin colgarse (aunque esa promesa ignore la señal) y que al
 * cerrarse no deja temporizadores ni escuchas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abrirPlazo } from "@/ia/local/plazo";

const LIMITE_MS = 4613;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("abrirPlazo", () => {
  it("vence en el límite exacto: aborta y la causa es el límite del cliente", async () => {
    const plazo = abrirPlazo(undefined, LIMITE_MS);
    expect(plazo.causa()).toBeNull();
    await vi.advanceTimersByTimeAsync(LIMITE_MS - 1);
    expect(plazo.senal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(plazo.senal.aborted).toBe(true);
    expect(plazo.causa()).toBe("LIMITE_DEL_CLIENTE");
    plazo.cerrar();
  });

  it("la señal de afuera lo aborta y la causa es la señal", () => {
    const afuera = new AbortController();
    const plazo = abrirPlazo(afuera.signal, LIMITE_MS);
    afuera.abort();
    expect(plazo.senal.aborted).toBe(true);
    expect(plazo.causa()).toBe("SENAL_ABORTADA");
    plazo.cerrar();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("una señal de afuera ya abortada lo deja abortado desde el inicio, sin temporizador", () => {
    const afuera = new AbortController();
    afuera.abort();
    const plazo = abrirPlazo(afuera.signal, LIMITE_MS);
    expect(plazo.senal.aborted).toBe(true);
    expect(plazo.causa()).toBe("SENAL_ABORTADA");
    expect(vi.getTimerCount()).toBe(0);
    plazo.cerrar();
  });

  it("la primera causa manda: si vence el límite, abortar afuera después no la cambia", async () => {
    const afuera = new AbortController();
    const plazo = abrirPlazo(afuera.signal, LIMITE_MS);
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    afuera.abort();
    expect(plazo.causa()).toBe("LIMITE_DEL_CLIENTE");
    plazo.cerrar();
  });

  it("cerrar quita el temporizador y la escucha de la señal de afuera", () => {
    const afuera = new AbortController();
    const quitar = vi.spyOn(afuera.signal, "removeEventListener");
    const plazo = abrirPlazo(afuera.signal, LIMITE_MS);
    expect(vi.getTimerCount()).toBe(1);
    plazo.cerrar();
    expect(vi.getTimerCount()).toBe(0);
    expect(quitar).toHaveBeenCalledWith("abort", expect.any(Function));
    afuera.abort();
    expect(plazo.senal.aborted).toBe(false);
    expect(plazo.causa()).toBeNull();
  });

  it("cerrar dos veces no lanza", () => {
    const plazo = abrirPlazo(undefined, LIMITE_MS);
    plazo.cerrar();
    expect(() => plazo.cerrar()).not.toThrow();
  });
});

describe("plazo.esperar", () => {
  it("devuelve el valor de una promesa que se cumple", async () => {
    const plazo = abrirPlazo(undefined, LIMITE_MS);
    await expect(plazo.esperar(Promise.resolve(37))).resolves.toEqual({ tipo: "VALOR", valor: 37 });
    plazo.cerrar();
  });

  it("devuelve el error de una promesa que se rechaza, sin lanzar", async () => {
    const plazo = abrirPlazo(undefined, LIMITE_MS);
    const error = new Error("ficticio");
    await expect(plazo.esperar(Promise.reject(error))).resolves.toEqual({ tipo: "ERROR", error });
    plazo.cerrar();
  });

  it("una promesa que nunca se cumple (e ignora la señal) se corta al vencer el límite", async () => {
    const plazo = abrirPlazo(undefined, LIMITE_MS);
    const espera = plazo.esperar(new Promise<never>(() => undefined));
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    await expect(espera).resolves.toEqual({ tipo: "ABORTADO" });
    plazo.cerrar();
  });

  it("con el plazo ya abortado no espera nada", async () => {
    const afuera = new AbortController();
    afuera.abort();
    const plazo = abrirPlazo(afuera.signal, LIMITE_MS);
    await expect(plazo.esperar(Promise.resolve(41))).resolves.toEqual({ tipo: "ABORTADO" });
    plazo.cerrar();
  });

  it("una promesa que se rechaza después del aborto no deja un rechazo sin atender", async () => {
    const plazo = abrirPlazo(undefined, LIMITE_MS);
    let rechazar: (e: unknown) => void = () => undefined;
    const tardia = new Promise<never>((_si, no) => {
      rechazar = no;
    });
    const espera = plazo.esperar(tardia);
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    await expect(espera).resolves.toEqual({ tipo: "ABORTADO" });
    rechazar(new Error("tarde"));
    await Promise.resolve();
    plazo.cerrar();
  });
});
