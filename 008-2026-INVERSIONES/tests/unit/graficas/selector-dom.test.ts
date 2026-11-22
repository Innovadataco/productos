// @vitest-environment jsdom
// Selector de rango (frente graficas-tablero): una fila de botones con aria-pressed; lo que la historia no cubre,
// deshabilitado. Inventado.
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Selector } from "@/app/_graficas";
import { montar, texto, type Montaje } from "./dom";

let m: Montaje;
beforeEach(() => { m = montar(); });
afterEach(() => { m.desmontar(); });

describe("Selector", () => {
  it("marca el elegido, deshabilita lo no disponible y avisa el cambio", async () => {
    const alCambiar = vi.fn();
    await m.pintar(createElement(Selector<"1M" | "1A" | "TODO">, {
      etiqueta: "Rango de fechas", valor: "TODO", alCambiar,
      opciones: [{ clave: "1M", texto: "1M", disponible: true }, { clave: "1A", texto: "1A", disponible: false }, { clave: "TODO", texto: "Todo", disponible: true }],
    }));
    const grupo = m.contenedor.querySelector("[role=group]")!;
    expect(grupo.getAttribute("aria-label")).toBe("Rango de fechas");
    const botones = [...grupo.querySelectorAll("button")];
    expect(botones.map((b) => [texto(b), b.getAttribute("aria-pressed"), b.disabled])).toEqual([["1M", "false", false], ["1A", "false", true], ["Todo", "true", false]]);
    botones[0]!.click();
    expect(alCambiar).toHaveBeenCalledWith("1M");
  });
});
