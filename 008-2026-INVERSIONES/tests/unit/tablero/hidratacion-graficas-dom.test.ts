// @vitest-environment jsdom
// Hidratación del tablero con las gráficas (frente graficas-tablero): sin medir la pantalla en el servidor, lo que
// pinta el servidor es lo que hidrata el navegador, con y sin «reducir movimiento». Datos inventados.
import { act, createElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { movimiento, observador } from "../graficas/dom";
import { resumenDe } from "./ficticio";
import { evolucionFicticia, nueveEspecies } from "./ficticio-graficas";

let raiz: Root | null = null;
let contenedor: HTMLDivElement | null = null;
afterEach(() => {
  if (raiz) act(() => raiz!.unmount());
  raiz = null;
  contenedor?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hidratación con gráficas", () => {
  it.each([true, false])("sin desajustes (reducir movimiento: %s)", async (reducido) => {
    movimiento(reducido);
    observador();
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const errores: unknown[] = [];
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const el = createElement(Tablero, { vista: aVista(resumenDe(nueveEspecies())), evolucion: evolucionFicticia() });
    contenedor = document.createElement("div");
    document.body.append(contenedor);
    contenedor.innerHTML = renderToString(el);
    await act(async () => {
      raiz = hydrateRoot(contenedor!, el, { onRecoverableError: (e) => errores.push(e) });
    });
    expect(errores).toEqual([]);
    expect(consola).not.toHaveBeenCalled();
    expect(contenedor.querySelectorAll("figure")).toHaveLength(4);
  });
});
