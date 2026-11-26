/**
 * E2E del simulador «¿Y si…?» de /operar (correcciones del 23-nov y precio actual de trii Pro), contra la base e2e
 * sembrada (tests/e2e/sembrar.ts). No escribe nada: la simulación no guarda ni el saldo ni el precio escritos.
 *  - La caja es el saldo que se escribe (el de Trii), y la pantalla lo dice; con el precio actual de trii Pro, la especie se
 *    valora con él y el informe lo dice («Valorado con el precio escrito: … no con el cierre del …»).
 *  - Los pesos salen con dos decimales y ningún monto en pesos con tres o más.
 *  - A 375 px, en claro y en oscuro: sin desborde, los textos del formulario y del resultado con contraste AA, ningún consejo.
 * Datos inventados.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { prohibidasEn } from "../unit/operar/informe/lenguaje";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const MOVIL = { width: 375, height: 812 };
const seccion = (page: Page) => page.locator("section.op-simulador");
const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Contraste WCAG del texto contra el primer fondo opaco de sus ancestros. */
const contraste = (l: Locator) =>
  l.evaluate((el) => {
    const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    let fondo: Element | null = el;
    while (fondo && (rgba(getComputedStyle(fondo).backgroundColor)[3] ?? 1) === 0) fondo = fondo.parentElement;
    const bg = fondo ? getComputedStyle(fondo).backgroundColor : getComputedStyle(document.body).backgroundColor;
    const [l1, l2] = [lum(rgba(getComputedStyle(el).color)), lum(rgba(bg))].sort((x, y) => y - x);
    return (l1! + 0.05) / (l2! + 0.05);
  });

for (const tema of ["light", "dark"] as const) {
  test.describe(`simulador a 375 px · ${tema === "light" ? "claro" : "oscuro"}`, () => {
    test.use({ viewport: MOVIL, colorScheme: tema });

    test("el saldo escrito es la caja, el precio de trii Pro valora la especie y se dice; pesos con dos decimales y montos sin decimales de más", async ({ page }, info) => {
      await PaginaTablero.abrir(page, info);
      await page.goto("/operar");
      const s = seccion(page);
      await expect(s.getByRole("heading", { level: 2, name: "¿Y si…?" })).toBeVisible();

      // El formulario dice de dónde sale la caja y qué hace el precio actual.
      await expect(s.getByLabel("Su saldo disponible en el comisionista ($, opcional)", { exact: true })).toBeVisible();
      await expect(s.getByLabel("Precio actual en trii Pro ($, opcional)", { exact: true })).toBeVisible();
      await expect(s).toContainText("Escriba el saldo que ve en Trii");
      await expect(s).toContainText("la especie se valora a ese precio y no al último cierre; no se guarda");
      for (const ayuda of [s.locator("#sim-ayuda-saldo"), s.locator("#sim-ayuda-precio-actual")]) expect(await contraste(ayuda)).toBeGreaterThanOrEqual(4.5);

      await s.getByLabel("Operación", { exact: true }).selectOption("COMPRAR");
      await s.getByLabel("Cantidad de acciones", { exact: true }).fill("3");
      await s.getByLabel("Precio límite ($)", { exact: true }).fill("1.100,1234");
      await s.getByLabel("Comisionista", { exact: true }).selectOption("TRII");
      await s.getByLabel("Su saldo disponible en el comisionista ($, opcional)", { exact: true }).fill("6.202,9244");
      await s.getByLabel("Precio actual en trii Pro ($, opcional)", { exact: true }).fill("1.234,5");
      await s.getByRole("button", { name: "Simular", exact: true }).click();
      const resultado = s.locator(".op-sim-resultado");
      await expect(resultado.getByRole("heading", { level: 3, name: "Resultado de la simulación" })).toBeVisible();

      await expect(resultado).toContainText("Caja de la simulación: el saldo que usted escribió, no la de Acciones & Valores (no se guarda).");
      await expect(resultado).toContainText(/Valorado con el precio escrito: \$ 1\.234,5 \(trii Pro\), no con el cierre del \d{1,2}-[a-z]{3}-\d{4}\./);
      await expect(resultado).toContainText("las demás se valoran a su último cierre");
      const texto = await resultado.innerText();
      expect(texto).not.toMatch(/\$ [\d.]+,\d{3,}/);
      // Los pesos de la tabla: siempre dos decimales.
      const pesos = await resultado.locator("table.angosta tbody tr").evaluateAll((filas) => filas.flatMap((f) => [...f.querySelectorAll("td")].slice(2).map((c) => (c.textContent ?? "").trim())));
      expect(pesos.length).toBeGreaterThan(0);
      for (const p of pesos) expect(p, p).toMatch(/^\d{1,3},\d{2} %$|^sin cierre$|^—$/);
      expect(prohibidasEn(await s.innerText())).toEqual([]);

      expect(await desborde(page)).toBe(0);
      for (const l of [resultado.locator(".nota").first(), resultado.getByRole("heading", { level: 3 })]) expect(await contraste(l)).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: info.outputPath(`operar-simulador-375-${tema}.png`), fullPage: true });
    });

    test("«Para revisar»: una venta que saca una especie de su rango deja primero un punto de importancia alta, en texto", async ({ page }, info) => {
      await PaginaTablero.abrir(page, info);
      await page.goto("/operar");
      const s = seccion(page);
      await s.getByLabel("Operación", { exact: true }).selectOption("VENDER");
      await s.getByLabel("Cantidad de acciones", { exact: true }).fill("80");
      await s.getByLabel("Precio límite ($)", { exact: true }).fill("1.913");
      await s.getByRole("button", { name: "Simular", exact: true }).click();
      const resultado = s.locator(".op-sim-resultado");
      const h3 = resultado.getByRole("heading", { level: 3, name: "Resultado de la simulación" });
      await expect(h3).toBeVisible();
      const h4 = resultado.getByRole("heading", { level: 4, name: "Para revisar", exact: true });
      await expect(h4).toBeVisible();
      const lista = resultado.locator("ol.op-sim-revisar[aria-labelledby]");
      await expect(lista).toBeVisible();
      const primero = lista.locator("li").first();
      await expect(primero).toContainText("Importancia alta");
      await expect(primero).toContainText(/FICTB/);
      await expect(primero).toContainText("deja de ser muy elevado");
      await expect(primero.locator(".nota")).toContainText(/Antes .* · después .* · umbral /);
      // La sección va justo después del título del resultado y no usa regiones vivas.
      expect(await h4.evaluate((el) => el.previousElementSibling?.tagName)).toBe("H3");
      expect(await s.locator("[aria-live], [role=status]").count()).toBe(0);
      // A 375 px: sin desborde, contraste AA y sin lenguaje de consejo.
      expect(await desborde(page)).toBe(0);
      for (const l of [primero.locator(".op-sim-importancia"), primero.locator(".nota"), h4]) expect(await contraste(l)).toBeGreaterThanOrEqual(4.5);
      expect(prohibidasEn(await lista.innerText())).toEqual([]);
      await page.screenshot({ path: info.outputPath(`operar-para-revisar-375-${tema}.png`), fullPage: true });
    });
  });
}
