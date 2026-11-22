/**
 * E2E de la pantalla del portafolio (INV-SPEC-15) contra la base e2e sembrada por tests/e2e/sembrar.ts.
 * Datos inventados (tests/e2e/fixtures/*.ficticio.csv más cierres ficticios):
 *   FICTA · 100 vivas a costo 1.000, cierre 1.100 → sin vender +10.000; dividendo 1.200; comisión 500
 *   FICTB · 80 vivas a costo 2.000, cierre 1.913 → sin vender −6.960; vendió 20 a 2.537 → +10.740; comisiones 1.100
 *   FICTC · ilíquida: 10 vivas a costo 500, último cierre 505 del 1-nov-2024 (los demás, 22-nov-2024)
 *           → sin vender +50 con el precio de esa fecha; comisión 50
 *   FICTI · vendió más de lo que compró → incompleta: fuera de la tabla y de los totales
 *   ¿Gano? = 3.090 + 10.740 + 1.200 − 1.650 = +$ 13.380, «con datos parciales» (FICTI queda fuera)
 *   Qué movió (21 → 22-nov-2024): FICTA +50 × 100 = +5.000 · FICTB −44 × 80 = −3.520 → +$ 1.480; FICTC se omite
 */
import { expect } from "@playwright/test";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const TOTAL = "+$ 13.380";
const ANCHO_MOVIL = { width: 400, height: 900 };

test.describe("tablero del portafolio", () => {
  test("responde «¿Gano?» con el total de la ganancia", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await expect(t.titulo).toHaveAccessibleName(/^¿Gano\? Sí, con datos parciales\.\s*\+\$ 13\.380$/);
    await expect(t.cifraDelTotal).toHaveText(TOTAL);
  });

  test("ordenar por una columna cambia aria-sort y el orden de las filas", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await expect(t.columna("Valor")).toHaveAttribute("aria-sort", "descending");
    await expect(t.columna("Especie")).not.toHaveAttribute("aria-sort");
    await expect(t.botonesDeEspecie).toHaveText(["FICTB", "FICTA", "FICTC"]);

    await t.ordenarPor("Especie");

    await expect(t.columna("Especie")).toHaveAttribute("aria-sort", "ascending");
    await expect(t.columna("Valor")).not.toHaveAttribute("aria-sort");
    await expect(t.botonesDeEspecie).toHaveText(["FICTA", "FICTB", "FICTC"]);
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
    await expect(t.botonesDeEspecie).toHaveCount(3);
    // Con mayúsculas exactas: getByText con texto ignora mayúsculas, y la fuente de los cierres del e2e («e2e-ficticio»)
    // se ve en cada fila desde el frente fecha-hora-datos.
    await expect(t.tabla.getByText(/FICTI/)).toHaveCount(0);
    // Ni en «Vendidas por completo» ni en «Qué movió su portafolio»: solo en el aviso.
    await expect(page.getByText(/FICTI/)).toHaveCount(1);
  });

  test("nunca un precio viejo como de hoy: la ilíquida dice su fecha en la fila, la cabecera y los avisos", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await expect(t.cabecera).toContainText("Cierres de fechas distintas: del 1-nov-2024 al 22-nov-2024");
    await expect(t.fila("FICTC")).toContainText("precio del 1-nov-2024 · sin verificar");
    await expect(t.fila("FICTA")).toContainText("sin verificar · 22-nov-2024");
    await expect(page.getByText(/^Con precio de otra fecha/)).toHaveText(
      "Con precio de otra fecha (entra en los totales con su último cierre): FICTC, precio del 1-nov-2024.",
    );
  });

  test("«Qué movió» compara todas en el mismo par de ruedas y dice cuántas omitió", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await expect(t.queMovio).toContainText("Del 21-nov-2024 al 22-nov-2024 · sobre su cantidad actual");
    await expect(t.queMovio).toContainText("Neto +$ 1.480");
    await expect(t.queMovio).toContainText("Se omite 1 especie: no tiene cierre en las dos ruedas.");
    await expect(t.queMovio.getByText("FICTC")).toHaveCount(0);
  });

  test("el detalle dice de qué cierre es el valor", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await t.botonEspecie("FICTC").click();
    await expect(t.detalle("FICTC")).toContainText("Valor al cierre del 1-nov-2024");
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
