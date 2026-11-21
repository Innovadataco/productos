// @vitest-environment jsdom
// El panel de detalle en un DOM (frente tablero-cierres): el valor dice de qué cierre es. Datos inventados.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { D, dia, especie, punto, resumenDe } from "./ficticio";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenedor: HTMLDivElement;
let raiz: Root;

const vista = aVista(resumenDe([
  especie({
    nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000),
    cierre: { precio: D(120), fecha: dia("2026-10-30"), verificado: true },
    serie: [punto("2026-10-29", 110), punto("2026-10-30", 120)],
  }),
  especie({ nemotecnico: "FICT3", cantidad: 5n, costoVivo: D(500) }),
]));

async function abrirDetalle(nemo: string): Promise<string> {
  await act(async () => raiz.render(createElement(Tablero, { vista })));
  const boton = [...contenedor.querySelectorAll("tbody button")].find((b) => b.textContent === nemo) as HTMLButtonElement | undefined;
  await act(async () => boton?.click());
  return contenedor.querySelector(`aside[aria-label="Detalle de ${nemo}"]`)?.textContent ?? "";
}

beforeEach(() => {
  // jsdom no trae matchMedia: «reducir movimiento» encendido, así las cifras no se animan.
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener: () => undefined, removeEventListener: () => undefined }));
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
});

describe("detalle de una especie", () => {
  it("el valor dice la fecha del cierre con que se calculó", async () => {
    expect(await abrirDetalle("FICT1")).toContain("Valor al cierre del 30-oct-2026$ 1.200");
  });

  it("sin cierre, dice «sin cierre» y no inventa una fecha", async () => {
    const texto = await abrirDetalle("FICT3");
    expect(texto).toContain("Valor al cierresin cierre");
    expect(texto).not.toContain("Valor al cierre del");
  });
});
