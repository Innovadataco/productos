// @vitest-environment jsdom
// La página /proyecciones (frente proyecciones-pantalla) con los datos simulados: exige la sesión ANTES de leer, con la
// base caída muestra «No se pudo leer la base» (solo el código al registro), lleva la navegación con «Proyecciones» como
// actual, el aviso fijo, el pie que dice que no recomienda y la tabla de datos de la gráfica. Inventado.
import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vistaResumenFicticia } from "../resumen-ia/vista.ficticio";
import { AVISO } from "@/proyecciones/tipos";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { resultadoFicticio } from "./ficticio";

const exigirSesion = vi.hoisted(() => vi.fn());
const datosDeProyecciones = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
const resumenDelDia = vi.hoisted(() => vi.fn());
vi.mock("@/app/_comun/resumen-ia/leer", () => ({ resumenDelDia }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/proyecciones/datos", () => ({ datosDeProyecciones }));

import PaginaProyecciones from "@/app/proyecciones/page";

const VISTA = aVistaProyeccion(resultadoFicticio());
const DATOS = { hoy: "2027-03-17", historia: [{ dia: "2027-02-26", valor: 45_793.29 }], inicial: VISTA, estado: "LISTO" };
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function pantalla(html: string): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = html;
  return raiz;
}

beforeEach(() => {
  resumenDelDia.mockImplementation(async (_db: unknown, tipo: "DIARIO" | "REGLAS" | "ESCENARIOS") => vistaResumenFicticia(tipo));
  exigirSesion.mockResolvedValue({ id: "u-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  datosDeProyecciones.mockResolvedValue(DATOS);
});
afterEach(() => {
  vi.restoreAllMocks();
  exigirSesion.mockReset();
  datosDeProyecciones.mockReset();
});

describe("src/app/proyecciones/page.tsx", () => {
  it("exige la sesión y después lee con el id del usuario y la base del proceso", async () => {
    const orden: string[] = [];
    exigirSesion.mockImplementationOnce(async () => { orden.push("sesion"); return { id: "u-4613" }; });
    datosDeProyecciones.mockImplementationOnce(async () => { orden.push("datos"); return DATOS; });
    await PaginaProyecciones();
    expect(orden).toEqual(["sesion", "datos"]);
    expect(datosDeProyecciones).toHaveBeenCalledWith({ soy: "la base" }, "u-4613");
  });

  it("sin sesión no lee nada: la redirección se propaga", async () => {
    exigirSesion.mockRejectedValueOnce(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" }));
    await expect(PaginaProyecciones()).rejects.toThrow("NEXT_REDIRECT");
    expect(datosDeProyecciones).not.toHaveBeenCalled();
  });

  it("con la base caída: «No se pudo leer la base» y solo el código al registro", async () => {
    datosDeProyecciones.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("falló en postgresql://u:clave-secreta@h", { code: "P2021", clientVersion: "5.22.0" }));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(await PaginaProyecciones());
    expect(html).toContain("No se pudo leer la base de 008");
    expect(registro).toHaveBeenCalledWith("[proyecciones] no se pudo leer la base (código: P2021)");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave-secreta");
  });

  it("otro error se propaga (lo atiende src/app/error.tsx)", async () => {
    datosDeProyecciones.mockRejectedValueOnce(new TypeError("x"));
    await expect(PaginaProyecciones()).rejects.toThrow(TypeError);
  });

  it("la navegación lleva «Proyecciones» como pantalla actual, junto a las demás", async () => {
    const raiz = pantalla(renderToStaticMarkup(await PaginaProyecciones()));
    const nav = [...raiz.querySelectorAll('header nav[aria-label="Secciones"] a')].map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")]);
    expect(nav).toEqual([
      ["Portafolio", "/", null], ["Plan", "/plan", null], ["Operar", "/operar", null], ["Decisiones", "/decisiones", null], ["Conciliación", "/conciliacion", null], ["Proyecciones", "/proyecciones", "page"], ["Datos oficiales", "/datos-oficiales", null], ["Análisis", "/analisis", null], ["Configuración", "/edicion", null],
    ]);
  });

  it("el aviso fijo, el pie y la tabla de datos de la gráfica (render del servidor, sin JS)", async () => {
    const raiz = pantalla(renderToStaticMarkup(await PaginaProyecciones()));
    expect(texto(raiz.querySelector(".proy-aviso"))).toContain(AVISO);
    expect(texto(raiz.querySelector("footer.pie"))).toBe("El sistema calcula y muestra; no recomienda comprar ni vender.");
    expect(texto(raiz.querySelector("figure details summary"))).toBe("Ver los datos");
    expect(raiz.querySelector("figure [role=slider]")).not.toBeNull();
  });
});
