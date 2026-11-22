/**
 * E2E del área de edición (fase B, PR-B) contra la base e2e sembrada (tests/e2e/sembrar.ts y sembrar-plan.ts: v1 desde
 * el 1-jul-2024 con cinco reglas, v2 programada para hoy+30, la venta de FICTI del 14-nov-2024 sin decisión).
 *  - El dueño crea la versión 3 desde la vigente (cambia un nivel, quita la vencida y otra, agrega una), registra la decisión
 *    de la venta de FICTI con su orden y la corrige; a 375 px no hay desborde, y en claro y en oscuro el botón se lee.
 *  - Un familiar no puede: las páginas de edición le dan 404, no ve las entradas y las tres API le responden 403
 *    «Solo lectura» sin cambiar la base.
 * Este archivo ESCRIBE en la base e2e: el prefijo «zz-» lo hace correr al final (Playwright ordena los archivos por
 * nombre con localeCompare y un solo proceso), después de plan.spec.ts, que cuenta las versiones y las órdenes sin
 * decisión. Datos inventados.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { emitirAccesoFamiliar } from "../../src/auth/familia";
import { MENSAJE_SOLO_LECTURA } from "../../src/auth/respuestas";
import { baseE2E, cerrarBaseE2E, sufijo } from "./cuentas";
import { PaginaPlan } from "./pagina-plan";
import { enrolarEnPagina, iniciarSesion, pasarClave, test } from "./sesion";

const MOVIL = { width: 375, height: 812 };

test.afterAll(async () => {
  await cerrarBaseE2E();
});

/** El control con esa etiqueta dentro de `dentro` (una regla, o la página). */
const control = (dentro: Page | ReturnType<Page["locator"]>, etiqueta: string) => dentro.getByLabel(etiqueta, { exact: true });
const regla = (page: Page, numero: number) => page.getByRole("group", { name: `Regla ${numero}`, exact: true });
const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Contraste WCAG entre el texto y el fondo del botón principal (colores computados, sin transparencias). */
const contrasteDelBoton = (page: Page, nombre: string) =>
  page.getByRole("button", { name: nombre, exact: true }).evaluate((b) => {
    const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b2]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b2!);
    };
    const e = getComputedStyle(b);
    const [l1, l2] = [lum(rgb(e.color)), lum(rgb(e.backgroundColor))].sort((x, y) => y - x);
    return (l1! + 0.05) / (l2! + 0.05);
  });

/** Quita la regla cuyo detalle es `detalle` (el valor de un textarea no es texto de la página). */
async function quitarPorDetalle(page: Page, detalle: string): Promise<void> {
  const grupos = page.getByRole("group", { name: /^Regla \d+$/ });
  const i = await grupos.evaluateAll((gs, d) => gs.findIndex((g) => g.querySelector("textarea")?.value === d), detalle);
  expect(i, detalle).toBeGreaterThanOrEqual(0);
  await grupos.nth(i).getByRole("button", { name: /^Quitar la regla \d+$/ }).click();
}

/** Cada control de los formularios tiene su etiqueta (nombre accesible). */
const controlesSinEtiqueta = (page: Page) =>
  page.locator("main form").evaluate((f) => [...f.querySelectorAll("input, select, textarea")].filter((c) => (c as HTMLInputElement).labels?.length === 0).map((c) => c.id || c.tagName));

test.describe("el dueño edita el plan y el diario", () => {
  test("crea la versión 3 desde la vigente, registra la decisión de una orden de Trii y la corrige", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-edicion");
    await page.goto("/plan");
    await page.getByRole("link", { name: "Nueva versión del plan", exact: true }).click();
    await expect(page).toHaveURL("/edicion/plan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nueva versión del plan");
    expect(await controlesSinEtiqueta(page)).toEqual([]);
    await expect(page.getByRole("group", { name: /^Regla \d+$/ })).toHaveCount(5);
    // La primera regla es la de FICTA (en el orden de la base); se cambia su nivel.
    const ficta = page.getByRole("group", { name: /^Regla \d+$/ }).filter({ has: page.locator("select option:checked", { hasText: /^FICTA$/ }) });
    await expect(control(ficta, "Nivel")).toHaveValue("1.200");
    await control(ficta, "Nivel").fill("1.300");
    await control(page, "Motivo del cambio").fill("Ajuste ficticio desde la web (e2e)");
    // La de FICTB venció (31-dic-2024, antes de la fecha de la versión): el formulario lo avisa y se quita.
    const fictb = page.getByRole("group", { name: /^Regla \d+$/ }).filter({ has: page.locator("select option:checked", { hasText: /^FICTB$/ }) });
    await expect(fictb.getByText("Su plazo es anterior a la fecha de la versión", { exact: false })).toBeVisible();
    await fictb.getByRole("button", { name: /^Quitar la regla \d+$/ }).click();
    // Se quita la regla escrita (la de «Siempre orden límite») y se agrega una para FICTC.
    await quitarPorDetalle(page, "Siempre orden límite (ficticia)");
    await page.getByRole("button", { name: "Agregar una regla", exact: true }).click();
    const nueva = regla(page, 4);
    await expect(control(nueva, "Especie")).toBeFocused();
    await control(nueva, "Especie").selectOption({ label: "FICTC" });
    await control(nueva, "Detalle").fill("Mantener FICTC (ficticia, e2e)");
    await page.getByRole("button", { name: "Guardar la versión nueva", exact: true }).click();
    await expect(page).toHaveURL("/plan?version=3");
    const p = new PaginaPlan(page);
    await expect(p.titulo).toHaveText("Versión 3 del plan");
    await expect(p.reglas.getByRole("row")).toHaveCount(5);
    expect((await p.celdas(p.fila(p.reglas, "FICTA")))[1]).toBe("$ 1.300");
    // FICTC ya tenía su regla (comprar bajo el nivel); la nueva se suma.
    await expect(p.reglas).toContainText("Mantener FICTC (ficticia, e2e)");
    await expect(p.reglas).not.toContainText("Siempre orden límite");

    await page.goto("/decisiones");
    await page.getByRole("link", { name: "Registrar una decisión", exact: true }).click();
    await expect(page).toHaveURL("/edicion/decision");
    expect(await controlesSinEtiqueta(page)).toEqual([]);
    await control(page, "Fecha de la decisión").fill("2024-11-14");
    await control(page, "Especie").selectOption({ label: "FICTI" });
    await control(page, "Qué decidió").selectOption("VENDER");
    await control(page, "Cantidad").fill("20");
    await control(page, "Por qué").fill("Vender FICTI (ficticio, e2e)");
    await control(page, "Orden de Trii (opcional)").selectOption({ label: "14-nov-2024 · FICTI · Venta de 20" });
    await page.getByRole("button", { name: "Registrar la decisión", exact: true }).click();
    await expect(page).toHaveURL(/\/decisiones\/[a-z0-9]+$/);
    await expect(p.titulo).toHaveText("Vender · FICTI · 14-nov-2024");
    await expect(page.getByRole("navigation", { name: "Cadena de la decisión" })).toContainText("1 orden enlazada");

    await page.getByRole("link", { name: "Corregir esta decisión", exact: true }).click();
    await expect(page).toHaveURL(/\/edicion\/decision\?corrige=[a-z0-9]+$/);
    await expect(control(page, "Por qué")).toHaveValue("Vender FICTI (ficticio, e2e)");
    await control(page, "Por qué").fill("Vender FICTI (ficticio, e2e, corregida)");
    await page.getByRole("button", { name: "Registrar la corrección", exact: true }).click();
    await expect(page).toHaveURL(/\/decisiones\/[a-z0-9]+$/);
    await expect(page.getByText("Corrige la decisión del 14-nov-2024", { exact: false })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Cadena de la decisión" })).toContainText("1 orden enlazada");
  });

  test("a 375 px no se desborda, y en claro y en oscuro el botón principal se lee (AA)", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-edicion-movil");
    await page.setViewportSize(MOVIL);
    for (const [ruta, boton] of [["/edicion/plan", "Guardar la versión nueva"], ["/edicion/decision", "Registrar la decisión"]] as const) {
      for (const esquema of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: esquema });
        await page.goto(ruta);
        await expect(page.getByRole("button", { name: boton, exact: true })).toBeEnabled();
        expect(await desborde(page), `${ruta} ${esquema}`).toBe(0);
        expect(await contrasteDelBoton(page, boton), `${ruta} ${esquema}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

/** El alta por el camino del comando de Jelk (como tests/e2e/familia.spec.ts). */
async function altaDeFamiliar(page: Page, info: TestInfo): Promise<void> {
  const cuenta = { email: `familiar-edicion-${sufijo(info)}@ejemplo.invalid`, clave: "clave-ficticia-familiar-edicion-e2e" };
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

const conteos = async () => {
  const db = baseE2E();
  return [await db.planVersion.count(), await db.reglaPlan.count(), await db.decision.count(), await db.enlaceDecisionOrden.count()];
};

test.describe("la familia no puede editar", () => {
  // Las páginas de edición le responden 404 y las API 403 (el navegador lo registra en la consola): es lo que se prueba.
  // Una sola expresión: con dos elementos, test.use leería el arreglo como [valor, opciones] del fixture.
  test.use({ erroresEsperados: [/\/edicion\/|\/api\/(plan\/versiones|decisiones(\/enlaces)?)$/] });

  test("las páginas de edición le dan 404, no ve las entradas y las API le responden 403 sin cambiar la base", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    const antes = await conteos();
    for (const ruta of ["/edicion/plan", "/edicion/decision", "/edicion/enlace?decision=cualquiera"]) {
      const r = await page.goto(ruta);
      expect(r?.status(), ruta).toBe(404);
    }
    for (const ruta of ["/plan", "/decisiones"]) {
      await page.goto(ruta);
      await expect(page.locator('a[href^="/edicion"]'), ruta).toHaveCount(0);
    }
    const pedidos = [
      ["/api/plan/versiones", { vigenteDesde: "2027-03-17", motivo: "Intento ficticio", versionBase: 0, reglas: [] }],
      ["/api/decisiones", { fechaDecision: "2024-11-14", instrumentoId: "x", accion: "VENDER", cantidad: "", reglaId: null, excepcion: false, motivo: "Intento ficticio", ordenId: null, corrige: null }],
      ["/api/decisiones/enlaces", { decisionId: "x", ordenId: "y" }],
    ] as const;
    // Desde la página, con su cookie de sesión y su Origin reales (como lo haría un formulario).
    for (const [ruta, cuerpo] of pedidos) {
      const r = await page.evaluate(async ({ ruta: url, cuerpo: datos }) => {
        const respuesta = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
        return { estado: respuesta.status, cuerpo: (await respuesta.json()) as unknown };
      }, { ruta, cuerpo });
      expect(r.estado, ruta).toBe(403);
      expect(r.cuerpo, ruta).toEqual({ error: MENSAJE_SOLO_LECTURA });
    }
    expect(await conteos()).toEqual(antes);
  });
});
