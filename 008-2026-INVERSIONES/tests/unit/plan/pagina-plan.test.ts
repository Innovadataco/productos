// @vitest-environment jsdom
// Pantalla /plan (fase B, corte 3) con las lecturas simuladas: página → datos → vista → componente, render del
// servidor, leída como la lee una persona. Exige sesión antes de leer; la versión del query se acepta solo si es,
// tal cual, una de las cargadas (sin eco); «sin negociación desde…» en vez de un precio viejo; no recomienda nada.
// Datos inventados (tests/unit/plan/ficticio-pantallas.ts).
import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vistaResumenFicticia } from "../resumen-ia/vista.ficticio";
import { AHORA, CALENDARIO, CIERRES, REFERENCIA, REGLAS_V1, VERSIONES } from "./ficticio-pantallas";

const exigirSesion = vi.hoisted(() => vi.fn());
const leerVersiones = vi.hoisted(() => vi.fn());
const leerReglas = vi.hoisted(() => vi.fn());
const ultimosCierres = vi.hoisted(() => vi.fn());
const calendarioBvc = vi.hoisted(() => vi.fn());
const obtenerResumen = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
const resumenDelDia = vi.hoisted(() => vi.fn());
vi.mock("@/app/_comun/resumen-ia/leer", () => ({ resumenDelDia }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/plan/lectura", () => ({ leerVersiones, leerReglas, ultimosCierres, calendarioBvc }));
vi.mock("@/tablero/datos", () => ({ obtenerResumen }));

import Pagina from "@/app/plan/page";

type Consulta = Record<string, string | string[] | undefined>;
let registro: ReturnType<typeof vi.spyOn>;

async function pantalla(consulta: Consulta = {}): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(consulta) }));
  return raiz;
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const fila = (raiz: HTMLElement, especie: string) => [...raiz.querySelectorAll("tbody tr")].find((tr) => texto(tr.querySelector("th")) === especie);
const celdas = (tr: Element | undefined) => [...(tr?.querySelectorAll("th, td") ?? [])].map(texto);
const columnas = (raiz: HTMLElement) => [...raiz.querySelectorAll("thead th")].map(texto);

beforeEach(() => {
  resumenDelDia.mockImplementation(async (_db: unknown, tipo: "DIARIO" | "REGLAS" | "ESCENARIOS") => vistaResumenFicticia(tipo));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  exigirSesion.mockResolvedValue({ id: "u1", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  leerVersiones.mockResolvedValue(VERSIONES);
  leerReglas.mockImplementation(async (_db: unknown, id: string) => (id === "v1" ? REGLAS_V1 : [REGLAS_V1[2]]));
  ultimosCierres.mockResolvedValue(CIERRES);
  calendarioBvc.mockResolvedValue(CALENDARIO);
  obtenerResumen.mockResolvedValue({ tablero: { fechaReferencia: REFERENCIA } });
  registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  registro.mockRestore();
  for (const f of [exigirSesion, leerVersiones, leerReglas, ultimosCierres, calendarioBvc, obtenerResumen]) f.mockReset();
});

describe("src/app/plan/page.tsx · sesión y base", () => {
  it("sin sesión no lee la base: la redirección de exigirSesion se propaga", async () => {
    const redireccion = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" });
    exigirSesion.mockRejectedValueOnce(redireccion);
    await expect(Pagina({ searchParams: Promise.resolve({}) })).rejects.toBe(redireccion);
    expect(leerVersiones).not.toHaveBeenCalled();
  });

  it("con la base caída muestra «No se pudo leer la base» y registra solo el código", async () => {
    leerVersiones.mockRejectedValueOnce(new Prisma.PrismaClientInitializationError("Can't reach postgresql://usuario:clave@host-privado:5438", "5.22.0", "P1001"));
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("No se pudo leer la base de 008");
    expect(registro).toHaveBeenCalledWith("[plan] no se pudo leer la base (código: P1001)");
  });

  it("sin versiones del plan lo dice, sin tabla", async () => {
    leerVersiones.mockResolvedValueOnce([]);
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("Todavía no hay un plan cargado");
    expect(raiz.querySelector("table")).toBeNull();
  });
});

describe("la versión vigente, con cierres y distancia al nivel", () => {
  it("titula la vigente hoy, con su fecha y motivo, y avisa la programada", async () => {
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("h1"))).toBe("Plan vigente: versión 1");
    expect(texto(raiz)).toContain("Vigente desde el 1-jul-2024. Motivo: Plan ficticio inicial.");
    expect(texto(raiz)).toContain("Cierres al 22-nov-2024");
    const programada = [...raiz.querySelectorAll("a")].find((a) => texto(a) === "La versión 2 entra a regir el 10-ene-2025.");
    expect(programada?.getAttribute("href")).toBe("/plan?version=2");
    expect(texto(raiz)).not.toContain("Los precios no se han actualizado");
  });

  it("columnas y filas: especie, condición, nivel, acción de su regla, cierre y frente al nivel", async () => {
    const raiz = await pantalla();
    expect(columnas(raiz)).toEqual(["Especie", "Condición", "Nivel", "Acción de su regla", "Cantidad", "Plazo", "Último cierre", "Frente al nivel", "Decisiones", "Detalle"]);
    expect([...raiz.querySelectorAll("tbody th")].map(texto)).toEqual(["FICTA", "FICTB", "FICTC", "FICTP", "Portafolio", "Portafolio"]);
    const a = celdas(fila(raiz, "FICTA"));
    expect(a.slice(0, 6)).toEqual(["FICTA", "Cierre por encima de", "$ 1.200", "vender", "50", "sin plazo"]);
    expect(a[6]).toContain("$ 1.100 · 22-nov-2024");
    expect(a[6]).toContain("sin verificar");
    expect(a.slice(7, 9)).toEqual(["a +9,1 % del nivel", "2"]);
    expect(celdas(fila(raiz, "FICTB")).slice(5, 8)).toEqual([
      "venció el 31-oct-2024", "$ 1.913 · 22-nov-2024verificado A&Vtraído el 14-ene-2027 a las 07:07 (hora de Colombia) · BVC por Yahoo", "tocada · cierre bajo el nivel",
    ]);
  });

  it("cada «Último cierre» dice cuándo lo trajo 008 (hora de Colombia) y de qué fuente; sin cierre, nada (frente fecha-hora-datos)", async () => {
    const raiz = await pantalla();
    const nota = (especie: string) => [...(fila(raiz, especie)?.querySelectorAll("td")[5]?.querySelectorAll(".fecha-dato") ?? [])].map(texto);
    expect(nota("FICTA")).toEqual(["traído el 13-ene-2027 a las 18:41 (hora de Colombia) · BVC por Yahoo"]);
    expect(nota("FICTC")).toEqual(["traído el 13-ene-2027 a las 18:41 (hora de Colombia) · bvc-ficticia"]);
    expect(nota("FICTP")).toEqual([]);
    for (const tr of [...raiz.querySelectorAll("tbody tr")].filter((t) => texto(t.querySelector("th")) === "Portafolio")) expect(tr.querySelector(".fecha-dato")).toBeNull();
  });

  it("una versión que no rige hoy no lleva cierres ni su procedencia", async () => {
    const raiz = await pantalla({ version: "2" });
    expect(raiz.querySelector(".fecha-dato")).toBeNull();
  });

  it("FICTC no negocia desde el 5-nov (el 4 fue festivo): explica en vez de dar el precio viejo como de hoy", async () => {
    const raiz = await pantalla();
    const c = fila(raiz, "FICTC")!;
    const [cierre, frente] = celdas(c).slice(6, 8);
    expect(cierre).toContain("sin negociación desde 5-nov-2024, último cierre 1-nov-2024");
    expect(frente).toBe("sin cierre al día");
    expect(c.querySelector(".aviso")).not.toBeNull();
    expect(texto(raiz.querySelector("footer"))).toContain("«Sin negociación» se deduce de que no hay cierre en esos días hábiles de la BVC");
  });

  it("una especie sin compras dice por qué no tiene cierre; las reglas de portafolio no tienen cierre ni distancia", async () => {
    const raiz = await pantalla();
    expect(celdas(fila(raiz, "FICTP"))[6]).toBe("sin cierre: el sistema solo trae cierres de las especies con compras");
    const portafolio = [...raiz.querySelectorAll("tbody tr")].filter((tr) => texto(tr.querySelector("th")) === "Portafolio").map(celdas);
    expect(portafolio.map((c) => [c[1], c[2], c[6], c[7]])).toEqual([
      ["Monto por orden menor a", "$ 1.234.000", "—", "—"],
      ["Regla escrita", "—", "—", "—"],
    ]);
  });

  it("las decisiones de una regla llevan al diario filtrado; cada fila tiene su ancla", async () => {
    const raiz = await pantalla();
    const enlace = fila(raiz, "FICTA")!.querySelector("a");
    expect(enlace?.getAttribute("href")).toBe("/decisiones?regla=r-a");
    expect(enlace?.getAttribute("aria-label")).toBe("2 decisiones citan esta regla");
    expect(fila(raiz, "FICTA")!.id).toBe("regla-r-a");
  });

  it("si la carga de precios se detuvo, lo dice", async () => {
    vi.setSystemTime(new Date("2024-11-27T15:00:00.000Z"));
    const raiz = await pantalla();
    expect(texto(raiz)).toContain("Los precios no se han actualizado desde el 22-nov-2024.");
  });

  it("la tabla se desplaza dentro de su caja (región con nombre y foco)", async () => {
    const raiz = await pantalla();
    const region = raiz.querySelector('[role="region"]');
    expect(region?.getAttribute("tabindex")).toBe("0");
    expect(raiz.querySelector(`#${region?.getAttribute("aria-labelledby")}`)?.textContent).toBe("Reglas");
  });
});

describe("el historial de versiones y ?version=", () => {
  it("lista las versiones con su estado; la que se ve lleva aria-current", async () => {
    const raiz = await pantalla();
    const enlaces = [...raiz.querySelectorAll("nav[aria-labelledby] a")];
    expect(enlaces.map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")])).toEqual([
      ["Versión 2 · programada desde 10-ene-2025", "/plan?version=2", null],
      ["Versión 1 · vigente desde 1-jul-2024", "/plan?version=1", "page"],
    ]);
  });

  it("una versión programada se ve sin cierres ni distancia (contra una regla que no rige, engañarían)", async () => {
    const raiz = await pantalla({ version: "2" });
    expect(texto(raiz.querySelector("h1"))).toBe("Versión 2 del plan");
    expect(texto(raiz)).toContain("Programada: entra a regir el 10-ene-2025.");
    expect(columnas(raiz)).not.toContain("Último cierre");
    expect(columnas(raiz)).not.toContain("Frente al nivel");
    expect(ultimosCierres).not.toHaveBeenCalled();
    expect(leerReglas).toHaveBeenCalledWith(expect.anything(), "v2");
  });

  it("una versión que no existe o mal escrita da un aviso, nunca un error ni un eco de lo escrito", async () => {
    for (const version of ["7", "basura", "01", "1.0", "<script>alert(1)</script>", ["1", "2"]]) {
      const raiz = await pantalla({ version });
      expect(texto(raiz.querySelector("h1")), String(version)).toBe("No hay una versión del plan con ese número");
      expect(raiz.innerHTML).not.toContain("script");
      expect(raiz.innerHTML).not.toContain("basura");
      expect(raiz.querySelectorAll("nav[aria-labelledby] a")).toHaveLength(2);
    }
  });
});

describe("sin recomendaciones ni comandos", () => {
  it("el pie lo dice y ningún texto da órdenes de compra o venta", async () => {
    const raiz = await pantalla();
    expect(texto(raiz.querySelector("footer"))).toContain("El sistema calcula y muestra; no recomienda comprar ni vender.");
    expect(texto(raiz)).not.toMatch(/\b(compre|venda|recomendamos|le recomendamos|debería)\b/i);
    expect(raiz.innerHTML).not.toMatch(/npm|npx|tsx|importar-plan/);
  });

  it("el encabezado lleva a las otras pantallas y marca la actual", async () => {
    const raiz = await pantalla();
    const nav = [...raiz.querySelectorAll('header nav a')].map((a) => [texto(a), a.getAttribute("href"), a.getAttribute("aria-current")]);
    expect(nav).toEqual([["Portafolio", "/", null], ["Plan", "/plan", "page"], ["Operar", "/operar", null], ["Decisiones", "/decisiones", null], ["Conciliación", "/conciliacion", null], ["Proyecciones", "/proyecciones", null], ["Datos oficiales", "/datos-oficiales", null], ["Análisis", "/analisis", null]]);
  });
});

describe("landmarks", () => {
  it("no hay dos regiones con el mismo nombre (una sección con nombre ya es una región)", async () => {
    const raiz = await pantalla();
    const nombre = (el: Element) => (el.getAttribute("aria-labelledby") ?? "").split(" ").map((id) => raiz.querySelector(`#${id}`)?.textContent ?? "").join(" ");
    const regiones = [...raiz.querySelectorAll('section[aria-labelledby], [role="region"]')].map(nombre);
    expect(regiones.length).toBeGreaterThan(0);
    expect(new Set(regiones).size, regiones.join(" | ")).toBe(regiones.length);
  });
});
