// Candado de textos de la pantalla de proyecciones (frente proyecciones-pantalla; regla de Jelk): ningún texto pintado
// recomienda comprar, vender ni mantener. Se pinta la pantalla completa (render del servidor) con un resultado REAL
// del motor sobre entradas inventadas, en sus variantes (sin y con aporte, reinvirtiendo y cobrando, sin y con caída,
// con avisos), y se revisa sin el pie ni el aviso fijo, que justamente dicen que no es recomendación.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Simulador } from "@/app/proyecciones/Simulador";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { calcularProyeccion } from "@/proyecciones/calcular";
import { AVISO, type ParametrosProyeccion } from "@/proyecciones/tipos";
import { accion, diasHabiles, entradas, serieAleatoria } from "../proyecciones/ficticio";

const PIE = "El sistema calcula y muestra; no recomienda comprar ni vender.";
// Las formas que recomiendan o mandan (comprar, vender, mantener, conservar, invertir, aprovechar, «le conviene»…).
// Los sustantivos que describen («las compras», «las ventas») no recomiendan nada.
const PROHIBIDO =
  /\b(compr[ae]n?|compre|vendan?|venda|vender ya|mant[ée]ngal?[ao]s?|mantenga|mantener|conserve|conservar|invierta|invertir|aproveche|aprovechar|le conviene|convendr[íi]a|deber[íi]a|recomendamos|le recomendamos|recomendado|le sugerimos|sugerimos|se[ñn]al de (compra|venta)|oportunidad de (compra|venta)|es (buen )?momento de)\b/i;

const dias = diasHabiles("2019-01-02", 613);
const ENTRADAS = entradas([
  accion("ficta", 37, serieAleatoria(dias, 1237.41, 4613)),
  accion("fictb", 11, serieAleatoria(dias, 2711.37, 4711)),
  accion("fictc", 7, serieAleatoria(dias.slice(-41), 503.13, 4813)),
]);
const P: ParametrosProyeccion = { horizonteMeses: 37, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 211, semilla: 46133 };
const VARIANTES: readonly ParametrosProyeccion[] = [
  P,
  { ...P, aportePeriodico: 413.71, frecuenciaAporte: "TRIMESTRAL", reinvertirDividendos: false, caidaInicialPct: 13.7 },
];

const textoPintado = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

describe("textos de la pantalla de proyecciones", () => {
  it.each(VARIANTES.map((v, k) => [k, v] as const))("variante %i: no recomienda comprar, vender ni mantener", (_k, parametros) => {
    const vista = aVistaProyeccion(calcularProyeccion(ENTRADAS, parametros));
    expect(vista.avisos.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(Simulador, { datos: { hoy: vista.hoy, historia: [{ dia: "2020-05-29", valor: 46137.41 }], inicial: vista, estado: "LISTO" } }));
    const texto = textoPintado(html);
    expect(texto).toContain(AVISO);
    expect(texto.replace(AVISO, "").replace(PIE, "")).not.toMatch(PROHIBIDO);
  });

  it("el candado muerde", () => {
    for (const frase of ["Le conviene vender FICTA", "Compre más", "Mantenga sus acciones", "Debería vender ya", "Conserve FICTB", "Invierta el aporte", "Aproveche la caída", "Le sugerimos esperar"]) {
      expect(frase).toMatch(PROHIBIDO);
    }
    expect("Lo aportado es el valor de hoy más los aportes del escenario").not.toMatch(PROHIBIDO);
    expect("las compras cuentan al inicio del día").not.toMatch(PROHIBIDO);
  });
});
