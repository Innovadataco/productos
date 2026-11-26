// @vitest-environment jsdom
// La página /analisis (frente analisis-pantalla) con los datos simulados: exige la sesión ANTES de leer, la familia la ve
// en solo lectura (sin formularios ni botones), con la base caída muestra «No se pudo leer la base», lleva «Análisis»
// como pantalla actual y pinta las cuatro secciones. Inventado.
import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVistaAnalisis } from "@/app/analisis/vista";
import { SECCIONES } from "@/app/tablero/secciones";
import { fechaEnBogota } from "@/precios/horario";
import { analisis, especie } from "../analisis/fixtures/analisis.ficticio";

const exigirSesion = vi.hoisted(() => vi.fn());
const datosDeAnalisis = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
vi.mock("@/lib/db", () => ({ db: { soy: "la base" } }));
vi.mock("@/app/analisis/datos", () => ({ datosDeAnalisis }));

import PaginaAnalisis from "@/app/analisis/page";

const VISTA = aVistaAnalisis({
  analisis: analisis({ especies: [especie("FICTICIA-A")] }), observaciones: [], nombres: new Map([["FICTICIA-A", "FICTA"]]),
  procedencias: { acciones: [{ dia: "2021-06-14", traidoEn: "2021-06-14 18:37", fuente: "yahoo" }], fondos: new Map() }, diarioTruncado: false, fondosSinValor: [],
});
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
async function pantalla(): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await PaginaAnalisis());
  return raiz;
}

beforeEach(() => {
  exigirSesion.mockResolvedValue({ id: "u-4613", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  datosDeAnalisis.mockResolvedValue(VISTA);
});
afterEach(() => {
  vi.restoreAllMocks();
  exigirSesion.mockReset();
  datosDeAnalisis.mockReset();
});

describe("src/app/analisis/page.tsx", () => {
  it("exige la sesión y después lee con la base del proceso y el día de Colombia", async () => {
    const orden: string[] = [];
    exigirSesion.mockImplementationOnce(async () => { orden.push("sesion"); return { id: "u-4613", rol: "DUENO" }; });
    datosDeAnalisis.mockImplementationOnce(async () => { orden.push("datos"); return VISTA; });
    await PaginaAnalisis();
    expect(orden).toEqual(["sesion", "datos"]);
    expect(datosDeAnalisis.mock.calls[0]![0]).toEqual({ soy: "la base" });
    expect(datosDeAnalisis.mock.calls[0]![1]).toBeInstanceOf(Date);
    expect((datosDeAnalisis.mock.calls[0]![1] as Date).getUTCHours()).toBe(0);
  });

  it("le pasa a la lectura el mismo instante («ahora») con que sacó el día de Colombia: de ahí salen los días hábiles de atraso", async () => {
    await PaginaAnalisis();
    const [, hoy, ahora] = datosDeAnalisis.mock.calls[0]! as [unknown, Date, Date];
    expect(ahora).toBeInstanceOf(Date);
    expect(Math.abs(ahora.getTime() - Date.now())).toBeLessThan(60_000);
    expect(hoy.getTime()).toBe(fechaEnBogota(ahora).getTime());
  });

  it("un cierre con días hábiles de atraso lo avisa en la fecha de los datos; «carga detenida» es otra cosa y se conserva", async () => {
    datosDeAnalisis.mockResolvedValueOnce(aVistaAnalisis({
      analisis: analisis({ especies: [especie("FICTICIA-A")] }), observaciones: [], nombres: new Map([["FICTICIA-A", "FICTA"]]),
      procedencias: { acciones: [{ dia: "2021-06-14", traidoEn: "2021-06-14 18:37", fuente: "yahoo", habilesAtras: 3 }], fondos: new Map() }, diarioTruncado: false, fondosSinValor: [],
    }));
    const raiz = await pantalla();
    expect([...raiz.querySelectorAll(".fecha-dato-aviso")].map(texto)).toEqual(["dato de hace 3 días hábiles"]);
  });

  it("sin sesión no lee nada: la redirección se propaga", async () => {
    exigirSesion.mockRejectedValueOnce(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" }));
    await expect(PaginaAnalisis()).rejects.toThrow("NEXT_REDIRECT");
    expect(datosDeAnalisis).not.toHaveBeenCalled();
  });

  it("con la base caída: «No se pudo leer la base» y solo el código al registro", async () => {
    datosDeAnalisis.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("falló en postgresql://u:clave-secreta@h", { code: "P2021", clientVersion: "5.22.0" }));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(await PaginaAnalisis());
    expect(html).toContain("No se pudo leer la base de Inversiones");
    expect(registro).toHaveBeenCalledWith("[analisis] no se pudo leer la base (código: P2021)");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("clave-secreta");
  });

  it("otro error se propaga (lo atiende src/app/error.tsx)", async () => {
    datosDeAnalisis.mockRejectedValueOnce(new TypeError("x"));
    await expect(PaginaAnalisis()).rejects.toThrow(TypeError);
  });

  it("la navegación común con «Análisis» como pantalla actual, una sola vez", async () => {
    const nav = [...(await pantalla()).querySelectorAll('header nav[aria-label="Secciones"] a')].map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")]);
    expect(nav).toEqual(SECCIONES.map((s) => [s.texto, s.href, s.clave === "analisis" ? "page" : null]));
    expect(nav.filter(([t]) => t === "Análisis")).toEqual([["Análisis", "/analisis", "page"]]);
    // El dueño ve «Configuración» al final (frente menu-configuracion); la familia, la lista de siempre sin ella.
    expect(nav.at(-1)).toEqual(["Configuración", "/edicion", null]);
    exigirSesion.mockResolvedValueOnce({ id: "u-familia", rol: "FAMILIA" });
    const familia = [...(await pantalla()).querySelectorAll('header nav[aria-label="Secciones"] a')].map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")]);
    expect(familia).toEqual(nav.slice(0, -1));
    expect(familia.map(([t]) => t)).not.toContain("Configuración");
  });

  it("el familiar ve «Solo lectura»; el dueño no; y no hay formularios ni botones", async () => {
    exigirSesion.mockResolvedValueOnce({ id: "u-familia", rol: "FAMILIA" });
    const familia = await pantalla();
    expect(familia.querySelector("header .solo-lectura")).not.toBeNull();
    expect(familia.querySelectorAll("form, button, input, textarea, select")).toHaveLength(0);
    expect((await pantalla()).querySelector("header .solo-lectura")).toBeNull();
  });

  it("las cuatro secciones, la fecha de los datos y el pie", async () => {
    const raiz = await pantalla();
    expect([...raiz.querySelectorAll("main h2")].map(texto)).toEqual(["Por especie", "Portafolio", "Sus decisiones", "Puntos para revisar"]);
    expect(raiz.querySelector("main .fecha-dato")).not.toBeNull();
    expect(texto(raiz.querySelector("main"))).toContain("de precios diarios");
    expect(texto(raiz.querySelector("footer.pie"))).toContain("no recomienda comprar ni vender");
  });
});
