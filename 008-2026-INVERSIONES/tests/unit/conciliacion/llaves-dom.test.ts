// @vitest-environment jsdom
// Llaves de las listas de /conciliacion (react-reviewer y code-reviewer, MEDIO): dos operaciones por liquidar
// idénticas (órdenes partidas: misma especie, lado, día y cantidad) y dos fondos sin instrumento no deben repetir
// llave. React solo lo detecta al reconciliar, por eso se monta con createRoot. Datos inventados.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Conciliacion } from "@/app/conciliacion/Conciliacion";
import { aCortes, aVistaCorte } from "@/app/conciliacion/serializar";
import { CONTROLES, CORTES, LECTURA, dia } from "./ficticio";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let registro: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  registro.mockRestore();
});

describe("llaves de las listas de /conciliacion", () => {
  it("dos operaciones por liquidar idénticas y dos fondos sin instrumento: sin llaves repetidas y con todas sus filas", () => {
    const venta = { nemotecnico: "FICTB", operacion: "VENTA" as const, cantidad: 20n, fechaOperacion: dia("2024-11-21"), fechaLiquidacion: dia("2024-11-25") };
    const fondo = CONTROLES.find((c) => c.tipo === "FONDO")!;
    const controles = [...CONTROLES.filter((c) => c !== fondo), { ...fondo, instrumentoId: null, instrumento: null }, { ...fondo, instrumentoId: null, instrumento: null }];
    const vista = aVistaCorte({ ...LECTURA, conciliacion: { ...LECTURA.conciliacion!, controles }, porLiquidar: [venta, venta] });
    const contenedor = document.createElement("div");
    const raiz = createRoot(contenedor);
    act(() => raiz.render(createElement(Conciliacion, { datos: { estado: "CORTE", vista, cortes: aCortes(CORTES, "2024-11-22") } })));
    const llaves = registro.mock.calls.filter((c) => String(c[0]).includes("same key"));
    expect(llaves).toEqual([]);
    const filas = (nombre: string) => [...contenedor.querySelectorAll("tr")].filter((tr) => tr.querySelector("th")?.textContent === nombre);
    expect(filas("FICTB")).toHaveLength(2);
    expect(filas("Fondo")).toHaveLength(2);
    act(() => raiz.unmount());
  });
});
