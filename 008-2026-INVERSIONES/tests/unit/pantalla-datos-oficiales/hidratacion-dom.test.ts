// @vitest-environment jsdom
// Hidratación de /datos-oficiales (frente datos-oficiales-pantalla, C6a; revisión react-reviewer, MEDIO): lo que pinta
// el servidor es lo que hidrata el navegador, con y sin «reducir movimiento», sin avisos; ya hidratada, el deslizador de
// cada gráfica responde al teclado (Inicio y Fin) y lo dice en su aria-valuetext. Cifras inventadas.
import { act, createElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatosOficiales } from "@/app/datos-oficiales/DatosOficiales";
import { movimiento, observador } from "../graficas/dom";
import { datos } from "./ficticio";

let raiz: Root | null = null;
let contenedor: HTMLDivElement | null = null;
afterEach(() => {
  if (raiz) act(() => raiz!.unmount());
  raiz = null;
  contenedor?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function hidratar(reducido: boolean): Promise<{ readonly errores: unknown[]; readonly consola: ReturnType<typeof vi.spyOn> }> {
  movimiento(reducido);
  observador();
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  const errores: unknown[] = [];
  const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const el = createElement(DatosOficiales, { datos: datos(), soloLectura: true });
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  contenedor.innerHTML = renderToString(el);
  await act(async () => {
    raiz = hydrateRoot(contenedor!, el, { onRecoverableError: (e) => errores.push(e) });
  });
  return { errores, consola };
}

const tecla = async (el: Element, key: string) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
};

describe("hidratación de /datos-oficiales", () => {
  it.each([true, false])("sin desajustes ni avisos (reducir movimiento: %s)", async (reducido) => {
    const { errores, consola } = await hidratar(reducido);
    expect(errores).toEqual([]);
    expect(consola).not.toHaveBeenCalled();
    expect(contenedor!.querySelectorAll("figure")).toHaveLength(4);
  });

  it("ya hidratada, el deslizador responde al teclado: Inicio lleva al primer valor y Fin al último", async () => {
    await hidratar(true);
    const slider = contenedor!.querySelector("figure [role=slider]")!;
    await tecla(slider, "Home");
    expect(slider.getAttribute("aria-valuenow")).toBe("0");
    expect(slider.getAttribute("aria-valuetext")).toBe("12-mar-2021 · 3.917,43 Tasa Representativa del Mercado");
    await tecla(slider, "ArrowRight");
    expect(slider.getAttribute("aria-valuetext")).toBe("13-mar-2021 · 3.921,17 Tasa Representativa del Mercado · Vigente hasta el 15-mar-2021");
    await tecla(slider, "End");
    expect(slider.getAttribute("aria-valuetext")).toBe("17-mar-2021 · 3.923,07 Tasa Representativa del Mercado");
  });
});
