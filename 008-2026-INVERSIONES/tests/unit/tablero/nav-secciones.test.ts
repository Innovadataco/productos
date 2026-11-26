// @vitest-environment jsdom
// Navegación del tablero a las otras pantallas (fase B, corte 3): el encabezado lleva a Plan, Decisiones y
// Conciliación (y Proyecciones, frente proyecciones-pantalla), y «Lo que todavía no está» ya no promete las reglas, el
// diario ni las proyecciones. El dueño ve además «Configuración» al final (frente menu-configuracion); la familia, no.
// Datos inventados.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { D, especie, resumenDe } from "./ficticio";

const VISTA = aVista(resumenDe([especie({ nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000) })]));
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function pantalla(soloLectura?: boolean): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(createElement(Tablero, { vista: VISTA, ...(soloLectura === undefined ? {} : { soloLectura }) }));
  return raiz;
}
const navDe = (raiz: HTMLElement) =>
  [...(raiz.querySelector('header nav[aria-label="Secciones"]')?.querySelectorAll("a") ?? [])].map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")]);

/** La lista de la familia: la de siempre, sin cambios. */
const COMUNES = [
  ["Portafolio", "/", "page"],
  ["Plan", "/plan", null],
  ["Operar", "/operar", null],
  ["Decisiones", "/decisiones", null],
  ["Conciliación", "/conciliacion", null],
  ["Proyecciones", "/proyecciones", null],
  ["Datos oficiales", "/datos-oficiales", null],
  ["Análisis", "/analisis", null],
  ["Alertas", "/alertas", null],
];

describe("navegación del tablero", () => {
  it("el encabezado lleva a las otras pantallas, con nombre y el portafolio como actual; el dueño ve «Configuración» al final", () => {
    expect(navDe(pantalla())).toEqual([...COMUNES, ["Configuración", "/edicion", null]]);
    expect(navDe(pantalla(false))).toEqual([...COMUNES, ["Configuración", "/edicion", null]]);
  });

  it("la familia (solo lectura) ve la lista de siempre, sin «Configuración» ni ningún enlace a /edicion", () => {
    const raiz = pantalla(true);
    expect(navDe(raiz)).toEqual(COMUNES);
    expect(raiz.querySelector('a[href^="/edicion"]')).toBeNull();
  });

  it("«Lo que todavía no está» ya no promete las reglas ni el diario", () => {
    const falta = pantalla().querySelector("ul.falta")!;
    expect(texto(falta)).not.toContain("Mis reglas");
    expect(texto(falta)).not.toContain("diario de decisiones");
  });

  it("«Lo que todavía no está» ya no promete las proyecciones: ya tienen su pantalla (frente proyecciones-pantalla)", () => {
    expect(texto(pantalla().querySelector("ul.falta"))).not.toContain("Proyecciones");
  });
});
