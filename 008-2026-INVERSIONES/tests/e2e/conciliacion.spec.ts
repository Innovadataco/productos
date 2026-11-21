/**
 * E2E de /conciliacion (PR-C) contra la base e2e sembrada por tests/e2e/sembrar.ts y sembrar-conciliacion.ts.
 * Datos inventados (ver la cabecera de sembrar-conciliacion.ts):
 *   22-nov-2024 · FICTA y FICTB cuadran; FICTC sin cierre del día (no se pudo verificar); FICTI solo en el
 *                 sistema; el efectivo con una partida sin fuente → «No cuadra».
 *   14-nov-2024 · FICTB con la venta del 13-nov por liquidar (T+2) y la de FICTI del 14-nov; sin cierres.
 * La prueba no cambia la base.
 */
import { expect } from "@playwright/test";
import { MOTIVOS } from "../../src/app/conciliacion/motivos";
import { PaginaConciliacion } from "./pagina-conciliacion";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const ANCHO_MOVIL = { width: 400, height: 900 };

test.describe("conciliación con la certificación de A&V", () => {
  test("desde el tablero, la línea lleva al último corte: resultado, al día y la tabla de acciones", async ({ page }, info) => {
    await PaginaTablero.abrir(page, info);
    const linea = page.getByRole("link", { name: "Conciliación con A&V al 22-nov-2024: no cuadra", exact: true });
    await linea.click();
    await expect(page).toHaveURL("/conciliacion");

    const c = new PaginaConciliacion(page);
    await expect(c.titulo).toHaveText("Corte del 22-nov-2024: No cuadra");
    await expect(page.getByText("Está al día con los datos que hay hoy en el sistema.")).toBeVisible();
    expect(await c.celdas(c.fila(c.acciones, "FICTA"))).toEqual(["100", "100", "0", "$ 110.000", "$ 110.000", "0,00 %", "Cuadra", ""]);
    expect(await c.celdas(c.fila(c.acciones, "FICTB"))).toEqual(["80", "80", "0", "$ 153.040", "$ 153.040", "0,00 %", "Cuadra", ""]);
    expect(await c.celdas(c.fila(c.acciones, "FICTC"))).toEqual(["10", "10", "0", "$ 5.050", "—", "—", "No se pudo verificar", MOTIVOS.sin_precio_al_corte]);
    expect(await c.celdas(c.fila(c.acciones, "FICTI"))).toEqual(["0", "−10", "+10", "—", "—", "—", "No cuadra", MOTIVOS.no_certificada]);
    expect(await c.celdas(c.fila(c.acciones, "Total de acciones"))).toEqual(["", "", "", "$ 268.090", "—", "—", "No se pudo verificar", MOTIVOS.sin_precio_al_corte]);
  });

  test("el efectivo dice por qué no cuadra; sin fondo no hay fila de fondo; nunca el titular ni la cuenta", async ({ page }, info) => {
    await PaginaTablero.abrir(page, info);
    await page.goto("/conciliacion");
    const c = new PaginaConciliacion(page);
    const efectivo = await c.celdas(c.fila(c.saldos, "Efectivo"));
    expect(efectivo[0]).toBe("$ 1.000");
    expect(efectivo.slice(4)).toEqual(["No cuadra", MOTIVOS.partida_sin_fuente]);
    await expect(c.saldos.getByRole("row")).toHaveCount(2);
    const todo = await page.locator("body").innerText();
    expect(todo).not.toContain("Titular Ficticio Uno");
    expect(todo).not.toMatch(/p\d+:f\d+/);
    expect(todo).not.toMatch(/npm|npx|tsx|--fecha/);
  });

  test("el selector lleva al 14-nov: lo que estaba por liquidar y el porqué de FICTB", async ({ page }, info) => {
    await PaginaTablero.abrir(page, info);
    await page.goto("/conciliacion");
    const c = new PaginaConciliacion(page);
    await expect(c.corte("22-nov-2024 · No cuadra")).toHaveAttribute("aria-current", "page");
    await c.corte("14-nov-2024 · No cuadra").click();
    await expect(page).toHaveURL("/conciliacion?corte=2024-11-14");
    await expect(c.titulo).toHaveText("Corte del 14-nov-2024: No cuadra");
    await expect(c.corte("14-nov-2024 · No cuadra")).toHaveAttribute("aria-current", "page");

    const fictb = await c.celdas(c.fila(c.acciones, "FICTB"));
    expect(fictb.slice(0, 3)).toEqual(["80", "100", "−20"]);
    expect(fictb[6]).toBe("No se pudo verificar");
    expect(fictb[7]).toContain(MOTIVOS.t_mas_2);
    await expect(page.getByText("según las órdenes que hay hoy en el sistema", { exact: false })).toBeVisible();
    expect(await c.celdas(c.fila(c.porLiquidar, "FICTB"))).toEqual(["Venta", "20", "13-nov-2024", "15-nov-2024"]);
    expect(await c.celdas(c.fila(c.porLiquidar, "FICTI"))).toEqual(["Venta", "20", "14-nov-2024", "18-nov-2024"]);
  });

  test("un corte que no está cargado da un aviso y ofrece los cortes", async ({ page }, info) => {
    await PaginaTablero.abrir(page, info);
    await page.goto("/conciliacion?corte=2024-11-15");
    const c = new PaginaConciliacion(page);
    await expect(c.titulo).toHaveText("No hay certificación con esa fecha de corte");
    await expect(c.cortes.getByRole("link")).toHaveCount(2);
    await expect(c.acciones).toHaveCount(0);
  });

  test("en el teléfono la página no se desborda a lo ancho (las tablas se desplazan dentro de su caja)", async ({ page }, info) => {
    await page.setViewportSize(ANCHO_MOVIL);
    await PaginaTablero.abrir(page, info);
    await page.goto("/conciliacion");
    const c = new PaginaConciliacion(page);
    await expect(c.titulo).toBeVisible();
    expect(await c.desbordeHorizontal()).toBe(0);
  });

  test("sin sesión, /conciliacion lleva a ingresar", async ({ page }) => {
    await page.goto("/conciliacion");
    await expect(page).toHaveURL("/ingresar");
  });
});
