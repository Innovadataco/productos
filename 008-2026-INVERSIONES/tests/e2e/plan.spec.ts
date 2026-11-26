/**
 * E2E de /plan, /decisiones y /decisiones/[id] (fase B, corte 3) contra la base e2e sembrada por tests/e2e/sembrar.ts
 * y sembrar-plan.ts (ver su cabecera). Datos inventados. Las fechas «de hoy» son las de la corrida (hoyDelE2E, la
 * misma que usó la siembra). La prueba no cambia la base.
 */
import { expect } from "@playwright/test";
import { fecha } from "../../src/app/tablero/formato";
import { sumarDias } from "../../src/plan/fechas";
import { hoyDelE2E } from "./base";
import { PaginaPlan } from "./pagina-plan";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const ANCHO_MOVIL = { width: 400, height: 900 };
const enDias = (dias: number) => fecha(sumarDias(hoyDelE2E(), dias).toISOString().slice(0, 10));

test.describe("plan y diario de decisiones", () => {
  test("del tablero al plan: la vigente, sus reglas, la distancia al nivel y FICTC «sin negociación desde…»", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await t.cabecera.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Plan", exact: true }).click();
    await expect(page).toHaveURL("/plan");
    const p = new PaginaPlan(page);
    await expect(p.titulo).toHaveText("Plan vigente: versión 1");
    await expect(page.getByText("Cierres al 22-nov-2024", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Los precios no se han actualizado desde el 22-nov-2024.");
    await expect(page.getByRole("link", { name: `La versión 2 entra a regir el ${enDias(30)}.`, exact: true })).toHaveAttribute("href", "/plan?version=2");

    const ficta = await p.celdas(p.fila(p.reglas, "FICTA"));
    expect(ficta.slice(0, 5)).toEqual(["Cierre por encima de", "$ 1.200", "vender", "50", "sin plazo"]);
    expect(ficta[5]).toContain("$ 1.100 · 22-nov-2024");
    expect(ficta[6]).toBe("por debajo del nivel de $ 1.200: tendría que subir 9,09 % para tocarlo (la regla se cumple si cierra por encima)");
    const fictb = await p.celdas(p.fila(p.reglas, "FICTB"));
    expect([fictb[4], fictb[6]]).toEqual(["venció el 31-dic-2024", "tocada · cierre bajo el nivel"]);
    const fictc = await p.celdas(p.fila(p.reglas, "FICTC"));
    expect(fictc[5]).toContain("sin negociación desde 5-nov-2024, último cierre 1-nov-2024");
    expect(fictc[6]).toBe("sin cierre al día");
    await expect(page.getByText("«Sin negociación» se deduce de que no hay cierre en esos días hábiles de la BVC", { exact: false })).toBeVisible();
    await expect(page.locator("footer")).toContainText("no recomienda comprar ni vender");
  });

  test("el diario: «no actuar» con el dividendo dentro de los 90 días, la venta sin precio y la pendiente", async ({ page }, info) => {
    await PaginaTablero.abrir(page, info);
    await page.goto("/decisiones");
    const p = new PaginaPlan(page);
    await expect(p.titulo).toHaveText("Diario de decisiones");
    const noActuar = await p.celdas(p.fila(p.decisiones, "22-jul-2024"));
    expect(noActuar.slice(0, 6)).toEqual(["FICTA", "No actuar (excepción a la regla)", "43", "v1 · Cierre por encima de $ 1.200 → vender", "Mantener hasta el dividendo de octubre (ficticio)", "—"]);
    expect(noActuar[6]).toContain("Funcionó · +$ 1.548");
    expect(noActuar[6]).toContain("precio +$ 1.548 · dividendos $ 0");
    expect(noActuar[7]).toContain("Funcionó · +$ 5.246");
    expect(noActuar[7]).toContain("precio +$ 4.730 · dividendos +$ 516");
    const venta = await p.celdas(p.fila(p.decisiones, "12-nov-2024"));
    expect(venta.slice(5)).toEqual(["1", "Sin precio: falta un cierre de Yahoo entre el 6-dic-2024 y el 13-dic-2024", "Sin precio: falta un cierre de Yahoo entre el 4-feb-2025 y el 11-feb-2025"]);
    const pendiente = await p.celdas(p.fila(p.decisiones, enDias(-3)));
    expect(pendiente[6]).toBe(`Pendiente hasta el ${enDias(27)}`);
    expect(await p.celdas(p.fila(p.sinDecision, "14-nov-2024"))).toEqual(["FICTI", "Venta", "20", expect.stringMatching(/^fila \d+ de la carga del /)]);
    await expect(page.getByText("4 órdenes anteriores al plan", { exact: true })).toBeVisible();
  });

  test("de la cifra a su cadena, y de la cadena a la regla del plan", async ({ page }, info) => {
    await PaginaTablero.abrir(page, info);
    await page.goto("/decisiones");
    const p = new PaginaPlan(page);
    await p.fila(p.decisiones, "22-jul-2024").getByRole("link", { name: "Funcionó · +$ 5.246", exact: true }).click();
    await expect(page).toHaveURL(/\/decisiones\/[a-z0-9]+$/);
    await expect(p.titulo).toHaveText("No actuar · FICTA · 22-jul-2024");
    await expect(page.getByText("Pagado el 17-oct-2024: $ 1.200 netos sobre 100 acciones ($ 12 por acción) → $ 516", { exact: true })).toBeVisible();
    const cadena = page.getByRole("navigation", { name: "Cadena de la decisión" });
    await cadena.getByRole("link", { name: "Cierre por encima de $ 1.200 → vender", exact: true }).click();
    await expect(page).toHaveURL(/\/plan\?version=1#regla-[a-z0-9]+$/);
    await expect(p.titulo).toHaveText("Plan vigente: versión 1");
  });

  test("la versión programada se ve sin cierres; una versión que no existe da un aviso, nunca un error", async ({ page }, info) => {
    await PaginaTablero.abrir(page, info);
    await page.goto("/plan?version=2");
    const p = new PaginaPlan(page);
    await expect(p.titulo).toHaveText("Versión 2 del plan");
    await expect(page.getByRole("columnheader", { name: "Último cierre" })).toHaveCount(0);
    for (const version of ["basura", "99", "01"]) {
      const r = await page.goto(`/plan?version=${version}`);
      expect(r?.status(), version).toBe(200);
      await expect(p.titulo).toHaveText("No hay una versión del plan con ese número");
      await expect(p.versiones.getByRole("link")).toHaveCount(2);
    }
    // Con sesión, una decisión que no existe da su aviso (nunca un 500 ni el id escrito).
    const r = await page.goto("/decisiones/noexiste");
    expect(r?.status()).toBe(200);
    await expect(p.titulo).toHaveText("No hay una decisión con ese identificador");
    await expect(page.locator("main")).not.toContainText("noexiste");
  });

  test("en el teléfono, /plan y /decisiones no se desbordan a lo ancho (las tablas se desplazan en su caja)", async ({ page }, info) => {
    await page.setViewportSize(ANCHO_MOVIL);
    await PaginaTablero.abrir(page, info);
    for (const ruta of ["/plan", "/decisiones"]) {
      await page.goto(ruta);
      const p = new PaginaPlan(page);
      await expect(p.titulo).toBeVisible();
      expect(await p.desbordeHorizontal(), ruta).toBe(0);
    }
    const caja = page.getByRole("region", { name: "Decisiones", exact: true });
    await caja.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => caja.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
    // La cadena: la etiqueta de cada par («Qué», «Registrada»…) no colapsa con un motivo largo (react-reviewer MEDIO).
    await page.getByRole("link", { name: "Funcionó · +$ 5.246", exact: true }).click();
    await expect(page).toHaveURL(/\/decisiones\/[a-z0-9]+$/);
    const p = new PaginaPlan(page);
    expect(await p.desbordeHorizontal()).toBe(0);
    const anchos = await page.locator("dl.pares dt").evaluateAll((dts) => dts.map((dt) => dt.getBoundingClientRect().width));
    expect(anchos.length).toBe(5);
    for (const ancho of anchos) expect(ancho).toBeGreaterThan(30);
  });

  test("sin sesión, /plan y /decisiones llevan a ingresar", async ({ page }) => {
    for (const ruta of ["/plan", "/decisiones", "/decisiones/cualquiera"]) {
      await page.goto(ruta);
      await expect(page).toHaveURL("/ingresar");
    }
  });
});
