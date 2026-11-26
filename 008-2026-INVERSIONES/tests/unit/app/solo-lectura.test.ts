// @vitest-environment jsdom
// «Solo lectura» en la pantalla (frente familia-lectura): el familiar ve la marca en el encabezado de las cinco pantallas
// (Portafolio, Plan, Decisiones y su detalle, Conciliación y Proyecciones); el dueño no la ve. Cada página la deriva de la
// sesión revalidada (esSoloLectura), nunca de algo del navegador. Ningún texto nuevo recomienda comprar ni vender, y el
// pie del plan no le dice al familiar que él aprobó el plan. Datos inventados.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Encabezado } from "@/app/_plan/Encabezado";
import { PIE_PLAN } from "@/app/_plan/textos";
import type { ConteoVista } from "@/app/_plan/tipos";
import { Conciliacion } from "@/app/conciliacion/Conciliacion";
import { Cadena } from "@/app/decisiones/[id]/Cadena";
import { Diario } from "@/app/decisiones/Diario";
import { Plan } from "@/app/plan/Plan";
import { aVista } from "@/app/tablero/serializar";
import { MarcaSoloLectura, TEXTO_SOLO_LECTURA } from "@/app/tablero/SoloLectura";
import { Tablero } from "@/app/tablero/Tablero";
import { MENSAJE_FUERA_DE_PLAZO, MENSAJE_SOLO_LECTURA } from "@/auth/respuestas";
import { D, especie, resumenDe } from "../tablero/ficticio";

// En jsdom, `URL` es el del navegador: la ruta sale del texto de import.meta.url.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const leer = (relativa: string) => readFileSync(join(RAIZ, relativa), "utf8");

const CERO: ConteoVista = { funciono: 0, noFunciono: 0, neutro: 0, sinVeredicto: 0, pendiente: 0, sinPrecio: 0, sinOrden: 0 };
const DIARIO_VACIO = { decisiones: [], truncado: false, resumen: { d30: CERO, d90: CERO }, inicioPlan: null, sinDecision: [], anteriores: [], filtro: null, filtroInvalido: false };
const VISTA = aVista(resumenDe([especie({ nemotecnico: "FICT1", cantidad: 37n, costoVivo: D(4613) })]));

/** El encabezado de cada pantalla, con y sin la marca. */
const PANTALLAS: readonly (readonly [string, (soloLectura: boolean | undefined) => ReactElement])[] = [
  ["Portafolio", (s) => createElement(Tablero, { vista: VISTA, soloLectura: s })],
  ["Plan", (s) => createElement(Plan, { datos: { estado: "SIN_PLAN" }, soloLectura: s })],
  ["Decisiones", (s) => createElement(Diario, { vista: DIARIO_VACIO, soloLectura: s })],
  ["Detalle de una decisión", (s) => createElement(Cadena, { datos: { estado: "NO_EXISTE" }, soloLectura: s })],
  ["Conciliación", (s) => createElement(Conciliacion, { datos: { estado: "SIN_CERTIFICACION" }, soloLectura: s })],
  ["Proyecciones (encabezado común)", (s) => createElement(Encabezado, { actual: "proyecciones", soloLectura: s })],
];

function encabezado(el: ReactElement): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(el);
  const header = raiz.querySelector("header");
  if (!header) throw new Error("La pantalla no pintó su encabezado.");
  return header;
}

describe("la marca «Solo lectura»", () => {
  it("dice «Solo lectura» y no trae botones ni formularios", () => {
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(createElement(MarcaSoloLectura));
    expect(TEXTO_SOLO_LECTURA).toBe("Solo lectura");
    expect(raiz.textContent).toContain("Solo lectura");
    expect(raiz.querySelectorAll("button, form, a, input")).toHaveLength(0);
  });

  it.each(PANTALLAS)("%s: el familiar la ve en el encabezado; el dueño no", (_nombre, pintar) => {
    expect(encabezado(pintar(true)).querySelector(".solo-lectura")?.textContent).toBe("Solo lectura");
    expect(encabezado(pintar(false)).querySelector(".solo-lectura")).toBeNull();
    expect(encabezado(pintar(undefined)).querySelector(".solo-lectura")).toBeNull();
  });

  it.each(PANTALLAS)("%s: el familiar no ve «Configuración» ni ningún enlace a /edicion en el encabezado", (_nombre, pintar) => {
    const header = encabezado(pintar(true));
    expect(header.querySelector('a[href^="/edicion"]')).toBeNull();
    expect(header.textContent ?? "").not.toContain("Configuración");
  });

  it("el encabezado común: el dueño ve «Configuración» al final del menú, hacia /edicion", () => {
    for (const s of [false, undefined]) {
      const enlaces = [...encabezado(createElement(Encabezado, { actual: "proyecciones", soloLectura: s })).querySelectorAll('nav[aria-label="Secciones"] a')];
      expect([enlaces.at(-1)?.textContent, enlaces.at(-1)?.getAttribute("href")]).toEqual(["Configuración", "/edicion"]);
    }
  });
});

describe("cada página deriva la marca de la sesión revalidada", () => {
  it.each([
    "src/app/page.tsx",
    "src/app/plan/page.tsx",
    "src/app/decisiones/page.tsx",
    "src/app/decisiones/[id]/page.tsx",
    "src/app/conciliacion/page.tsx",
    "src/app/proyecciones/page.tsx",
  ])("%s pasa soloLectura={…} calculado con esSoloLectura(usuario de exigirSesion)", (pagina) => {
    const fuente = leer(pagina);
    // El mismo usuario de la sesión, y el valor calculado llega tal cual al componente (no un literal).
    expect(fuente).toMatch(/const usuario = await exigirSesion\(\);/);
    expect(fuente).toMatch(/soloLectura = esSoloLectura\(usuario\);/);
    expect(fuente).toMatch(/soloLectura=\{soloLectura\}/);
    expect(fuente).not.toMatch(/soloLectura=\{(?:true|false)\}/);
  });

  it.each(["src/app/plan/Plan.tsx", "src/app/decisiones/Diario.tsx", "src/app/decisiones/[id]/Cadena.tsx"])("%s pasa soloLectura a su Encabezado", (componente) => {
    expect(leer(componente)).toMatch(/<Encabezado actual="[a-z]+" soloLectura=\{soloLectura\} \/>/);
  });
});

describe("textos para la familia", () => {
  it("el pie del plan no dice que quien lo ve aprobó el plan (puede ser un familiar)", () => {
    expect(PIE_PLAN).not.toMatch(/usted aprobó/);
    expect(PIE_PLAN).toContain("no recomienda comprar ni vender");
  });

  it("el aviso de solo lectura y el de fuera de plazo sirven al dueño y al familiar, sin recomendar comprar ni vender", () => {
    expect(MENSAJE_SOLO_LECTURA).toMatch(/[Ss]olo lectura/);
    expect(MENSAJE_FUERA_DE_PLAZO).toMatch(/^Pasaron más de 30 minutos/);
    expect(MENSAJE_FUERA_DE_PLAZO).toMatch(/Familiar: pídale al dueño/);
    expect(MENSAJE_FUERA_DE_PLAZO).toContain("crear-acceso-inicial");
    for (const texto of [MENSAJE_SOLO_LECTURA, MENSAJE_FUERA_DE_PLAZO, TEXTO_SOLO_LECTURA]) expect(texto).not.toMatch(/compr|vend/i);
  });
});
