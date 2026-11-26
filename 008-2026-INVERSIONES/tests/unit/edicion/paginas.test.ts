// @vitest-environment jsdom
// Las tres páginas del área de edición (fase B, PR-B) con el guardián y las lecturas simulados: exigen al dueño ANTES
// de leer (a la familia, exigirDueno le da 404 y no se lee nada); pintan el encabezado de la sección, el formulario o
// el aviso de cada estado, y el pie que dice que el sistema no recomienda; sin base, el aviso de siempre. Inventado.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exigirDueno = vi.hoisted(() => vi.fn());
const datosEdicionPlan = vi.hoisted(() => vi.fn());
const datosEdicionDecision = vi.hoisted(() => vi.fn());
const datosEdicionEnlace = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirDueno }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/edicion/plan/datos", () => ({ datosEdicionPlan }));
vi.mock("@/app/edicion/decision/datos", () => ({ datosEdicionDecision }));
vi.mock("@/app/edicion/enlace/datos", () => ({ datosEdicionEnlace }));

import PaginaDecision from "@/app/edicion/decision/page";
import PaginaEnlace from "@/app/edicion/enlace/page";
import PaginaPlan from "@/app/edicion/plan/page";
import { PIE_EDICION, TEXTOS_ESTADO } from "@/app/edicion/textos";
import type { DatosEdicionPlan } from "@/app/edicion/tipos";

const DUENO = { id: "u-dueno", email: "dueno@ejemplo.invalid", rol: "DUENO" };
const PLAN: DatosEdicionPlan = { hoy: "2027-02-10", ultima: null, base: null, versiones: [], especies: [{ id: "inst-a", nemotecnico: "FICTA" }], reglas: [], vigenteDesde: "2027-02-10" };
const consulta = (q: Record<string, string> = {}) => ({ searchParams: Promise.resolve(q) });

async function pantalla(p: Promise<React.ReactElement>): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await p);
  return raiz;
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

beforeEach(() => {
  exigirDueno.mockResolvedValue(DUENO);
  datosEdicionPlan.mockResolvedValue(PLAN);
  datosEdicionDecision.mockResolvedValue({ estado: "SIN_PLAN" });
  datosEdicionEnlace.mockResolvedValue({ estado: "NO_EXISTE" });
});
afterEach(() => {
  for (const f of [exigirDueno, datosEdicionPlan, datosEdicionDecision, datosEdicionEnlace]) f.mockReset();
  vi.restoreAllMocks();
});

describe("páginas del área de edición", () => {
  it("la familia (exigirDueno lanza el 404) no llega a leer nada", async () => {
    exigirDueno.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(PaginaPlan(consulta())).rejects.toThrow("NOT_FOUND");
    await expect(PaginaDecision(consulta())).rejects.toThrow("NOT_FOUND");
    await expect(PaginaEnlace(consulta({ decision: "d-1" }))).rejects.toThrow("NOT_FOUND");
    expect(datosEdicionPlan).not.toHaveBeenCalled();
    expect(datosEdicionDecision).not.toHaveBeenCalled();
    expect(datosEdicionEnlace).not.toHaveBeenCalled();
  });

  it("/edicion/plan: el formulario con la sección «Configuración» marcada y el pie; lee con lo que vino en ?base", async () => {
    const raiz = await pantalla(PaginaPlan(consulta({ base: "2" })));
    expect(datosEdicionPlan).toHaveBeenCalledWith({ soy: "la base" }, "2");
    expect(texto(raiz.querySelector("h1"))).toBe("Nueva versión del plan");
    expect(raiz.querySelector('nav[aria-label="Secciones"] a[aria-current="page"]')?.getAttribute("href")).toBe("/edicion");
    expect(raiz.querySelector("form")).not.toBeNull();
    expect(texto(raiz.querySelector("footer"))).toContain(PIE_EDICION);
  });

  it("/edicion/decision: sin plan, el aviso y ningún formulario; una corrección que no se puede, su aviso", async () => {
    let raiz = await pantalla(PaginaDecision(consulta({ corrige: "d-1", orden: "o-1" })));
    expect(datosEdicionDecision).toHaveBeenCalledWith({ soy: "la base" }, { corrige: "d-1", orden: "o-1" });
    expect(texto(raiz.querySelector("main"))).toContain(TEXTOS_ESTADO.SIN_PLAN);
    expect(raiz.querySelector("form")).toBeNull();
    datosEdicionDecision.mockResolvedValue({ estado: "CORRECCION_INVALIDA" });
    raiz = await pantalla(PaginaDecision(consulta({ corrige: "d-1" })));
    expect(texto(raiz.querySelector("main"))).toContain(TEXTOS_ESTADO.CORRECCION_INVALIDA);
    expect(raiz.querySelector('nav[aria-label="Secciones"] a[aria-current="page"]')?.getAttribute("href")).toBe("/decisiones");
  });

  it("/edicion/enlace: cada estado con su aviso (no existe, corregida con su enlace, «no actuar»)", async () => {
    let raiz = await pantalla(PaginaEnlace(consulta({ decision: "d-1" })));
    expect(datosEdicionEnlace).toHaveBeenCalledWith({ soy: "la base" }, "d-1");
    expect(texto(raiz.querySelector("main"))).toContain(TEXTOS_ESTADO.NO_EXISTE);
    datosEdicionEnlace.mockResolvedValue({ estado: "REEMPLAZADA", corregidaPor: "d-2" });
    raiz = await pantalla(PaginaEnlace(consulta({ decision: "d-1" })));
    expect(texto(raiz.querySelector("main"))).toContain(TEXTOS_ESTADO.REEMPLAZADA);
    expect(raiz.querySelector('main a[href="/decisiones/d-2"]')).not.toBeNull();
    datosEdicionEnlace.mockResolvedValue({ estado: "NO_ACTUAR", id: "d-1" });
    raiz = await pantalla(PaginaEnlace(consulta({ decision: "d-1" })));
    expect(texto(raiz.querySelector("main"))).toContain(TEXTOS_ESTADO.NO_ACTUAR);
    expect(raiz.querySelector("form")).toBeNull();
  });

  it("sin base, el aviso de siempre (nunca un 500 con el detalle)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { Prisma } = await import("@prisma/client");
    datosEdicionPlan.mockRejectedValue(new Prisma.PrismaClientInitializationError("sin conexión valor-real", "5.22.0"));
    const raiz = await pantalla(PaginaPlan(consulta()));
    expect(texto(raiz)).not.toContain("valor-real");
    expect(raiz.querySelector("form")).toBeNull();
  });
});
