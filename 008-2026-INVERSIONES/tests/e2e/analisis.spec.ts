/**
 * E2E de /analisis (frente analisis-pantalla, A2) contra la base e2e de tests/e2e/sembrar.ts, sin siembra propia: las
 * cifras exactas del análisis se prueban en unidad (tests/unit/analisis y tests/unit/pantalla-analisis); aquí, que la
 * pantalla se pinta entera con la base de verdad. A 375 px, en claro y en oscuro: las cuatro secciones, la volatilidad
 * rotulada «de precios diarios», la fecha de los datos, «Análisis» como actual en el menú, cada punto para revisar con su
 * umbral a la vista, sin desborde, las tablas desplazables en su caja, el texto con contraste AA, ninguna expresión de
 * consejo y nada que escriba. Correos y contraseñas inventados.
 */
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { prohibidasEn } from "../unit/operar/informe/lenguaje";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const ANCHO_CELULAR = { width: 375, height: 812 };

/** Contraste del texto contra el primer fondo opaco de sus ancestros (WCAG). */
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

async function abrirAnalisis(page: Page, info: TestInfo): Promise<void> {
  await PaginaTablero.abrir(page, info);
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Análisis", exact: true }).click();
  await expect(page).toHaveURL("/analisis");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Análisis del portafolio");
}

test.describe("pantalla /analisis", () => {
  test("sin sesión lleva a ingresar", async ({ page }) => {
    await page.goto("/analisis");
    await expect(page).toHaveURL("/ingresar");
  });

  for (const tema of ["light", "dark"] as const) {
    const nombre = tema === "light" ? "claro" : "oscuro";

    test.describe(`a 375 px · ${nombre}`, () => {
      test.use({ viewport: ANCHO_CELULAR, colorScheme: tema });

      test("las cuatro secciones, la fecha de los datos y los umbrales; sin desborde ni consejos", async ({ page }, info) => {
        await abrirAnalisis(page, info);
        const main = page.getByRole("main");
        await expect(page).toHaveTitle("Análisis del portafolio");
        await expect(page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Análisis", exact: true })).toHaveAttribute("aria-current", "page");
        await expect(main.getByRole("heading", { level: 2 })).toHaveText(["Por especie", "Portafolio", "Sus decisiones", "Puntos para revisar"]);
        await expect(main.locator(".fecha-dato").first()).toBeVisible();

        // Por especie: las especies vivas de la siembra, con la volatilidad rotulada «de precios diarios».
        const tabla = page.getByRole("table", { name: /^Por especie/ });
        await expect(tabla.getByRole("columnheader", { name: /de precios diarios/ })).toHaveCount(1);
        await expect(tabla.getByRole("rowheader").first()).toHaveText(/^FICT/);
        const caja = page.getByRole("region", { name: "Tabla por especie", exact: true });
        await caja.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => caja.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);

        // Puntos para revisar: cada uno con su umbral a la vista (o la frase de que no hay).
        // Solo los puntos (la misma sección lista después los avisos de la historia de precios, sin umbral).
        const puntos = page.getByRole("region", { name: "Puntos para revisar", exact: true }).locator(".an-puntos > li");
        const cuantos = await puntos.count();
        for (let k = 0; k < cuantos; k += 1) await expect(puntos.nth(k).locator(".an-umbral")).toHaveText(/^umbral: /);
        if (cuantos === 0) await expect(page.getByRole("region", { name: "Puntos para revisar", exact: true })).toContainText("Ningún dato cruza");

        // Sin desborde a lo ancho; el encabezado fijo cabe en el margen de desplazamiento (el foco no queda debajo).
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        const [alto, margen] = await page.evaluate(() => [document.querySelector("header.top")!.getBoundingClientRect().height, parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)]);
        expect(alto).toBeLessThanOrEqual(margen!);

        const textos = [main.locator("h1"), tabla.locator("thead th").first(), main.locator(".nota").first(), page.locator("footer.pie p")];
        for (const l of textos) expect(await contraste(l), await l.evaluate((e) => `${e.tagName}.${e.className}`)).toBeGreaterThanOrEqual(4.5);
        expect(prohibidasEn(await main.innerText())).toEqual([]);
        await expect(main.locator("form, input, button, textarea, select")).toHaveCount(0);
        await page.screenshot({ path: info.outputPath(`analisis-375-${nombre}.png`), fullPage: true });
      });
    });
  }
});
