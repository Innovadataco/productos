/**
 * E2E de la tarifa real (O5) y de la sección «¿Y si…?» de /operar, contra la base e2e sembrada (tests/e2e/sembrar.ts).
 *  - El dueño simula una compra (la comisión sale de su historia o no se estima), carga una tarifa ficticia de Trii para
 *    compra en /edicion/tarifas (la vigente aparece con su control) y vuelve a simular: la comisión sale «de su tarifa».
 *  - A 375 px, en claro y en oscuro: sin desborde y el botón se lee (AA); ningún texto de la sección recomienda.
 *  - Un familiar simula (no escribe), pero /edicion/tarifas le da 404 y la API de tarifas, 403, sin cambiar la base.
 * Este archivo ESCRIBE en la base e2e (una tarifa): el prefijo «zz-» lo hace correr al final. Datos inventados.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { emitirAccesoFamiliar } from "../../src/auth/familia";
import { MENSAJE_SOLO_LECTURA } from "../../src/auth/respuestas";
import { prohibidasEn } from "../unit/operar/informe/lenguaje";
import { baseE2E, cerrarBaseE2E, sufijo } from "./cuentas";
import { enrolarEnPagina, iniciarSesion, pasarClave, test } from "./sesion";

const MOVIL = { width: 375, height: 812 };
const seccion = (page: Page) => page.locator("section.op-simulador");
const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.afterAll(async () => {
  await cerrarBaseE2E();
});

/** Contraste WCAG entre el texto y el primer fondo opaco del botón o de sus ancestros. */
const contraste = (page: Page, nombre: string) =>
  page.getByRole("button", { name: nombre, exact: true }).evaluate((el) => {
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

async function simular(page: Page, cantidad: string, precio: string): Promise<void> {
  await page.goto("/operar");
  const s = seccion(page);
  await expect(s.getByRole("heading", { level: 2, name: "¿Y si…?" })).toBeVisible();
  await s.getByLabel("Operación", { exact: true }).selectOption("COMPRAR");
  await s.getByLabel("Cantidad de acciones", { exact: true }).fill(cantidad);
  await s.getByLabel("Precio límite ($)", { exact: true }).fill(precio);
  await s.getByLabel("Comisionista", { exact: true }).selectOption("TRII");
  await s.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(s.getByRole("heading", { level: 3, name: "Resultado de la simulación" })).toBeVisible();
}

test.describe("el dueño simula y carga su tarifa", () => {
  test("simula, carga una tarifa de Trii para compra y la simulación la usa", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-tarifas");
    await simular(page, "7", "11,71");
    await expect(seccion(page)).toContainText("Valor de la orden");
    await expect(seccion(page)).toContainText("$ 81,97");
    await expect(seccion(page)).toContainText(/Comisión \((estimada con su historia|no se estima)\)/);
    expect(prohibidasEn(await seccion(page).innerText())).toEqual([]);

    await page.goto("/edicion/tarifas");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tarifas de comisión");
    await page.getByLabel("Comisionista", { exact: true }).selectOption("TRII");
    await page.getByLabel("Lado", { exact: true }).selectOption("COMPRA");
    await page.getByLabel("Porcentaje sobre el valor (%)", { exact: true }).fill("0,2731");
    await page.getByLabel("Mínimo por orden ($)", { exact: true }).fill("7,13");
    await page.getByLabel("Motivo del cambio", { exact: true }).fill("Tarifa ficticia del e2e");
    await page.getByRole("button", { name: "Guardar la versión", exact: true }).click();
    await expect(page).toHaveURL(/\/edicion\/tarifas\?guardada=\d+$/);
    const vigente = page.locator(".tarifa-vigente").filter({ hasText: "Trii · Compra" });
    await expect(vigente).toContainText("0,2731 % del valor (mínimo $ 7,13)");
    await expect(vigente.locator(".tarifa-control")).toHaveText(/^(La tarifa explica \d+ de \d+ órdenes? de compra pasadas|Sin órdenes de compra para contrastar)/);
    expect(prohibidasEn(await page.locator("main").innerText())).toEqual([]);

    // 0,2731 % de $ 81,97 = 0,2239 < mínimo 7,13: la comisión es el mínimo.
    await simular(page, "7", "11,71");
    await expect(seccion(page)).toContainText("Comisión (de su tarifa)");
    await expect(seccion(page)).toContainText("$ 7,13");
    await expect(seccion(page)).toContainText("calculada con su tarifa de Trii para compra · versión");
  });

  test("a 375 px no se desborda, y en claro y en oscuro los botones se leen (AA)", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-tarifas-movil");
    await page.setViewportSize(MOVIL);
    for (const esquema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: esquema });
      await simular(page, "3", "4.613,27");
      expect(await desborde(page), `/operar ${esquema}`).toBe(0);
      expect(await contraste(page, "Simular"), `/operar ${esquema}`).toBeGreaterThanOrEqual(4.5);
      await page.goto("/edicion/tarifas");
      await expect(page.getByRole("button", { name: "Guardar la versión", exact: true })).toBeEnabled();
      expect(await desborde(page), `/edicion/tarifas ${esquema}`).toBe(0);
      expect(await contraste(page, "Guardar la versión"), `/edicion/tarifas ${esquema}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/** El alta por el camino del comando de Jelk (como tests/e2e/zz-edicion.spec.ts). */
async function altaDeFamiliar(page: Page, info: TestInfo): Promise<void> {
  const cuenta = { email: `familiar-tarifas-${sufijo(info)}@ejemplo.invalid`, clave: "clave-ficticia-familiar-tarifas-e2e" };
  const { token } = await emitirAccesoFamiliar(baseE2E(), { email: cuenta.email, ahora: new Date() });
  await page.goto("about:blank");
  await page.goto(`/definir-clave#t=${token}&u=${encodeURIComponent(cuenta.email)}`);
  await page.getByLabel("Contraseña nueva").fill(cuenta.clave);
  await page.getByLabel("Repita la contraseña").fill(cuenta.clave);
  await page.getByRole("button", { name: "Definir contraseña" }).click();
  await expect(page.getByRole("status")).toContainText("Contraseña definida");
  await pasarClave(page, cuenta, "/totp/enrolar");
  await enrolarEnPagina(page, cuenta);
}

test.describe("la familia simula pero no carga tarifas", () => {
  // /edicion/tarifas le responde 404 y la API 403 (el navegador lo registra en la consola): es lo que se prueba.
  test.use({ erroresEsperados: [/\/edicion\/tarifas|\/api\/operar\/tarifas$/] });

  test("simula; /edicion/tarifas le da 404 y la API, 403, sin cambiar la base", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    const antes = await baseE2E().tarifaComision.count();
    await simular(page, "7", "11,71");
    await expect(seccion(page)).toContainText("Valor de la orden");
    expect((await page.goto("/edicion/tarifas"))?.status()).toBe(404);
    await page.goto("/operar");
    const r = await page.evaluate(async () => {
      const cuerpo = { versionBase: 0, comisionista: "TRII", lado: "COMPRA", porcentaje: "1", minimoPorOrden: "0", fijoPorOrden: "0", ivaPct: "0", otrosCargos: [], vigenteDesde: "2027-03-17", motivo: "Intento ficticio" };
      const res = await fetch("/api/operar/tarifas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      return { estado: res.status, cuerpo: (await res.json()) as unknown };
    });
    expect(r.estado).toBe(403);
    expect(r.cuerpo).toEqual({ error: MENSAJE_SOLO_LECTURA });
    expect(await baseE2E().tarifaComision.count()).toBe(antes);
  });
});
