/**
 * E2E de la pantalla de proyecciones (frente proyecciones-pantalla) contra la base e2e: tests/e2e/sembrar.ts más los
 * cierres yahoo inventados de 2019-2021 de tests/e2e/sembrar-proyecciones.ts (FICTA y FICTB se proyectan; FICTC no
 * tiene yahoo y queda fuera, con su aviso). El «hoy» del servidor es la fecha real: las pruebas no fijan fechas del
 * escenario. Capturas en escritorio y a 375 px, claro y oscuro, solo con CAPTURAS_PROYECCIONES (fuera del repo).
 */
import { expect } from "@playwright/test";
import { AVISO } from "../../src/proyecciones/tipos";
import { APP } from "./base";
import { PaginaProyecciones, TITULO_ABANICO } from "./pagina-proyecciones";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const ANCHO_CELULAR = { width: 375, height: 812 };
const RAPIDO_MS = 2_000;

test.describe("pantalla de proyecciones", () => {
  test("desde el tablero: la navegación lleva a Proyecciones, con el aviso fijo, el abanico con «Hoy» y los supuestos", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await t.cabecera.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Proyecciones", exact: true }).click();
    await expect(page).toHaveURL("/proyecciones");
    const p = await PaginaProyecciones.abrir(page, info);
    await expect(p.titulo).toHaveText("Proyecciones");
    await expect(page.getByText(AVISO).first()).toBeVisible();
    await expect(p.abanico).toBeVisible();
    await expect(p.abanico.locator(".g-corte")).toHaveText("Hoy");
    await expect(p.abanico.locator("path.g-banda")).toHaveCount(2);
    await expect(p.abanico.locator("defs linearGradient")).toHaveCount(2);
    await expect(p.supuestos.locator(".proy-supuestos li").first()).toContainText("Método");
    await expect(p.supuestos).toContainText("FICTA");
    await expect(p.supuestos.locator(".proy-avisos")).toContainText("FICTC");
    await expect(page.locator("footer.pie")).toHaveText("El sistema calcula y muestra; no recomienda comprar ni vender.");
  });

  test("mover un control cambia las bandas (interpoladas) y los indicadores, y se anuncia; responde en menos de 2 s", async ({ page }, info) => {
    const p = await PaginaProyecciones.abrir(page, info);
    const antes = await p.bandaSuave().getAttribute("d");
    const probabilidadAntes = await p.indicador("Probabilidad").textContent();
    const inicio = Date.now();
    const respuesta = page.waitForResponse((r) => r.url().endsWith("/api/proyecciones") && r.request().method() === "POST");
    await p.botonHorizonte("10 años").click();
    await expect(p.resultado).toHaveAttribute("aria-busy", "true");
    const r = await respuesta;
    expect(r.status()).toBe(200);
    expect(r.headers()["cache-control"]).toBe("no-store");
    expect(await r.request().postDataJSON()).toEqual({ horizonteMeses: 120, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0 });
    await expect(p.resultado).toHaveAttribute("aria-busy", "false");
    expect(Date.now() - inicio).toBeLessThan(RAPIDO_MS);
    // A mitad de la animación la banda ya no es la de antes; al final, tampoco, y es la definitiva.
    await expect.poll(() => p.bandaSuave().getAttribute("d")).not.toBe(antes);
    await p.esperarCalculo();
    const final = await p.bandaSuave().getAttribute("d");
    expect(final).not.toBe(antes);
    await expect(p.anuncio).toContainText("Proyección a 10 años");
    await expect(p.indicador("Probabilidad")).not.toHaveText(probabilidadAntes ?? "");
    await expect(p.mira).toHaveAttribute("aria-valuetext", /^Mes 120 · /);
  });

  test("el aporte, su frecuencia, la reinversión y la caída inicial viajan y cambian el resultado", async ({ page }, info) => {
    const p = await PaginaProyecciones.abrir(page, info);
    const aportadoAntes = await p.indicador("Lo aportado").textContent();
    // Si entre un cambio y otro pasan más de 350 ms sale un pedido intermedio: se espera el que trae todo.
    const respuesta = page.waitForResponse((r) => r.url().endsWith("/api/proyecciones") && JSON.parse(r.request().postData() ?? "{}").caidaInicialPct === 13);
    await page.getByLabel("Aporte periódico (pesos)").fill("41371");
    await page.getByRole("group", { name: "Frecuencia del aporte" }).getByRole("button", { name: "Trimestral", exact: true }).click();
    await page.getByRole("switch", { name: "Reinvertir los dividendos" }).click();
    await p.mover(page.getByLabel("Caída inicial"), 13);
    expect((await respuesta).request().postDataJSON()).toEqual({ horizonteMeses: 60, aportePeriodico: 41371, frecuenciaAporte: "TRIMESTRAL", reinvertirDividendos: false, caidaInicialPct: 13 });
    await p.esperarCalculo();
    await expect(p.indicador("Lo aportado")).not.toHaveText(aportadoAntes ?? "");
    await expect(p.supuestos).toContainText("Caída inicial de 13,0 %");
    await expect(p.supuestos).toContainText("Los dividendos se cobran");
  });

  test("con el teclado: el horizonte fino con flechas y el deslizador de la gráfica recorre los meses", async ({ page }, info) => {
    const p = await PaginaProyecciones.abrir(page, info);
    const fino = page.getByLabel("Ajuste fino del horizonte");
    await fino.focus();
    await page.keyboard.press("ArrowRight");
    await expect(fino).toHaveAttribute("aria-valuetext", "5 años y 1 mes");
    await p.esperarCalculo();
    await p.mira.focus();
    await page.keyboard.press("End");
    await expect(p.mira).toHaveAttribute("aria-valuetext", /^Mes 61 · /);
    await page.keyboard.press("ArrowLeft");
    await expect(p.mira).toHaveAttribute("aria-valuetext", /^Mes 60 · /);
    await expect(p.abanico.locator(".g-tip")).toContainText("Mes 60");
  });

  test("«Ver los datos» abre la tabla de la gráfica con un mes por fila", async ({ page }, info) => {
    const p = await PaginaProyecciones.abrir(page, info);
    await p.abanico.getByText("Ver los datos").click();
    const tabla = p.abanico.getByRole("table", { name: TITULO_ABANICO });
    await expect(tabla).toBeVisible();
    await expect(tabla.getByRole("row").last()).toContainText("Mes 60");
  });

  test("la API sin sesión responde 401 y no calcula", async ({ playwright }) => {
    const origen = `http://${APP.host}:${APP.puerto}`;
    const sinSesion = await playwright.request.newContext({ baseURL: origen });
    const r = await sinSesion.post("/api/proyecciones", { data: { horizonteMeses: 12 }, headers: { origin: origen } });
    expect(r.status()).toBe(401);
    await sinSesion.dispose();
  });

  test.describe("con «reducir movimiento»", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("al mover un control, las bandas saltan al resultado nuevo sin animaciones", async ({ page }, info) => {
      const p = await PaginaProyecciones.abrir(page, info);
      const antes = await p.bandaSuave().getAttribute("d");
      await p.botonHorizonte("1 año").click();
      await expect(p.resultado).toHaveAttribute("aria-busy", "false");
      await expect.poll(() => p.bandaSuave().getAttribute("d")).not.toBe(antes);
      const d = await p.bandaSuave().getAttribute("d");
      await page.waitForTimeout(120);
      expect(await p.bandaSuave().getAttribute("d")).toBe(d);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    });
  });

  for (const tema of ["light", "dark"] as const) {
    const nombre = tema === "light" ? "claro" : "oscuro";

    test.describe(`escritorio · ${nombre}`, () => {
      test.use({ colorScheme: tema });

      test("se captura la pantalla completa y el abanico con el detalle de un mes", async ({ page }, info) => {
        const p = await PaginaProyecciones.abrir(page, info);
        await p.esperarCalculo();
        await p.capturar(`proyecciones-escritorio-${nombre}`);
        await p.abanico.scrollIntoViewIfNeeded();
        await p.mira.hover({ position: { x: 300, y: 80 } });
        await expect(p.abanico.locator(".g-tip")).toBeVisible();
        await p.capturar(`proyecciones-detalle-${nombre}`, false);
      });
    });

    test.describe(`a 375 px · ${nombre}`, () => {
      test.use({ viewport: ANCHO_CELULAR, colorScheme: tema, hasTouch: true });

      test("sin desborde, controles de al menos 44 px para el dedo y la gráfica dentro de la pantalla", async ({ page }, info) => {
        const p = await PaginaProyecciones.abrir(page, info);
        await p.esperarCalculo();
        await expect.poll(() => p.desbordeHorizontal()).toBeLessThanOrEqual(0);
        expect((await p.abanico.boundingBox())!.width).toBeLessThanOrEqual(ANCHO_CELULAR.width);
        for (const control of [p.botonHorizonte("5 años"), page.getByLabel("Ajuste fino del horizonte"), page.getByLabel("Aporte periódico (pesos)"), page.getByRole("switch", { name: "Reinvertir los dividendos" }), page.getByLabel("Caída inicial")]) {
          const caja = await control.boundingBox();
          expect(caja!.height, await control.evaluate((e) => e.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44);
        }
        await p.botonHorizonte("3 años").tap();
        await p.esperarCalculo();
        await p.capturar(`proyecciones-375-${nombre}`);
      });
    });
  }
});
