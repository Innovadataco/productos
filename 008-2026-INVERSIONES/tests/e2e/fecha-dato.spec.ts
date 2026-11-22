/**
 * E2E de la procedencia de cada dato (frente fecha-hora-datos), a 375 px, en claro y en oscuro, contra la base e2e
 * sembrada por tests/e2e/sembrar.ts. Cada cajón dice la fecha de su dato, cuándo lo trajo 008 (fecha y hora de
 * Colombia, comparada con la de la base pasada por Intl en America/Bogota) y su fuente; los valores que suman cierres
 * dicen el más antiguo y avisan las fechas distintas (FICTC, ilíquida, cerró el 1-nov-2024; las demás, el 22-nov-2024).
 * Los cierres del tablero se sembraron con la fuente «e2e-ficticio», que la app muestra tal cual. La prueba no cambia la base.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { PaginaConciliacion } from "./pagina-conciliacion";
import { PaginaDatosOficiales } from "./pagina-datos-oficiales";
import { PaginaPlan } from "./pagina-plan";
import { PaginaTablero } from "./pagina-tablero";
import { origenDeLaSerie, origenDelCierre, traido } from "./procedencia-e2e";
import { test } from "./sesion";

const MOVIL = { width: 375, height: 812 };
const AVISO = "Cierres de fechas distintas: del 1-nov-2024 al 22-nov-2024.";

const notas = async (zona: Locator): Promise<string[]> => (await zona.locator(".fecha-dato").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());

/** Contraste WCAG del texto de cada nota contra el primer fondo opaco de sus ancestros (y que ninguna se salga a lo ancho). */
async function revisarNotas(page: Page): Promise<{ readonly peor: number; readonly cuantas: number; readonly desborde: number }> {
  return page.evaluate(() => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const fondo = (el: Element | null): string => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        const partes = rgb(c);
        if (partes.length === 3 || (partes.length === 4 && partes[3]! > 0.95)) return c;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const nodos = [...document.querySelectorAll(".fecha-dato, .fecha-dato-aviso")];
    const razones = nodos.map((n) => {
      const [a, b] = [lum(rgb(getComputedStyle(n).color)), lum(rgb(fondo(n)))];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    return { peor: Math.min(...razones), cuantas: nodos.length, desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}

for (const tema of ["light", "dark"] as const) {
  test.describe(`procedencia de cada dato · ${tema === "light" ? "claro" : "oscuro"} · 375 px`, () => {
    test.use({ viewport: MOVIL, colorScheme: tema });

    test("tablero: cada fila, el detalle y cada tarjeta con su cierre, hora y fuente; los totales con el más antiguo y el aviso", async ({ page }, info) => {
      const [a, c] = [await origenDelCierre("FICTA", "2024-11-22"), await origenDelCierre("FICTC", "2024-11-01")];
      const t = await PaginaTablero.abrir(page, info);

      expect(await notas(t.fila("FICTA"))).toEqual([traido(a)]);
      expect(await notas(t.fila("FICTC"))).toEqual([traido(c)]);

      const compuesta = `Con el cierre más antiguo del 1-nov-2024 · ${traido(c)} ${AVISO}`;
      const kpi = page.locator(".kpi").filter({ has: page.getByText("Valor en acciones", { exact: true }) });
      expect(await notas(kpi)).toEqual([compuesta]);
      expect(await notas(page.getByRole("region", { name: /¿Gano\?/ }))).toEqual([compuesta]);
      await expect(kpi.locator(".fecha-dato-aviso")).toBeVisible();
      expect(await notas(page.getByRole("region", { name: "Cómo está repartido" }))).toContain(compuesta);

      const tarjetaA = t.queMovio.getByRole("listitem").filter({ hasText: "FICTA" });
      expect(await notas(tarjetaA)).toEqual([traido(a)]);

      await t.botonEspecie("FICTC").click();
      expect(await notas(t.detalle("FICTC"))).toEqual([traido(c)]);

      const r = await revisarNotas(page);
      expect(r.cuantas).toBeGreaterThan(5);
      expect(r.peor, "contraste de las notas").toBeGreaterThanOrEqual(4.5);
      expect(r.desborde).toBeLessThanOrEqual(0);
    });

    test("plan: el «Último cierre» de cada regla con cuándo se trajo y de dónde", async ({ page }, info) => {
      const [a, c] = [await origenDelCierre("FICTA", "2024-11-22"), await origenDelCierre("FICTC", "2024-11-01")];
      await PaginaTablero.abrir(page, info);
      await page.goto("/plan");
      const p = new PaginaPlan(page);
      await expect(p.titulo).toHaveText("Plan vigente: versión 1");
      expect(await notas(p.fila(p.reglas, "FICTA"))).toEqual([traido(a)]);
      expect(await notas(p.fila(p.reglas, "FICTC"))).toEqual([traido(c)]);
      const r = await revisarNotas(page);
      expect(r.peor, "contraste de las notas").toBeGreaterThanOrEqual(4.5);
      expect(r.desborde).toBeLessThanOrEqual(0);
    });

    test("conciliación: el «Valor sistema» con el cierre del corte con que se calculó, su hora y su fuente", async ({ page }, info) => {
      const [a, b] = [await origenDelCierre("FICTA", "2024-11-22"), await origenDelCierre("FICTB", "2024-11-22")];
      await PaginaTablero.abrir(page, info);
      await page.goto("/conciliacion");
      const k = new PaginaConciliacion(page);
      await expect(k.titulo).toHaveText("Corte del 22-nov-2024: No cuadra");
      expect(await notas(k.fila(k.acciones, "FICTA"))).toEqual([`Cierre del 22-nov-2024 · ${traido(a)}`]);
      expect(await notas(k.fila(k.acciones, "FICTB"))).toEqual([`Cierre del 22-nov-2024 · ${traido(b)}`]);
      expect(await notas(k.fila(k.acciones, "FICTC"))).toEqual([]);
      const r = await revisarNotas(page);
      expect(r.peor, "contraste de las notas").toBeGreaterThanOrEqual(4.5);
      expect(r.desborde).toBeLessThanOrEqual(0);
    });

    test("datos oficiales: la TRM con su vigencia, cuándo se trajo en hora de Colombia y su fuente", async ({ page }, info) => {
      const trm = await origenDeLaSerie("TRM");
      const d = await PaginaDatosOficiales.abrir(page, info);
      const tarjeta = d.tarjeta("Tasa Representativa del Mercado");
      await expect(tarjeta.locator(".do-vigencia")).toContainText("vigente del");
      await expect(tarjeta.locator("dd").filter({ hasText: "(hora de Colombia)" })).toHaveText(`${trm.traido} (hora de Colombia)`);
      await expect(tarjeta.locator("dd").first()).toContainText(trm.fuente);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  });
}
