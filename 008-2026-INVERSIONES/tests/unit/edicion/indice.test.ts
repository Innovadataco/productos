// @vitest-environment jsdom
// /edicion · el índice de la configuración (frente menu-configuracion), con el guardián simulado: solo el dueño (a la
// familia, exigirDueno le da 404); enlaza la configuración de la IA, las tarifas de comisión y la edición del plan, cada
// uno con una línea que dice para qué sirve; marca «Configuración» como la sección actual; sin base, el aviso de
// siempre; ningún texto recomienda comprar ni vender. Inventado.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exigirDueno = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirDueno }));

import PaginaConfiguracion from "@/app/edicion/page";
import { PIE_EDICION, TEXTOS_CONFIGURACION } from "@/app/edicion/textos";

const DUENO = { id: "u-dueno", email: "dueno@ejemplo.invalid", rol: "DUENO" };
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

async function pantalla(): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await PaginaConfiguracion());
  return raiz;
}

beforeEach(() => {
  exigirDueno.mockResolvedValue(DUENO);
});
afterEach(() => {
  exigirDueno.mockReset();
  vi.restoreAllMocks();
});

describe("/edicion · índice de la configuración", () => {
  it("la familia (exigirDueno lanza el 404) no ve la página", async () => {
    exigirDueno.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(PaginaConfiguracion()).rejects.toThrow("NOT_FOUND");
  });

  it("el dueño ve el título y los tres enlaces, cada uno con la línea de para qué sirve", async () => {
    const raiz = await pantalla();
    expect(exigirDueno).toHaveBeenCalledTimes(1);
    expect(texto(raiz.querySelector("h1"))).toBe("Configuración");
    const entradas = [...raiz.querySelectorAll("main ul.configuracion > li")].map((li) => [texto(li.querySelector("a")), li.querySelector("a")?.getAttribute("href"), texto(li.querySelector("p"))]);
    expect(entradas.map(([t, href]) => [t, href])).toEqual([
      ["Configuración de la IA", "/edicion/ia"],
      ["Tarifas de comisión", "/edicion/tarifas"],
      ["Editar el plan", "/edicion/plan"],
    ]);
    for (const [t, , linea] of entradas) expect(linea, t).toMatch(/\S.{20,}/);
    expect(entradas.map(([, , linea]) => linea)).toEqual(TEXTOS_CONFIGURACION.ENTRADAS.map((e) => e.para));
    // Sin formularios: el índice solo enlaza.
    expect(raiz.querySelectorAll("form, button, input, select, textarea")).toHaveLength(0);
    expect(texto(raiz.querySelector("footer"))).toContain(PIE_EDICION);
  });

  it("marca «Configuración» como la sección actual del menú común, una sola vez", async () => {
    const raiz = await pantalla();
    const actuales = [...raiz.querySelectorAll('header nav[aria-label="Secciones"] a[aria-current="page"]')].map((a) => [texto(a), a.getAttribute("href")]);
    expect(actuales).toEqual([["Configuración", "/edicion"]]);
  });

  it("no repite en la cabecera los atajos que ya están en la lista", async () => {
    const raiz = await pantalla();
    expect(raiz.querySelectorAll('main a[href="/edicion/ia"]')).toHaveLength(1);
    expect(raiz.querySelectorAll('main a[href="/edicion/tarifas"]')).toHaveLength(1);
  });

  it("sin base, el aviso de siempre (nunca un 500 con el detalle)", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { Prisma } = await import("@prisma/client");
    exigirDueno.mockRejectedValue(new Prisma.PrismaClientInitializationError("sin conexión valor-ficticio-4613", "5.22.0"));
    const raiz = await pantalla();
    expect(texto(raiz)).toContain("No se pudo leer la base de 008");
    expect(texto(raiz)).not.toContain("valor-ficticio-4613");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("valor-ficticio-4613");
  });

  it("ningún texto recomienda comprar ni vender", async () => {
    expect(texto(await pantalla())).not.toMatch(/\b(compre|venda|recomend\w*|debería|le conviene|le sugerimos)\b/i);
  });
});
