// @vitest-environment jsdom
// Candado de lenguaje de /operar (frente operar-informe): 008 no recomienda comprar ni vender. Recorre TODO el texto
// (comentarios incluidos) de src/operar/informe/** y src/app/operar/** y la pantalla pintada con todos sus casos, y falla
// si aparece una expresión de consejo o de juicio. «comprar» y «vender» en infinitivo sí pasan: son la acción que el
// dueño escribió en su plan, y el aviso dice «no recomienda comprar ni vender». Con controles positivos: si el detector
// deja de morder (un texto plantado con «le conviene»), esto se pone rojo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Operar } from "@/app/operar/Operar";
import { aVistaOperar } from "@/app/operar/serializar";
import { AVISO_DECISION } from "@/app/operar/textos";
import { armarInforme } from "@/operar/informe/armar";
import { dia, entradasCompletas, HOY } from "./ficticio";

const SRC = fileURLToPath(new URL("../../../../src/", import.meta.url));
const ZONA = ["operar/informe", "app/operar"].map((d) => join(SRC, d));

/** Las expresiones prohibidas, ya sin tildes y en minúsculas (se comparan con el texto normalizado). */
const PROHIBIDAS: readonly string[] = [
  "compre", "compren", "venda", "vendan", "le recomendamos", "recomendamos", "le recomiendo", "recomendacion", "le sugerimos", "sugerimos",
  "le conviene", "conviene", "convendria", "deberia", "deberian", "buen momento", "mal momento", "oportunidad", "oportunidades", "aproveche",
  "es buena idea", "es mala idea", "le aconsejamos", "aconsejamos",
];

/** Sin marcas diacríticas, en minúsculas y con los espacios juntos. */
const normalizar = (t: string): string => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ");
const PATRON = new RegExp(`(?<![\\p{L}\\p{N}])(${PROHIBIDAS.map((p) => p.replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`, "gu");

/** Las expresiones prohibidas que aparecen en el texto, en orden y sin repetir. */
export function prohibidasEn(texto: string): string[] {
  return [...new Set([...normalizar(texto).matchAll(PATRON)].map((m) => m[1]!))];
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx|css)$/.test(n) ? [ruta] : [];
  });
}

/** Lo que el recorrido encuentra en un árbol de archivos (ruta → texto). */
const hallazgos = (arbol: ReadonlyMap<string, string>): string[] =>
  [...arbol].flatMap(([ruta, t]) => prohibidasEn(t).map((p) => `${ruta}: ${p}`));

const leerZona = (): Map<string, string> => new Map(ZONA.flatMap(archivos).map((r) => [r, readFileSync(r, "utf8")]));

describe("el detector muerde (controles positivos)", () => {
  it.each([
    ["Hoy le conviene vender", ["le conviene"]],
    ["HOY LE CONVIENE VENDER", ["le conviene"]],
    ["Usted debería comprar", ["deberia"]],
    ["Usted deberia comprar", ["deberia"]],
    ["Compren ya", ["compren"]],
    ["Venda la mitad", ["venda"]],
    ["Es un buen   momento", ["buen momento"]],
    ["Una oportunidad única", ["oportunidad"]],
    ["Le recomendamos esperar", ["le recomendamos"]],
    ["Nuestra recomendación: comprar", ["recomendacion"]],
  ] as const)("«%s» → %o", (t, esperado) => {
    expect(prohibidasEn(t)).toEqual(esperado);
  });

  it("un archivo plantado en el árbol de la zona lo pone en rojo", () => {
    const arbol = new Map(leerZona());
    arbol.set(join(SRC, "app/operar/Plantado.tsx"), 'export const X = "Hoy le conviene vender";');
    expect(hallazgos(arbol)).toEqual([`${join(SRC, "app/operar/Plantado.tsx")}: le conviene`]);
  });
});

describe("lo que sí pasa (controles negativos)", () => {
  it.each([
    "Su regla de FICTICIA-A dice: vender 37 acciones si el cierre queda por debajo de $ 4.613,17.",
    "comprar · vender · no actuar",
    AVISO_DECISION,
    "Hoy se cumple",
    "Vendedor y compradores",
    "Ventana de las fechas",
  ])("«%s» no tiene hallazgos", (t) => {
    expect(prohibidasEn(t)).toEqual([]);
  });
});

describe("la zona de /operar no aconseja", () => {
  it("el recorrido ve la zona entera (si no, no probaría nada)", () => {
    const arbol = leerZona();
    expect([...arbol.keys()].filter((r) => r.includes(`${join("src", "operar", "informe")}`)).length).toBeGreaterThanOrEqual(5);
    expect([...arbol.keys()].filter((r) => r.includes(`${join("src", "app", "operar")}`)).length).toBeGreaterThanOrEqual(5);
    expect([...arbol.values()].some((t) => t.includes(AVISO_DECISION))).toBe(true);
  });

  it("ningún archivo de la zona tiene una expresión prohibida, ni en el código ni en los comentarios", () => {
    expect(hallazgos(leerZona())).toEqual([]);
  });

  it.each([
    ["con los precios al día", HOY],
    ["con la carga de precios detenida", dia("2027-03-26")],
  ])("la pantalla pintada con todos sus casos (%s) no tiene ninguna", (_caso, hoy) => {
    const html = renderToStaticMarkup(createElement(Operar, { vista: aVistaOperar(armarInforme(entradasCompletas(), hoy)), soloLectura: false }));
    const raiz = document.createElement("div");
    raiz.innerHTML = html;
    expect(raiz.textContent?.length ?? 0).toBeGreaterThan(500);
    expect(prohibidasEn(raiz.textContent ?? "")).toEqual([]);
    // Los atributos también se leen (lector de pantalla): aria-label, title y alt.
    const atributos = [...raiz.querySelectorAll("[aria-label], [title], [alt]")].flatMap((e) => ["aria-label", "title", "alt"].map((a) => e.getAttribute(a) ?? ""));
    expect(prohibidasEn(atributos.join(" "))).toEqual([]);
  });
});
