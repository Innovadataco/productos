// Candado de textos de /datos-oficiales (frente datos-oficiales-pantalla, C6a; regla de Jelk): ningún texto pintado
// recomienda comprar, vender ni mantener. Se pinta la pantalla entera (render del servidor) en todas sus variantes (al
// día, de ayer, atrasada, sin datos, con error, con y sin variación, sin gráfica) y se revisa sin el pie, que justamente
// dice que no recomienda. Tampoco muestra comandos: la ve la familia. El mismo patrón que la pantalla de proyecciones.
// La sección de dividendos decretados (frente datos-oficiales-decretos-pantalla, C6b) entra en las variantes: con todos
// los estados y todos los motivos, sin próximos ni cruce y con la tenencia negativa; ahí, además, la diferencia nunca se
// llama «retención», ni en el texto ni en un atributo (se revisa el HTML crudo).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatosOficiales } from "@/app/datos-oficiales/DatosOficiales";
import { PIE_DATOS_OFICIALES } from "@/app/datos-oficiales/formato";
import { ESTADOS_CRUCE, MOTIVOS_REVISAR } from "@/datos-oficiales/decretos/cruce";
import type { DecretosVista, SerieVista } from "@/app/datos-oficiales/tipos";
import { IBR, IPC, TPM, TRM, conError, datos, sinDatos } from "./ficticio";
import { DECRETOS, DECRETOS_VACIOS, fila } from "./ficticio-decretos";

const PROHIBIDO =
  /\b(compr[ae]n?|compre|vendan?|venda|vender ya|mant[ée]ngal?[ao]s?|mantenga|mantener|conserve|conservar|invierta|invertir|aproveche|aprovechar|le conviene|convendr[íi]a|deber[íi]a|recomendamos|le recomendamos|recomendado|le sugerimos|sugerimos|se[ñn]al de (compra|venta)|oportunidad de (compra|venta)|es (buen )?momento de)\b/i;
const COMANDO = /\b(importar-series|importar-decretos|cargar-prod|exportar-[a-z]+|npx|npm|tsx|\.sh)\b/;
const RETENCION = /retenci[oó]n/i;

const TODOS_LOS_ESTADOS: DecretosVista = {
  ...DECRETOS,
  cruce: [...DECRETOS.cruce, ...ESTADOS_CRUCE.map((estado, k) => fila({ clave: `e-${k}`, estado, motivos: estado === "REVISAR" ? [...MOTIVOS_REVISAR] : [] }))],
  sinTenencia: 1,
};

const VARIANTES: readonly (readonly [readonly SerieVista[], DecretosVista])[] = [
  [[TRM, TPM, IBR, IPC], DECRETOS],
  [[sinDatos("TRM"), conError("TPM"), sinDatos("IBR_3M_EA"), { ...IPC, variacion: { estado: "SIN_BASE", mesBase: "2020-02-01" } }], DECRETOS_VACIOS],
  [[{ ...TRM, historia: [] }, { ...TPM, historia: TPM.historia.slice(-1) }, { ...IPC, variacion: { estado: "NO_SE_PUDO" } }], TODOS_LOS_ESTADOS],
];

const textoPintado = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");

describe("textos de /datos-oficiales", () => {
  it.each(VARIANTES.map(([series, decretos], k) => [k, series, decretos] as const))("variante %i: no recomienda comprar, vender ni mantener, ni muestra comandos", (_k, series, decretos) => {
    const html = renderToStaticMarkup(createElement(DatosOficiales, { datos: datos(series, decretos), soloLectura: true }));
    const texto = textoPintado(html);
    expect(texto).toContain(PIE_DATOS_OFICIALES);
    expect(texto.replace(PIE_DATOS_OFICIALES, "")).not.toMatch(PROHIBIDO);
    expect(texto).not.toMatch(COMANDO);
    expect(html).not.toMatch(RETENCION);
  });

  it("el candado muerde", () => {
    for (const frase of ["Compre dólares", "Le conviene vender", "Mantenga sus acciones", "Debería esperar", "Señal de compra"]) expect(frase).toMatch(PROHIBIDO);
    expect("A mano: la carga el dueño (vía B)").not.toMatch(PROHIBIDO);
    expect("Corre npx tsx scripts/importar-series.ts").toMatch(COMANDO);
    expect('<td aria-label="Retención en la fuente">').toMatch(RETENCION);
    expect("Diferencia bruto − neto").not.toMatch(RETENCION);
  });
});
