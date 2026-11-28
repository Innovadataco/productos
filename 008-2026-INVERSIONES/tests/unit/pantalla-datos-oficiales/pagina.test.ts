// @vitest-environment jsdom
// La página /datos-oficiales (frente datos-oficiales-pantalla, C6a) con la sesión y los datos simulados: exige la sesión
// ANTES de leer y lee con el día de Colombia (no el UTC); la marca «Solo lectura» sale del rol de la sesión revalidada;
// con la base caída, «No se pudo leer la base» (solo el código al registro); otro error se propaga. Inventado.
import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { datos } from "./ficticio";

const exigirSesion = vi.hoisted(() => vi.fn());
const datosOficiales = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/datos-oficiales/datos", () => ({ datosOficiales }));

import PaginaDatosOficiales, { dynamic } from "@/app/datos-oficiales/page";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function pantalla(html: string): HTMLElement {
  const raiz = document.createElement("div");
  raiz.innerHTML = html;
  return raiz;
}

beforeEach(() => {
  exigirSesion.mockResolvedValue({ id: "u-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  datosOficiales.mockResolvedValue(datos());
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  exigirSesion.mockReset();
  datosOficiales.mockReset();
});

describe("src/app/datos-oficiales/page.tsx", () => {
  it("se lee en cada visita", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("exige la sesión y después lee, con la base del proceso y el día de Colombia", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 22:30 del 17-mar-2021 en Colombia: en UTC ya es el 18.
    vi.setSystemTime(new Date("2021-03-18T03:30:00Z"));
    const orden: string[] = [];
    exigirSesion.mockImplementationOnce(async () => { orden.push("sesion"); return { id: "u-4613", rol: "DUENO" }; });
    datosOficiales.mockImplementationOnce(async () => { orden.push("datos"); return datos(); });
    await PaginaDatosOficiales();
    expect(orden).toEqual(["sesion", "datos"]);
    expect(datosOficiales).toHaveBeenCalledWith({ soy: "la base" }, new Date("2021-03-17T00:00:00Z"));
  });

  it("sin sesión no lee nada: la redirección se propaga", async () => {
    exigirSesion.mockRejectedValueOnce(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" }));
    await expect(PaginaDatosOficiales()).rejects.toThrow("NEXT_REDIRECT");
    expect(datosOficiales).not.toHaveBeenCalled();
  });

  it("con la base caída: «No se pudo leer la base» y solo el código al registro", async () => {
    datosOficiales.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("falló en postgresql://u:clave-secreta@h", { code: "P2021", clientVersion: "5.22.0" }));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(await PaginaDatosOficiales());
    expect(html).toContain("No se pudo leer la base de Inversiones");
    expect(registro).toHaveBeenCalledWith("[datos-oficiales] no se pudo leer la base (código: P2021)");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave-secreta");
  });

  it("si la base cae al revalidar la sesión, «No se pudo leer la base» y no se lee nada (revisión security-reviewer, BAJO)", async () => {
    exigirSesion.mockRejectedValueOnce(new Prisma.PrismaClientInitializationError("sin conexión a postgresql://u:clave-secreta@h", "5.22.0"));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(await PaginaDatosOficiales());
    expect(html).toContain("No se pudo leer la base de Inversiones");
    expect(html).not.toContain("Datos oficiales");
    expect(datosOficiales).not.toHaveBeenCalled();
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave-secreta");
  });

  it("otro error se propaga (lo atiende src/app/error.tsx)", async () => {
    datosOficiales.mockRejectedValueOnce(new TypeError("x"));
    await expect(PaginaDatosOficiales()).rejects.toThrow(TypeError);
  });

  it.each([["FAMILIA", "Solo lectura"], ["DUENO", null]] as const)("rol %s: la marca del encabezado es %s", async (rol, marca) => {
    exigirSesion.mockResolvedValue({ id: "u-4613", email: "x@ejemplo.invalid", rol });
    const raiz = pantalla(renderToStaticMarkup(await PaginaDatosOficiales()));
    expect(raiz.querySelector("header .solo-lectura")?.textContent ?? null).toBe(marca);
  });

  it("la navegación lleva «Datos oficiales» como pantalla actual, antes de «Análisis»", async () => {
    const raiz = pantalla(renderToStaticMarkup(await PaginaDatosOficiales()));
    const nav = [...raiz.querySelectorAll('header nav[aria-label="Secciones"] a')].map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")]);
    expect(nav).toEqual([
      ["Portafolio", "/", null], ["Plan", "/plan", null], ["Operar", "/operar", null], ["Decisiones", "/decisiones", null], ["Conciliación", "/conciliacion", null],
      ["Proyecciones", "/proyecciones", null], ["Datos oficiales", "/datos-oficiales", "page"], ["Análisis", "/analisis", null], ["Configuración", "/edicion", null],
    ]);
  });

  it("deriva la marca de la sesión revalidada, con la forma de las demás páginas (tests/unit/app/solo-lectura.test.ts)", () => {
    const fuente = readFileSync(join(RAIZ, "src/app/datos-oficiales/page.tsx"), "utf8");
    expect(fuente).toMatch(/const usuario = await exigirSesion\(\);/);
    expect(fuente).toMatch(/soloLectura = esSoloLectura\(usuario\);/);
    expect(fuente).toMatch(/soloLectura=\{soloLectura\}/);
    expect(fuente).not.toMatch(/soloLectura=\{(?:true|false)\}/);
    expect(fuente).not.toMatch(/\bexigirDueno\(/);
  });
});
