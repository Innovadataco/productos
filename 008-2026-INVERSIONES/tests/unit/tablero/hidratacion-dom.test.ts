// @vitest-environment jsdom
// Hidratación del tablero (frente tablero-cierres): lo que pinta el servidor es lo que hidrata el
// navegador, sin desajustes; y durante la cuenta animada el lector de pantalla oye siempre la cifra final.
import { act, createElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { D, dia, especie, punto, resumenDe } from "./ficticio";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const vista = aVista(resumenDe([
  especie({ nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000), cierre: { precio: D(120), fecha: dia("2026-10-30"), verificado: true }, serie: [punto("2026-10-29", 110), punto("2026-10-30", 120)] }),
  especie({ nemotecnico: "FICT2", cantidad: 5n, costoVivo: D(500), cierre: { precio: D(110), fecha: dia("2026-11-20"), verificado: false }, serie: [punto("2026-11-19", 100), punto("2026-11-20", 110)] }),
], { incompletas: ["FICT9"] }));

let contenedor: HTMLDivElement;
let raiz: Root | null = null;
let cuadros: FrameRequestCallback[] = [];

beforeEach(() => {
  // Movimiento sin reducir y pestaña visible: así corre la cuenta animada.
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => cuadros.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  contenedor = document.createElement("div");
  document.body.append(contenedor);
});

afterEach(() => {
  if (raiz) act(() => raiz!.unmount());
  raiz = null;
  cuadros = [];
  contenedor.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function hidratar(errores: unknown[]): Promise<void> {
  const el = createElement(Tablero, { vista });
  contenedor.innerHTML = renderToString(el);
  await act(async () => {
    raiz = hydrateRoot(contenedor, el, { onRecoverableError: (e) => errores.push(e) });
  });
}

describe("el tablero en el navegador", () => {
  it("hidrata sin desajustes con el HTML del servidor", async () => {
    const errores: unknown[] = [];
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await hidratar(errores);
    expect(errores).toEqual([]);
    expect(consola).not.toHaveBeenCalled();
    expect(contenedor.querySelector("h1")?.textContent).toContain("con datos parciales.");
  });

  it("a mitad de la cuenta animada, el lector de pantalla oye la cifra final", async () => {
    await hidratar([]);
    const t = performance.now() + 150 + 750; // espera de 150 ms + la mitad de 1,5 s
    await act(async () => { cuadros.splice(0).forEach((cb) => cb(t)); });
    const total = contenedor.querySelector("h1");
    expect(total?.querySelector(".cifra")?.getAttribute("data-fase")).toBe("anima");
    expect(total?.querySelector(".sr")?.textContent).toBe("+$ 250");
    expect(total?.querySelector(".cifra")?.textContent).not.toBe("+$ 250");
  });
});
