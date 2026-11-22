// Candado de textos (frente graficas-tablero): nada de lo que pintan las gráficas recomienda comprar o vender
// (regla de Jelk). Se revisa el texto pintado del tablero completo con todas las gráficas, sin el pie que dice
// justamente que el sistema no lo recomienda. Datos inventados.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { resumenDe } from "./ficticio";
import { evolucionFicticia, nueveEspecies } from "./ficticio-graficas";

const PIE = "El sistema calcula y muestra; no recomienda comprar ni vender.";
// Formas que recomiendan (imperativos, «recomendamos», «le conviene», «debería comprar/vender», «señal de compra»…).
// Los sustantivos que describen (las compras, las ventas) no recomiendan nada: el método de la TWR los nombra.
const PROHIBIDO = /\b(compren?|vendan?|le recomendamos|recomendamos|recomendado|le conviene|convendr[íi]a|deber[íi]as? (comprar|vender)|oportunidad de (compra|venta)|se[ñn]al de (compra|venta)|es (buen )?momento de|aproveche)\b/i;

const textoPintado = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

describe("textos de las gráficas", () => {
  it("el tablero con sus gráficas no recomienda comprar ni vender", () => {
    const html = renderToStaticMarkup(createElement(Tablero, { vista: aVista(resumenDe(nueveEspecies())), evolucion: evolucionFicticia() }));
    const texto = textoPintado(html);
    expect(texto).toContain(PIE);
    expect(texto.replace(PIE, "")).not.toMatch(PROHIBIDO);
  });

  it("el candado muerde", () => {
    expect("Le conviene vender FICTA").toMatch(PROHIBIDO);
    expect("Compre más").toMatch(PROHIBIDO);
    expect("Debería vender ya").toMatch(PROHIBIDO);
    expect("Costo de lo que tiene; las compras cuentan al inicio del día").not.toMatch(PROHIBIDO);
  });
});
