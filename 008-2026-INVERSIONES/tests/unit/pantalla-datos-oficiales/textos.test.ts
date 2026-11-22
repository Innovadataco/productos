// Candado de textos de /datos-oficiales (frente datos-oficiales-pantalla, C6a; regla de Jelk): ningún texto pintado
// recomienda comprar, vender ni mantener. Se pinta la pantalla entera (render del servidor) en todas sus variantes (al
// día, de ayer, atrasada, sin datos, con error, con y sin variación, sin gráfica) y se revisa sin el pie, que justamente
// dice que no recomienda. Tampoco muestra comandos: la ve la familia. El mismo patrón que la pantalla de proyecciones.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatosOficiales } from "@/app/datos-oficiales/DatosOficiales";
import { PIE_DATOS_OFICIALES } from "@/app/datos-oficiales/formato";
import type { SerieVista } from "@/app/datos-oficiales/tipos";
import { IBR, IPC, TPM, TRM, conError, datos, sinDatos } from "./ficticio";

const PROHIBIDO =
  /\b(compr[ae]n?|compre|vendan?|venda|vender ya|mant[ée]ngal?[ao]s?|mantenga|mantener|conserve|conservar|invierta|invertir|aproveche|aprovechar|le conviene|convendr[íi]a|deber[íi]a|recomendamos|le recomendamos|recomendado|le sugerimos|sugerimos|se[ñn]al de (compra|venta)|oportunidad de (compra|venta)|es (buen )?momento de)\b/i;
const COMANDO = /\b(importar-series|cargar-prod|exportar-[a-z]+|npx|npm|tsx|\.sh)\b/;

const VARIANTES: readonly (readonly SerieVista[])[] = [
  [TRM, TPM, IBR, IPC],
  [sinDatos("TRM"), conError("TPM"), sinDatos("IBR_3M_EA"), { ...IPC, variacion: { estado: "SIN_BASE", mesBase: "2020-02-01" } }],
  [{ ...TRM, historia: [] }, { ...TPM, historia: TPM.historia.slice(-1) }, { ...IPC, variacion: { estado: "NO_SE_PUDO" } }],
];

const textoPintado = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");

describe("textos de /datos-oficiales", () => {
  it.each(VARIANTES.map((v, k) => [k, v] as const))("variante %i: no recomienda comprar, vender ni mantener, ni muestra comandos", (_k, series) => {
    const texto = textoPintado(renderToStaticMarkup(createElement(DatosOficiales, { datos: datos(series), soloLectura: true })));
    expect(texto).toContain(PIE_DATOS_OFICIALES);
    expect(texto.replace(PIE_DATOS_OFICIALES, "")).not.toMatch(PROHIBIDO);
    expect(texto).not.toMatch(COMANDO);
  });

  it("el candado muerde", () => {
    for (const frase of ["Compre dólares", "Le conviene vender", "Mantenga sus acciones", "Debería esperar", "Señal de compra"]) expect(frase).toMatch(PROHIBIDO);
    expect("A mano: la carga el dueño (vía B)").not.toMatch(PROHIBIDO);
    expect("Corre npx tsx scripts/importar-series.ts").toMatch(COMANDO);
  });
});
