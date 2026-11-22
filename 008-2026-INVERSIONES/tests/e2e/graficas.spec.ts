/**
 * E2E de las gráficas del tablero (frente graficas-tablero) contra la base e2e: tests/e2e/sembrar.ts más los cierres
 * generados de tests/e2e/sembrar-graficas.ts (todo inventado). La evolución va del 8-abr al 22-nov-2024 y su último
 * día cuadra con «Valor en acciones»: FICTA 100 × 1.100 + FICTB 80 × 1.913 + FICTC 10 × 505 = $ 268.090, con costo
 * 100.000 + 160.000 + 5.000 = $ 265.000.
 * Capturas en escritorio y a 375 px, claro y oscuro, solo con CAPTURAS_GRAFICAS (carpeta fuera del repo).
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { PaginaGraficas, TITULOS } from "./pagina-graficas";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const ANCHO_CELULAR = { width: 375, height: 812 };

async function abrir(page: Page, info: TestInfo): Promise<{ t: PaginaTablero; g: PaginaGraficas }> {
  const t = await PaginaTablero.abrir(page, info);
  return { t, g: new PaginaGraficas(page) };
}

test.describe("gráficas del tablero", () => {
  test("cuatro gráficas con nombre accesible; la evolución cuadra con «Valor en acciones»", async ({ page }, info) => {
    const { g } = await abrir(page, info);
    for (const titulo of TITULOS) await expect(g.figura(titulo)).toBeVisible();
    const leyenda = g.figura("Valor frente al costo de lo que tiene").locator(".g-leyenda");
    await expect(leyenda).toContainText("$ 268.090");
    await expect(leyenda).toContainText("$ 265.000");
    await expect(page.locator(".kpi").filter({ hasText: "Valor en acciones" }).locator(".sr")).toHaveText("$ 268.090");
    await expect(g.evolucion.locator(".eyebrow")).toHaveText("Del 8-abr-2024 al 22-nov-2024");
    await expect(g.evolucion).toContainText("por validar contra Trii");
  });

  test("el rango 1M cambia el periodo y la TWR del rango; 1A no está disponible", async ({ page }, info) => {
    const { g } = await abrir(page, info);
    await expect(g.botonRango("Todo")).toHaveAttribute("aria-pressed", "true");
    await expect(g.botonRango("1A")).toBeDisabled();
    const twr = g.figura("TWR acumulada").locator("figcaption");
    const antes = await twr.textContent();
    await g.botonRango("1M").click();
    await expect(g.botonRango("1M")).toHaveAttribute("aria-pressed", "true");
    await expect(g.evolucion.getByRole("status")).toHaveText(/^Mostrando 1M: del \d+-(oct|nov)-2024 al 22-nov-2024\.$/);
    await expect(g.evolucion.locator(".eyebrow")).toHaveText(/^Del \d+-(oct|nov)-2024 al 22-nov-2024$/);
    await expect(twr).not.toHaveText(antes ?? "");
  });

  test("con el teclado el deslizador recorre los días y su valor lo dice", async ({ page }, info) => {
    const { g } = await abrir(page, info);
    const titulo = "Valor frente al costo de lo que tiene";
    await g.mira(titulo).focus();
    await page.keyboard.press("End");
    await expect(g.detalleDelDia(titulo)).toContainText("22-nov-2024");
    await expect(g.mira(titulo)).toHaveAttribute("aria-valuetext", /^22-nov-2024 · \$ 268\.090 Valor · \$ 265\.000 Costo de lo que tiene/);
    await page.keyboard.press("ArrowLeft");
    await expect(g.mira(titulo)).toHaveAttribute("aria-valuetext", /^21-nov-2024 · /);
    await page.keyboard.press("Tab");
    await expect(g.detalleDelDia(titulo)).toHaveCount(0);
  });

  test("con el ratón, al pasar se ve el detalle del día", async ({ page }, info) => {
    const { g } = await abrir(page, info);
    const titulo = "TWR acumulada";
    await g.figura(titulo).scrollIntoViewIfNeeded();
    await g.mira(titulo).hover({ position: { x: 40, y: 60 } });
    await expect(g.detalleDelDia(titulo)).toBeVisible();
    await expect(g.detalleDelDia(titulo)).toContainText(/2024/);
    await g.capturar("detalle-al-pasar", false);
    await page.mouse.move(0, 0);
    await expect(g.detalleDelDia(titulo)).toHaveCount(0);
  });

  test("composición y rentabilidad llevan al detalle de la especie y el foco vuelve a la gráfica", async ({ page }, info) => {
    const { t, g } = await abrir(page, info);
    for (const nemo of ["FICTA", "FICTB", "FICTC"]) {
      const barra = g.foto.locator("button.g-barra").filter({ hasText: nemo });
      await expect(barra.locator(".g-barra-valor")).toHaveText((await t.fila(nemo).locator("td").nth(7).textContent()) ?? "");
    }
    const boton = g.figura("Composición").getByRole("button", { name: /^FICTA / });
    await boton.click();
    await expect(t.detalle("FICTA")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(t.detalle("FICTA")).toHaveCount(0);
    await expect(boton).toBeFocused();
  });

  test.describe("con el dedo", () => {
    test.use({ hasTouch: true });

    test("al tocar la gráfica se ve el detalle del día", async ({ page }, info) => {
      const { g } = await abrir(page, info);
      const titulo = "Valor frente al costo de lo que tiene";
      await g.figura(titulo).scrollIntoViewIfNeeded();
      await g.mira(titulo).tap({ position: { x: 30, y: 50 } });
      await expect(g.detalleDelDia(titulo)).toBeVisible();
    });
  });

  test.describe("con «reducir movimiento»", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nada se anima: ni la entrada ni el cambio de rango", async ({ page }, info) => {
      const { g } = await abrir(page, info);
      await g.figura("TWR acumulada").scrollIntoViewIfNeeded();
      await g.botonRango("3M").click();
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      const d1 = await g.figura("TWR acumulada").locator("path.g-linea").getAttribute("d");
      await page.waitForTimeout(120);
      expect(await g.figura("TWR acumulada").locator("path.g-linea").getAttribute("d")).toBe(d1);
    });
  });

  for (const tema of ["light", "dark"] as const) {
    test.describe(`escritorio · ${tema === "light" ? "claro" : "oscuro"}`, () => {
      test.use({ colorScheme: tema });

      test("se dibujan todas y se captura", async ({ page }, info) => {
        const { g } = await abrir(page, info);
        await g.dibujarTodas();
        await g.capturar(`tablero-escritorio-${tema === "light" ? "claro" : "oscuro"}`);
        await g.evolucion.scrollIntoViewIfNeeded();
        await g.capturar(`graficas-escritorio-${tema === "light" ? "claro" : "oscuro"}`, false);
      });
    });

    test.describe(`a 375 px · ${tema === "light" ? "claro" : "oscuro"}`, () => {
      test.use({ viewport: ANCHO_CELULAR, colorScheme: tema });

      test("sin desborde horizontal, con las cuatro gráficas dibujadas", async ({ page }, info) => {
        const { t, g } = await abrir(page, info);
        await g.dibujarTodas();
        await expect.poll(() => t.desbordeHorizontal()).toBeLessThanOrEqual(0);
        for (const titulo of TITULOS) {
          const caja = await g.figura(titulo).boundingBox();
          expect(caja!.width).toBeLessThanOrEqual(ANCHO_CELULAR.width);
        }
        await g.capturar(`tablero-375-${tema === "light" ? "claro" : "oscuro"}`);
      });
    });
  }
});
