// Candado de lenguaje de /analisis (frente analisis-pantalla): 008 no recomienda comprar ni vender. Recorre TODO el
// texto de src/app/analisis/** (comentarios incluidos) y la pantalla pintada con un análisis que dispara todas las
// observaciones, con el detector de /operar (tests/unit/operar/informe/lenguaje.ts, `prohibidasEn`). Con controles
// positivos: si el detector deja de morder, o un archivo plantado en la zona no se detecta, esto se pone rojo. Inventado.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { observaciones } from "@/analisis/observaciones";
import { Analisis } from "@/app/analisis/Analisis";
import { aVistaAnalisis } from "@/app/analisis/vista";
import { analisisConTodo, HOY } from "../analisis/fixtures/analisis.ficticio";
import { dia } from "../analisis/fixtures/portafolio.ficticio";
import { prohibidasEn } from "../operar/informe/lenguaje";

const ZONA = join(process.cwd(), "src", "app", "analisis");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx|css)$/.test(n) ? [ruta] : [];
  });
}
const hallazgos = (arbol: ReadonlyMap<string, string>): string[] => [...arbol].flatMap(([ruta, t]) => prohibidasEn(t).map((p) => `${ruta}: ${p}`));
const leerZona = (): Map<string, string> => new Map(archivos(ZONA).map((r) => [r, readFileSync(r, "utf8")]));

function pintada(): string {
  const { a, reglas } = analisisConTodo();
  const nombres = new Map(["FICTICIA-A", "FICTICIA-B", "FICTICIA-C", "FICTICIA-D"].map((id, k) => [id, `FICT${k}`]));
  const vista = aVistaAnalisis({ analisis: a, observaciones: observaciones(a, { reglas }, dia(HOY)), nombres, procedencias: { acciones: [], fondos: new Map() }, diarioTruncado: true, fondosSinValor: ["FICTICIA-FIC"] });
  return renderToStaticMarkup(createElement(Analisis, { vista, soloLectura: true }));
}

describe("el detector muerde (controles positivos)", () => {
  it.each(["le conviene revisar", "Compre ya", "es buen momento", "le recomendamos", "una oportunidad", "debería reducir"])("«%s»", (t) => {
    expect(prohibidasEn(t).length).toBeGreaterThan(0);
  });

  it("un archivo plantado en una copia de la zona la pone en rojo", () => {
    const copia = new Map([...leerZona(), ["plantado.ts", "// es hora de vender\n"]]);
    expect(hallazgos(copia)).toEqual(["plantado.ts: es hora de"]);
  });
});

describe("la zona y la pantalla", () => {
  it("recorre la zona entera (no un directorio vacío)", () => {
    expect([...leerZona().keys()].map((r) => r.slice(ZONA.length + 1)).sort()).toEqual(expect.arrayContaining(["Analisis.tsx", "datos.ts", "page.tsx", "textos.ts", "vista.ts"]));
  });

  it("ningún archivo de src/app/analisis da consejo ni juicio", () => {
    expect(hallazgos(leerZona())).toEqual([]);
  });

  it("la pantalla pintada con todos los puntos para revisar tampoco", () => {
    const html = pintada();
    expect(html).toContain("umbral:");
    expect(prohibidasEn(html.replace(/<[^>]+>/g, " "))).toEqual([]);
  });

  it("y lleva el pie: el sistema calcula y muestra, no recomienda", () => {
    expect(pintada()).toContain("no recomienda comprar ni vender");
  });
});

describe("revisión (react-reviewer, MEDIO) · claves", () => {
  it("las listas de la pantalla no usan el nombre como clave (puede repetirse): usan el id de la vista", () => {
    const fuente = readFileSync(join(ZONA, "Analisis.tsx"), "utf8");
    expect(fuente).not.toMatch(/key=\{(?:[a-z]\.)?nombre\}|key=\{x\}|key=\{t\}|key=\{l\}/);
  });
});
