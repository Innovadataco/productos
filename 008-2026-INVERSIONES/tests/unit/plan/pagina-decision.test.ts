// @vitest-environment jsdom
// Pantalla /decisiones/[id] (fase B, corte 3): la cadena completa de una decisión (versión del plan → regla →
// decisión → órdenes con su fila importada → resultado a 30 y 90 días con cada precio y cada dividendo usado).
// Con la lectura simulada. Un id mal formado no llega a la base; uno inexistente da un aviso sin eco.
// Datos inventados (tests/unit/plan/ficticio-pantallas.ts).
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AHORA, DETALLE, DETALLE_VENTA, DETALLE_VIEJA } from "./ficticio-pantallas";

const exigirSesion = vi.hoisted(() => vi.fn());
const leerDecision = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/plan/lectura", () => ({ leerDecision }));

import Pagina from "@/app/decisiones/[id]/page";

async function pantalla(id: string): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ id }) }));
  return raiz;
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const celdas = (tr: Element | null | undefined) => [...(tr?.querySelectorAll("th, td") ?? [])].map(texto);
const pares = (raiz: HTMLElement) => Object.fromEntries([...raiz.querySelectorAll("dl.pares dt")].map((dt) => [texto(dt), texto(dt.nextElementSibling)]));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  exigirSesion.mockResolvedValue({ id: "u1", email: "dueno@ejemplo.invalid", rol: "DUENO" });
  leerDecision.mockResolvedValue(DETALLE);
});

afterEach(() => {
  vi.useRealTimers();
  exigirSesion.mockReset();
  leerDecision.mockReset();
});

describe("src/app/decisiones/[id]/page.tsx · sesión e id", () => {
  it("sin sesión no lee la base", async () => {
    const redireccion = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/ingresar;307;" });
    exigirSesion.mockRejectedValueOnce(redireccion);
    await expect(Pagina({ params: Promise.resolve({ id: "d-noact" }) })).rejects.toBe(redireccion);
    expect(leerDecision).not.toHaveBeenCalled();
  });

  it("un id mal formado no llega a la base; uno que no existe da el mismo aviso; nunca se repite lo escrito", async () => {
    for (const id of ["<script>alert(1)</script>", "A B", "x".repeat(65), ""]) {
      const raiz = await pantalla(id);
      expect(texto(raiz.querySelector("h1"))).toBe("No hay una decisión con ese identificador");
      expect(raiz.innerHTML).not.toContain("script");
    }
    expect(leerDecision).not.toHaveBeenCalled();
    leerDecision.mockResolvedValueOnce(null);
    const raiz = await pantalla("noexiste");
    expect(texto(raiz.querySelector("h1"))).toBe("No hay una decisión con ese identificador");
    expect(raiz.innerHTML).not.toContain("noexiste");
    expect(leerDecision).toHaveBeenCalledWith(expect.anything(), "noexiste", new Date("2024-11-25T00:00:00.000Z"));
  });
});

describe("la cadena de una decisión de «no actuar»", () => {
  it("titula qué se decidió, de qué especie y cuándo", async () => {
    expect(texto((await pantalla("d-noact")).querySelector("h1"))).toBe("No actuar · FICTA · 22-jul-2024");
  });

  it("la cadena va del plan al resultado; la decisión es el paso actual", async () => {
    const raiz = await pantalla("d-noact");
    const nav = raiz.querySelector('nav[aria-label="Cadena de la decisión"]');
    const pasos = [...(nav?.querySelectorAll("ol > li") ?? [])];
    expect(pasos.map(texto)).toEqual([
      "Plan · versión 1, desde el 1-jul-2024",
      "Regla · Cierre por encima de $ 1.200 → vender",
      "Decisión · No actuar (excepción a la regla)",
      "Órdenes · no aplica: «no actuar» no tiene órdenes",
      "Resultado · a 30 y 90 días",
    ]);
    expect(pasos.map((p) => p.querySelector("a")?.getAttribute("href") ?? null)).toEqual(["/plan?version=1", "/plan?version=1#regla-r-a", null, null, "#resultado"]);
    expect(pasos[2]?.getAttribute("aria-current")).toBe("step");
  });

  it("qué, cuánto, por qué y cuándo se registró", async () => {
    expect(pares(await pantalla("d-noact"))).toMatchObject({
      Qué: "No actuar (excepción a la regla)",
      Cantidad: "43",
      "Por qué": "Mantener hasta el dividendo de octubre (ficticio)",
      Fecha: "22-jul-2024",
      Registrada: "22-jul-2024 a las 15:00 (hora de Colombia)",
    });
  });

  it("cada tramo con sus precios (fecha y fuente) y cada dividendo usado", async () => {
    const raiz = await pantalla("d-noact");
    const seccion = raiz.querySelector("#resultado")!;
    expect([...seccion.querySelectorAll("h3")].map(texto)).toEqual(["A 30 días", "A 90 días"]);
    const tablas = [...seccion.querySelectorAll("table")];
    expect([...tablas[1]!.querySelectorAll("thead th")].map(texto)).toEqual(["Desde", "Hasta", "Cierre inicial", "Cierre final", "Precio", "Dividendos"]);
    expect(celdas(tablas[1]!.querySelector("tbody tr"))).toEqual(["22-jul-2024", "20-oct-2024", "$ 953 · 22-jul-2024", "$ 1.063 · 18-oct-2024", "+$ 4.730", "+$ 516"]);
    expect(texto(seccion)).toContain("Pagado el 17-oct-2024: $ 1.200 netos sobre 100 acciones ($ 12 por acción) → $ 516");
    expect(texto(seccion)).toContain("Funcionó · +$ 5.246");
    expect(texto(seccion)).toContain("Los dividendos salen de los archivos de Trii; los cierres, de Yahoo.");
  });
});

describe("una venta enlazada y una decisión corregida", () => {
  it("las órdenes enlazadas con su fila importada y la historia de sus enlaces", async () => {
    leerDecision.mockResolvedValueOnce(DETALLE_VENTA);
    const raiz = await pantalla("d-vende");
    const ordenes = raiz.querySelector("#ordenes")!;
    expect(celdas(ordenes.querySelector("tbody tr"))).toEqual(["13-sep-2024", "Venta", "20", "$ 50.440", "fila 5 de la carga del 21-nov-2026"]);
    expect([...ordenes.querySelectorAll("li")].map(texto)).toEqual([
      "Enlace del 21-nov-2026 · reemplazado",
      "Enlace del 21-nov-2026 · vigente · Se enlazó primero a otra decisión (ficticio)",
    ]);
  });

  it("una decisión reemplazada lleva a su corrección y no se mide", async () => {
    leerDecision.mockResolvedValueOnce(DETALLE_VIEJA);
    const raiz = await pantalla("d-vieja");
    const corr = [...raiz.querySelectorAll("a")].find((a) => texto(a) === "ver la corrección");
    expect(corr?.getAttribute("href")).toBe("/decisiones/d-corr");
    expect(texto(raiz)).toContain("Esta decisión se corrigió el 2-oct-2024:");
    expect(texto(raiz)).toContain("No se mide: sus órdenes pasaron a la corrección.");
    expect(raiz.querySelector("#resultado table")).toBeNull();
  });

  it("el pie dice que no recomienda", async () => {
    expect(texto((await pantalla("d-noact")).querySelector("footer"))).toContain("no recomienda comprar ni vender");
  });
});

describe("landmarks", () => {
  it("no hay dos regiones con el mismo nombre (una sección con nombre ya es una región)", async () => {
    const raiz = await pantalla("d-noact");
    const nombre = (el: Element) => (el.getAttribute("aria-labelledby") ?? "").split(" ").map((id) => raiz.querySelector(`#${id}`)?.textContent ?? "").join(" ");
    const regiones = [...raiz.querySelectorAll('section[aria-labelledby], [role="region"]')].map(nombre);
    expect(regiones.length).toBeGreaterThan(0);
    expect(new Set(regiones).size, regiones.join(" | ")).toBe(regiones.length);
  });
});
