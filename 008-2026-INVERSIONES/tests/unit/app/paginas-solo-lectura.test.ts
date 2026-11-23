// @vitest-environment jsdom
// Las seis páginas de lectura con la sesión y los datos simulados (frente familia-lectura, revisión react MEDIO 2): la
// marca «Solo lectura» sale del rol de la sesión revalidada que devuelve exigirSesion, no de otra cosa. Con un familiar
// aparece en el encabezado; con el dueño, no. Se pinta la página entera (no se mira su código). Datos inventados.
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { vistaResumenFicticia } from "../resumen-ia/vista.ficticio";

const exigirSesion = vi.hoisted(() => vi.fn());
const datosDelPlan = vi.hoisted(() => vi.fn());
const datosDelDiario = vi.hoisted(() => vi.fn());
const datosDeDecision = vi.hoisted(() => vi.fn());
const datosDeConciliacion = vi.hoisted(() => vi.fn());
const datosDeProyecciones = vi.hoisted(() => vi.fn());
const obtenerResumen = vi.hoisted(() => vi.fn());
const obtenerEvolucion = vi.hoisted(() => vi.fn());
const ultimaConciliacion = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
const resumenDelDia = vi.hoisted(() => vi.fn());
vi.mock("@/app/_comun/resumen-ia/leer", () => ({ resumenDelDia }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/app/plan/datos", () => ({ datosDelPlan }));
vi.mock("@/app/decisiones/datos", () => ({ datosDelDiario }));
vi.mock("@/app/decisiones/[id]/datos", () => ({ datosDeDecision }));
vi.mock("@/app/conciliacion/datos", () => ({ datosDeConciliacion }));
vi.mock("@/app/proyecciones/datos", () => ({ datosDeProyecciones }));
vi.mock("@/tablero/datos", () => ({ obtenerResumen }));
vi.mock("@/tablero/datos-evolucion", () => ({ obtenerEvolucion }));
vi.mock("@/conciliacion/leer", () => ({ ultimaConciliacion }));

import Inicio from "@/app/page";
import PaginaConciliacion from "@/app/conciliacion/page";
import PaginaDecision from "@/app/decisiones/[id]/page";
import PaginaDiario from "@/app/decisiones/page";
import PaginaPlan from "@/app/plan/page";
import PaginaProyecciones from "@/app/proyecciones/page";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { resultadoFicticio } from "../pantalla-proyecciones/ficticio";
import { D, especie, resumenDe } from "../tablero/ficticio";

const CERO = { funciono: 0, noFunciono: 0, neutro: 0, sinVeredicto: 0, pendiente: 0, sinPrecio: 0, sinOrden: 0 };
const vacio = Promise.resolve({});

const PAGINAS: readonly (readonly [string, () => Promise<ReactElement>])[] = [
  ["Portafolio (/)", () => Inicio()],
  ["Plan", () => PaginaPlan({ searchParams: vacio })],
  ["Decisiones", () => PaginaDiario({ searchParams: vacio })],
  ["Detalle de una decisión", () => PaginaDecision({ params: Promise.resolve({ id: "d-ficticia" }) })],
  ["Conciliación", () => PaginaConciliacion({ searchParams: vacio })],
  ["Proyecciones", () => PaginaProyecciones()],
];

async function marca(pagina: () => Promise<ReactElement>): Promise<string | null> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await pagina());
  if (!raiz.querySelector("header")) throw new Error("La página no pintó su encabezado.");
  return raiz.querySelector("header .solo-lectura")?.textContent ?? null;
}

beforeEach(() => {
  vi.resetAllMocks();
  resumenDelDia.mockImplementation(async (_db: unknown, tipo: "DIARIO" | "REGLAS" | "ESCENARIOS") => vistaResumenFicticia(tipo));
  datosDelPlan.mockResolvedValue({ estado: "SIN_PLAN" });
  datosDelDiario.mockResolvedValue({ decisiones: [], truncado: false, resumen: { d30: CERO, d90: CERO }, inicioPlan: null, sinDecision: [], anteriores: [], filtro: null, filtroInvalido: false });
  datosDeDecision.mockResolvedValue({ estado: "NO_EXISTE" });
  datosDeConciliacion.mockResolvedValue({ estado: "SIN_CERTIFICACION" });
  datosDeProyecciones.mockResolvedValue({ hoy: "2027-03-17", historia: [], inicial: aVistaProyeccion(resultadoFicticio()), estado: "LISTO" });
  obtenerResumen.mockResolvedValue(resumenDe([especie({ nemotecnico: "FICT1", cantidad: 37n, costoVivo: D(4613) })]));
  obtenerEvolucion.mockResolvedValue({ metodo: "twr-acciones-v1", puntos: [], rangos: [], omitidos: 0, sinCierre: [] });
  ultimaConciliacion.mockResolvedValue(null);
});

describe("cada página de lectura pinta «Solo lectura» según el rol de la sesión", () => {
  it.each(PAGINAS)("%s: con un familiar, la marca está en el encabezado", async (_nombre, pagina) => {
    exigirSesion.mockResolvedValue({ id: "u-familiar", email: "familiar@ejemplo.invalid", rol: "FAMILIA" });
    expect(await marca(pagina)).toBe("Solo lectura");
    expect(exigirSesion).toHaveBeenCalledTimes(1);
  });

  it.each(PAGINAS)("%s: con el dueño, no hay marca", async (_nombre, pagina) => {
    exigirSesion.mockResolvedValue({ id: "u-dueno", email: "dueno@ejemplo.invalid", rol: "DUENO" });
    expect(await marca(pagina)).toBeNull();
  });
});

describe("la tarjeta del resumen (E5), también para la familia en solo lectura", () => {
  const CON_RESUMEN = [
    ["Portafolio (/)", "DIARIO", () => Inicio()],
    ["Plan", "REGLAS", () => PaginaPlan({ searchParams: vacio })],
    ["Proyecciones", "ESCENARIOS", () => PaginaProyecciones()],
  ] as const;

  it.each(CON_RESUMEN)("%s: pide el resumen %s con el id de la sesión y lo pinta", async (_nombre, tipo, pagina) => {
    exigirSesion.mockResolvedValue({ id: "u-familiar", email: "familiar@ejemplo.invalid", rol: "FAMILIA" });
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await pagina());
    expect(resumenDelDia).toHaveBeenCalledWith(expect.anything(), tipo, "u-familiar");
    expect(raiz.querySelector(`#t-resumen-ia-${tipo.toLowerCase()}`)?.textContent).toBe(`Resumen ficticio ${tipo}`);
  });

  // Revisión (react-reviewer MEDIO): el h2 de la tarjeta va después del h1 de la página.
  it.each(CON_RESUMEN)("%s: la tarjeta va después del título principal (orden de encabezados)", async (_nombre, tipo, pagina) => {
    exigirSesion.mockResolvedValue({ id: "u-dueno", email: "dueno@ejemplo.invalid", rol: "DUENO" });
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await pagina());
    const h1 = raiz.querySelector("h1");
    const h2 = raiz.querySelector(`#t-resumen-ia-${tipo.toLowerCase()}`);
    expect(h1).not.toBeNull();
    expect(h2).not.toBeNull();
    expect(h1!.compareDocumentPosition(h2!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("el plan de otra versión (?version=) no pide ni pinta el resumen", async () => {
    exigirSesion.mockResolvedValue({ id: "u-dueno", email: "dueno@ejemplo.invalid", rol: "DUENO" });
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToStaticMarkup(await PaginaPlan({ searchParams: Promise.resolve({ version: "3" }) }));
    expect(resumenDelDia).not.toHaveBeenCalled();
    expect(raiz.querySelector("section.resumen-ia")).toBeNull();
  });
});
