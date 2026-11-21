// @vitest-environment jsdom
// Línea de la conciliación en el tablero (PR-C, GATE 1 aprobada): el primer elemento de <main> enlaza a
// /conciliacion y dice el resultado GUARDADO de la última conciliación (sin recalcular), en palabras.
// La lista «Lo que todavía no está» ya no promete el cuadre de A&V: remite a la conciliación. Datos inventados.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { aLineaDelTablero } from "@/app/conciliacion/serializar";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import type { LineaConciliacionVista } from "@/app/tablero/tipos";
import { D, dia, especie, resumenDe } from "./ficticio";

const VISTA = aVista(resumenDe([especie({ nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000) })]));

function pantalla(conciliacion?: LineaConciliacionVista): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(createElement(Tablero, conciliacion === undefined ? { vista: VISTA } : { vista: VISTA, conciliacion }));
  return raiz;
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const linea = (raiz: HTMLElement) => raiz.querySelector("main")!.firstElementChild;

describe("línea de la conciliación en el tablero", () => {
  it.each<[string, LineaConciliacionVista, string]>([
    ["no cuadra", { fechaCorte: "2024-11-22", resultado: "NO_CUADRA" }, "Conciliación con A&V al 22-nov-2024: no cuadra"],
    ["cuadra", { fechaCorte: "2024-11-22", resultado: "CUADRA" }, "Conciliación con A&V al 22-nov-2024: cuadra"],
    ["parcial", { fechaCorte: "2024-11-14", resultado: "PARCIAL" }, "Conciliación con A&V al 14-nov-2024: cuadra, con operaciones por liquidar"],
    ["sin conciliar", { fechaCorte: "2024-11-14", resultado: null }, "Conciliación con A&V al 14-nov-2024: todavía sin conciliar"],
    ["sin certificación", null, "Conciliación con A&V: todavía no hay certificación de A&V cargada"],
  ])("%s: el primer elemento de <main> enlaza a /conciliacion con el resultado en palabras", (_caso, conciliacion, esperado) => {
    const raiz = pantalla(conciliacion);
    const primero = linea(raiz)!;
    expect(primero.tagName).toBe("P");
    expect(primero.classList.contains("nota")).toBe(true);
    const enlace = primero.querySelector("a")!;
    expect(enlace.getAttribute("href")).toBe("/conciliacion");
    expect(texto(enlace)).toBe(esperado);
  });

  it("sin el dato (otras pantallas que usan el tablero) no pinta la línea", () => {
    const raiz = pantalla();
    expect(raiz.querySelector('main > p.nota > a[href="/conciliacion"]')).toBeNull();
    expect(linea(raiz)!.tagName).toBe("SECTION");
  });

  it("la línea está fuera del encabezado y del título: no cambia el nombre accesible de «¿Gano?»", () => {
    const con = pantalla({ fechaCorte: "2024-11-22", resultado: "NO_CUADRA" });
    const sin = pantalla();
    expect(con.querySelector("header")!.innerHTML).toBe(sin.querySelector("header")!.innerHTML);
    expect(texto(con.querySelector("h1"))).toBe(texto(sin.querySelector("h1")));
  });

  it("«Lo que todavía no está» ya no promete el cuadre de A&V: remite a la conciliación", () => {
    const falta = pantalla().querySelector("ul.falta")!;
    expect(texto(falta)).not.toContain("y su cuadre");
    const item = [...falta.querySelectorAll("li")].find((li) => texto(li).startsWith("Caja oficial"))!;
    expect(texto(item)).toBe("Caja oficial de A&V en este resumen · su cuadre ya se ve en Conciliación");
    expect(item.querySelector("a")!.getAttribute("href")).toBe("/conciliacion");
  });
});

describe("aLineaDelTablero", () => {
  it("serializa la última conciliación (o su ausencia) para el tablero", () => {
    expect(aLineaDelTablero({ fechaCorte: dia("2024-11-22"), resultado: "PARCIAL" })).toEqual({ fechaCorte: "2024-11-22", resultado: "PARCIAL" });
    expect(aLineaDelTablero({ fechaCorte: dia("2024-11-22"), resultado: null })).toEqual({ fechaCorte: "2024-11-22", resultado: null });
    expect(aLineaDelTablero(null)).toBeNull();
  });
});
