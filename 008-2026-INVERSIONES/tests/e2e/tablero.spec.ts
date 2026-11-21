/**
 * E2E de la pantalla del portafolio (INV-SPEC-15) contra la base e2e sembrada por tests/e2e/sembrar.ts.
 * Datos inventados (tests/e2e/fixtures/*.ficticio.csv más cierres ficticios):
 *   FICTA · 100 vivas a costo 1.000, cierre 1.100 → sin vender +10.000; dividendo 1.200; comisión 500
 *   FICTB · 80 vivas a costo 2.000, cierre 1.913 → sin vender −6.960; vendió 20 a 2.537 → +10.740; comisiones 1.100
 *   FICTI · vendió más de lo que compró → incompleta: fuera de la tabla y de los totales
 *   ¿Gano? = 3.040 + 10.740 + 1.200 − 1.600 = +$ 13.380
 */
import { expect } from "@playwright/test";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const TOTAL = "+$ 13.380";
const ANCHO_MOVIL = { width: 400, height: 900 };

test.describe("tablero del portafolio", () => {
  test("responde «¿Gano?» con el total de la ganancia", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await expect(t.titulo).toHaveAccessibleName(/^¿Gano\? Sí\.\s*\+\$ 13\.380$/);
    await expect(t.cifraDelTotal).toHaveText(TOTAL);
  });

  test("ordenar por una columna cambia aria-sort y el orden de las filas", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await expect(t.columna("Valor")).toHaveAttribute("aria-sort", "descending");
    await expect(t.columna("Especie")).not.toHaveAttribute("aria-sort");
    await expect(t.botonesDeEspecie).toHaveText(["FICTB", "FICTA"]);

    await t.ordenarPor("Especie");

    await expect(t.columna("Especie")).toHaveAttribute("aria-sort", "ascending");
    await expect(t.columna("Valor")).not.toHaveAttribute("aria-sort");
    await expect(t.botonesDeEspecie).toHaveText(["FICTA", "FICTB"]);
  });

  test("el detalle se abre con el teclado y Escape lo cierra y devuelve el foco", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    const boton = t.botonEspecie("FICTA");
    await boton.focus();
    await page.keyboard.press("Enter");

    const panel = t.detalle("FICTA");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "FICTA" })).toBeFocused();
    await expect(boton).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Escape");

    await expect(panel).toHaveCount(0);
    await expect(boton).toBeFocused();
    await expect(boton).toHaveAttribute("aria-pressed", "false");
  });

  test("una especie incompleta se lista aparte y no aparece en la tabla ni como vendida", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await expect(t.avisoIncompletas).toContainText("FICTI");
    await expect(t.botonesDeEspecie).toHaveCount(2);
    await expect(t.tabla.getByText("FICTI")).toHaveCount(0);
    // Ni en «Vendidas por completo» ni en «Qué movió su portafolio»: solo en el aviso.
    await expect(page.getByText("FICTI")).toHaveCount(1);
  });

  test.describe("tema", () => {
    test.use({ colorScheme: "dark" });

    test("oscuro y claro cambian el fondo, sin errores, y el botón «Tema claro» lo alterna", async ({ page }, info) => {
      const t = await PaginaTablero.abrir(page, info);
      await expect(t.botonTema).toHaveText("Tema claro");
      await expect(t.botonTema).toHaveAttribute("aria-pressed", "false");
      const oscuro = await t.fondo();

      await page.emulateMedia({ colorScheme: "light" });
      await PaginaTablero.abrir(page, info);
      await expect(t.botonTema).toHaveAttribute("aria-pressed", "true");
      const claro = await t.fondo();
      expect(claro).not.toBe(oscuro);

      await t.botonTema.click();
      await expect(t.botonTema).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => t.fondo()).toBe(oscuro);
    });
  });

  test.describe("a 400 px", () => {
    test.use({ viewport: ANCHO_MOVIL });

    test("no hay desborde horizontal, con y sin el panel de detalle", async ({ page }, info) => {
      const t = await PaginaTablero.abrir(page, info);
      await expect.poll(() => t.desbordeHorizontal()).toBeLessThanOrEqual(0);

      await t.botonEspecie("FICTA").click();
      await expect(t.detalle("FICTA")).toBeVisible();
      await expect.poll(() => t.desbordeHorizontal()).toBeLessThanOrEqual(0);
    });
  });
});
