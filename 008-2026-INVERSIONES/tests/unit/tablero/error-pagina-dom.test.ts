// @vitest-environment jsdom
// Página de error en un DOM (INV-SPEC-15): al montarse se anuncia y el foco no se pierde.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaginaDeError from "@/app/error";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenedor: HTMLDivElement;
let raiz: Root;

async function montar(retry: () => void = () => undefined): Promise<void> {
  await act(async () => raiz.render(createElement(PaginaDeError, { error: new Error("detalle"), retry })));
}

beforeEach(() => {
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
});

describe("src/app/error.tsx en el navegador", () => {
  it("anuncia el error con role=alert y lleva el foco al título", async () => {
    await montar();
    const titulo = contenedor.querySelector("h1");
    expect(titulo?.closest('[role="alert"]')).not.toBeNull();
    expect(titulo?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(titulo);
  });

  it("«Reintentar» llama a retry una vez", async () => {
    const retry = vi.fn();
    await montar(retry);
    const boton = [...contenedor.querySelectorAll("button")].find((b) => b.textContent === "Reintentar");
    await act(async () => boton?.click());
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
