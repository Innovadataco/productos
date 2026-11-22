/**
 * El límite del generador local, con relojes falsos (solo setTimeout y clearTimeout): `limiteMs` corre desde la
 * llamada (incluye la espera del turno) y corta aunque el `fetch` ignore la señal; la señal de afuera también corta.
 * Al terminar no queda ningún temporizador vivo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResultadoGeneracion } from "@/ia/generador";
import { crearGeneradorLocal } from "@/ia/local/generador";
import { bytes, crearOllamaFalso, flujoVigilado, generacionFicticia, json, tagsDelFicticio, vigilarFalsos, type Guion } from "./apoyo/ollama-falso";
import { CONFIG_FICTICIA, pedidoFicticio } from "./apoyo/red.ficticio";

vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const { modeloAprobadoFicticio } = await import("./apoyo/red.ficticio");
  return { ...real, modeloAprobado: modeloAprobadoFicticio };
});

vigilarFalsos();

const LIMITE_MS = 4613;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

function generador(guion: Guion) {
  const falso = crearOllamaFalso(guion);
  return { falso, local: crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch, ahora: () => 7 }) };
}

/** Sigue el estado de una promesa sin esperarla. */
function seguir(promesa: Promise<ResultadoGeneracion>): () => ResultadoGeneracion | undefined {
  let valor: ResultadoGeneracion | undefined;
  void promesa.then((v) => {
    valor = v;
  });
  return () => valor;
}

describe("generar · el límite del cliente", () => {
  it.each([
    ["en tags", ((_l, i) => (i === 0 ? { tipo: "COLGAR" } : json(generacionFicticia()))) as Guion],
    ["en generate", ((_l, i) => (i === 0 ? json(tagsDelFicticio()) : { tipo: "COLGAR" })) as Guion],
  ])("un fetch colgado %s (que ignora la señal) se corta justo en limiteMs → TIEMPO_AGOTADO LIMITE_DEL_CLIENTE", async (_n, guion) => {
    const { local } = generador(guion);
    const resultado = seguir(local.generar(pedidoFicticio(LIMITE_MS).pedido, new AbortController().signal));
    await vi.advanceTimersByTimeAsync(LIMITE_MS - 1);
    expect(resultado()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(resultado()).toEqual({ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_CLIENTE" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("la señal llega al fetch y se aborta al vencer el límite", async () => {
    const { local, falso } = generador(() => ({ tipo: "COLGAR" }));
    const resultado = seguir(local.generar(pedidoFicticio(LIMITE_MS).pedido, new AbortController().signal));
    await vi.advanceTimersByTimeAsync(0);
    const senal = falso.llamadas()[0]?.signal as AbortSignal;
    expect(senal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    expect(senal.aborted).toBe(true);
    expect(resultado()).toMatchObject({ motivo: "TIEMPO_AGOTADO" });
  });

  it("un cuerpo colgado también se corta en el límite, y el flujo se cancela", async () => {
    const f = flujoVigilado([bytes('{"model":')], "COLGAR");
    const { local } = generador((_l, i) => (i === 0 ? json(tagsDelFicticio()) : { tipo: "FLUJO", flujo: f.flujo }));
    const resultado = seguir(local.generar(pedidoFicticio(LIMITE_MS).pedido, new AbortController().signal));
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    expect(resultado()).toMatchObject({ motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_CLIENTE" });
    expect(f.cancelado()).toBe(true);
  });

  it("la señal de afuera corta a mitad del pedido → TIEMPO_AGOTADO SENAL_ABORTADA", async () => {
    const { local } = generador(() => ({ tipo: "COLGAR" }));
    const afuera = new AbortController();
    const espera = local.generar(pedidoFicticio(LIMITE_MS).pedido, afuera.signal);
    await vi.advanceTimersByTimeAsync(1237);
    afuera.abort();
    expect(await espera).toEqual({ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("un pedido que responde a tiempo no deja temporizadores", async () => {
    const { local } = generador((_l, i) => json(i === 0 ? tagsDelFicticio() : generacionFicticia()));
    expect(await local.generar(pedidoFicticio(LIMITE_MS).pedido, new AbortController().signal)).toMatchObject({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("generar · el límite incluye la espera del turno", () => {
  it("el segundo pedido vence esperando el turno → TIEMPO_AGOTADO LIMITE_EN_ESPERA, sin tocar la red", async () => {
    const { local, falso } = generador(() => ({ tipo: "COLGAR" }));
    const primero = seguir(local.generar(pedidoFicticio(LIMITE_MS).pedido, new AbortController().signal));
    const segundo = seguir(local.generar(pedidoFicticio(1237).pedido, new AbortController().signal));
    await vi.advanceTimersByTimeAsync(1237);
    expect(segundo()).toEqual({ ok: false, puerta: "local", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_EN_ESPERA" });
    expect(primero()).toBeUndefined();
    expect(falso.llamadas()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    expect(primero()).toMatchObject({ detalle: "LIMITE_DEL_CLIENTE" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("la señal de afuera corta la espera del turno → TIEMPO_AGOTADO SENAL_ABORTADA", async () => {
    const { local, falso } = generador(() => ({ tipo: "COLGAR" }));
    void local.generar(pedidoFicticio(LIMITE_MS).pedido, new AbortController().signal);
    const afuera = new AbortController();
    const segundo = local.generar(pedidoFicticio(LIMITE_MS).pedido, afuera.signal);
    await vi.advanceTimersByTimeAsync(41);
    afuera.abort();
    expect(await segundo).toMatchObject({ motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
    expect(falso.llamadas()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
  });

  it("después de un corte por tiempo, el turno queda libre para el siguiente", async () => {
    const { local } = generador((_l, i) => (i === 0 ? { tipo: "COLGAR" } : json(i % 2 === 1 ? tagsDelFicticio() : generacionFicticia())));
    const primero = seguir(local.generar(pedidoFicticio(LIMITE_MS).pedido, new AbortController().signal));
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    expect(primero()).toMatchObject({ motivo: "TIEMPO_AGOTADO" });
    expect(await local.generar(pedidoFicticio(LIMITE_MS).pedido, new AbortController().signal)).toMatchObject({ ok: true });
  });
});
