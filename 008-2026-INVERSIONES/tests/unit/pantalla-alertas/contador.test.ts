// @vitest-environment jsdom
// El contador de «Alertas» en el menú: las de los últimos 7 días sin marcar. Con 0 no se muestra; con N lleva su aria-label;
// si la lectura falla o responde otra cosa, no se pinta nada (nunca un número inventado); se actualiza cuando el dueño marca.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContadorAlertas } from "@/app/_comun/alertas/ContadorAlertas";
import { EVENTO_ALERTAS_CAMBIARON } from "@/app/_comun/alertas/evento";
import { montar, texto, type Montaje } from "../graficas/dom";

let m: Montaje;
const responder = (cuerpo: unknown, estado = 200) => vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } }));
async function pintar(fetchFalso: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchFalso);
  await m.pintar(createElement(ContadorAlertas));
  await act(async () => { await Promise.resolve(); });
}
const marca = () => m.contenedor.querySelector(".alertas-contador");

beforeEach(() => { m = montar(); });
afterEach(() => { m.desmontar(); vi.unstubAllGlobals(); });

describe("ContadorAlertas", () => {
  it("con alertas sin marcar muestra el número con su aria-label (singular y plural)", async () => {
    await pintar(responder({ pendientes: 3 }));
    expect(texto(marca())).toBe("3");
    expect(marca()?.getAttribute("aria-label")).toBe("3 alertas sin marcar de los últimos 7 días");
    m.desmontar();
    m = montar();
    await pintar(responder({ pendientes: 1 }));
    expect(marca()?.getAttribute("aria-label")).toBe("1 alerta sin marcar de los últimos 7 días");
  });

  it("con 0 no se muestra nada", async () => {
    await pintar(responder({ pendientes: 0 }));
    expect(marca()).toBeNull();
    expect(texto(m.contenedor)).toBe("");
  });

  it.each([
    ["un error de la sesión", () => responder({ error: "x" }, 401)],
    ["una respuesta sin número", () => responder({ pendientes: "3" })],
    ["un número negativo", () => responder({ pendientes: -1 })],
    ["un número que no es entero", () => responder({ pendientes: 1.5 })],
    ["una red caída", () => vi.fn(async () => { throw new Error("sin red"); })],
  ])("%s: no se pinta nada", async (_n, fabricar) => {
    await pintar(fabricar());
    expect(marca()).toBeNull();
  });

  it("pide el conteo a la ruta propia, sin caché", async () => {
    const f = responder({ pendientes: 2 });
    await pintar(f);
    expect(f).toHaveBeenCalledWith("/api/alertas/pendientes", expect.objectContaining({ cache: "no-store" }));
  });

  it("se actualiza cuando el dueño marca (el evento de la pantalla de alertas)", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ pendientes: 2 }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ pendientes: 0 }), { status: 200 }));
    await pintar(f);
    expect(texto(marca())).toBe("2");
    await act(async () => { window.dispatchEvent(new Event(EVENTO_ALERTAS_CAMBIARON)); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(marca()).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("una respuesta vieja que llega tarde no pisa a la nueva (secuencia), y al desmontar se aborta la lectura", async () => {
    let soltarVieja: (r: Response) => void = () => undefined;
    const senales: AbortSignal[] = [];
    const f = vi.fn((_u: string, init: RequestInit) => {
      senales.push(init.signal as AbortSignal);
      if (f.mock.calls.length === 1) return new Promise<Response>((r) => { soltarVieja = r; });
      return Promise.resolve(new Response(JSON.stringify({ pendientes: 0 }), { status: 200 }));
    });
    await pintar(f as never);
    await act(async () => { window.dispatchEvent(new Event(EVENTO_ALERTAS_CAMBIARON)); await Promise.resolve(); });
    await act(async () => { soltarVieja(new Response(JSON.stringify({ pendientes: 5 }), { status: 200 })); await Promise.resolve(); });
    expect(marca()).toBeNull();
    m.desmontar();
    expect(senales.every((s) => s.aborted)).toBe(true);
    m = montar();
  });
});
