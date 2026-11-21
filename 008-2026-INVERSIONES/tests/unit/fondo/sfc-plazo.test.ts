// Plazo total de la consulta a la SFC (10 s), con reloj falso y sin red. Datos inventados.
import { afterEach, describe, expect, it, vi } from "vitest";
import { obtenerValores, type BuscarSfc, type ConsultaSfc, type ResultadoSfc } from "@/fondo/sfc";

const PLAZO_MS = 10_000;
const consulta: ConsultaSfc = { codigo: "999001", participacion: null, desde: new Date("2024-03-10T00:00:00Z"), hasta: new Date("2024-03-12T00:00:00Z") };

function vigilar(p: Promise<ResultadoSfc>): { listo: boolean; valor?: ResultadoSfc } {
  const v: { listo: boolean; valor?: ResultadoSfc } = { listo: false };
  void p.then((x) => {
    v.listo = true;
    v.valor = x;
  });
  return v;
}

describe("obtenerValores · plazo total", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each<[string, BuscarSfc]>([
    ["un buscar que ignora la señal y nunca resuelve", () => new Promise(() => undefined)],
    ["un cuerpo que nunca termina", async () => new Response(new ReadableStream<Uint8Array>())],
  ])("con %s, da SFC_RED a los 10 s (no se cuelga)", async (_caso, buscar) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const v = vigilar(obtenerValores(consulta, buscar));
    await vi.advanceTimersByTimeAsync(PLAZO_MS - 1);
    expect(v.listo).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(v).toEqual({ listo: true, valor: { ok: false, codigo: "SFC_RED" } });
  });
});
