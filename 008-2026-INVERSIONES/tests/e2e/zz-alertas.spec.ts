/**
 * E2E de las alertas (D1 a D3), contra la base e2e sembrada (tests/e2e/sembrar.ts):
 *  - el dueño ve las alertas de los últimos 30 días agrupadas por día con su texto y de dónde y cuándo es cada dato, marca una y el
 *    contador de «Alertas» en el menú baja, marca todas y el contador desaparece (con 0 no se muestra);
 *  - el dueño guarda una versión de los umbrales en /edicion/alertas y queda en la historia;
 *  - la familia ve las alertas SIN botones, /edicion/alertas le da 404 y su POST a las dos rutas, 403, sin cambiar la base;
 *  - a 375 px, en claro y en oscuro: sin desborde y los botones y el contador se leen (AA);
 *  - todos los textos de las pantallas pasan el detector de lenguaje de consejo (prohibidasEn).
 * Este archivo ESCRIBE en la base e2e (alertas, marcas y una versión de umbrales): el prefijo «zz-» lo hace correr al final. Las
 * alertas las siembra la prueba directo en la tabla (como el servicio de las alertas) con especies propias de cada prueba. Datos
 * inventados.
 */
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { emitirAccesoFamiliar } from "../../src/auth/familia";
import { MENSAJE_SOLO_LECTURA } from "../../src/auth/respuestas";
import { prohibidasEn } from "../unit/operar/informe/lenguaje";
import { hoyEnBogotaIso } from "./base";
import { baseE2E, cerrarBaseE2E, sufijo } from "./cuentas";
import { enrolarEnPagina, iniciarSesion, pasarClave, test } from "./sesion";

const MOVIL = { width: 375, height: 812 };
const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const hace = (dias: number): string => hoyEnBogotaIso(new Date(Date.now() - dias * 86_400_000));
const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const contador = (page: Page) => page.locator('header nav[aria-label="Secciones"] .alertas-contador');
const botonesMarcar = (page: Page) => page.getByRole("button", { name: /^Marcar como vista/ });

test.afterAll(async () => {
  await cerrarBaseE2E();
});

/** Contraste WCAG entre el texto de un elemento y el primer fondo opaco de él o de sus ancestros. */
const contraste = (el: Locator) =>
  el.first().evaluate((nodo) => {
    const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    let fondo: Element | null = nodo;
    while (fondo && (rgba(getComputedStyle(fondo).backgroundColor)[3] ?? 1) === 0) fondo = fondo.parentElement;
    const bg = fondo ? getComputedStyle(fondo).backgroundColor : getComputedStyle(document.body).backgroundColor;
    const [l1, l2] = [lum(rgba(getComputedStyle(nodo).color)), lum(rgba(bg))].sort((x, y) => y - x);
    return (l1! + 0.05) / (l2! + 0.05);
  });

/** Siembra tres alertas con una especie propia: dos de hoy (un cierre y una barra de la rueda) y una de hace dos días. Devuelve la especie. */
async function sembrarAlertas(info: TestInfo): Promise<string> {
  const db = baseE2E();
  const nemo = `ZE${sufijo(info).replace(/[^a-z0-9]/g, "").slice(-8).toUpperCase()}`;
  const especie = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo, nombre: "Especie ficticia de alertas" } });
  const hoy = hace(0);
  const comunes = { instrumentoId: especie.id, motorVersion: "alertas-v1", fuente: "yahoo" };
  await db.alerta.create({
    data: { ...comunes, dia: dia(hoy), tipo: "MOVIMIENTO_DIA", sentido: "BAJO", base: "CIERRE", precio: "90.5", variacionPct: "-10", umbral: "3", esFechaEx: false, traidoEn: new Date(`${hoy}T23:20:00.000Z`) },
  });
  await db.alerta.create({
    data: {
      ...comunes, dia: dia(hoy), tipo: "MOVIMIENTO_DIA", sentido: "SOBRE", base: "INTRADIA", precio: "105.25", variacionPct: "5", umbral: "3", conRetraso: true, esFechaEx: false,
      instanteDato: new Date(`${hoy}T16:10:00.000Z`), traidoEn: new Date(`${hoy}T16:31:00.000Z`),
    },
  });
  await db.alerta.create({ data: { ...comunes, dia: dia(hace(2)), tipo: "DATO_VIEJO", sentido: "CIERRE_FALTANTE", base: "CIERRE", fuente: null } });
  return nemo;
}

/** Las especies de esta prueba quedan al final, sin marcar: las del resto del archivo ya están marcadas o son otras. */
async function marcarTodasPorBase(): Promise<void> {
  const db = baseE2E();
  const dueno = await db.usuario.findFirst({ where: { rol: "DUENO" }, select: { id: true } });
  const sin = await db.alerta.findMany({ where: { vista: { is: null } }, select: { id: true } });
  if (dueno && sin.length > 0) await db.alertaVista.createMany({ data: sin.map((a) => ({ alertaId: a.id, usuarioId: dueno.id })), skipDuplicates: true });
}

test.describe("el dueño ve, marca y configura las alertas", () => {
  test("ve las alertas por día con su dato, marca una (el contador baja) y marca todas (el contador desaparece)", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-alertas");
    await marcarTodasPorBase();
    const nemo = await sembrarAlertas(info);
    await page.goto("/alertas");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alertas");

    // Las de esta prueba (las de las otras pruebas del archivo quedan en la lista, ya marcadas): dos de hoy y una de hace dos días.
    const items = page.locator("main li.alerta").filter({ hasText: nemo });
    await expect(items).toHaveCount(3);
    await expect(page.locator("main h2").filter({ hasText: /^\d{1,2}-[a-z]{3}-\d{4}$/ }).first()).toBeVisible();
    const texto = await page.locator("main").innerText();
    expect(texto).toContain(`«${nemo}»: cierre del día (90,5) está 10 % por debajo del cierre anterior.`);
    expect(texto).toMatch(new RegExp(`«${nemo}»: precio de la barra de las 11:10 \\(hora de Colombia\\), con el retraso de unos 20 minutos de Yahoo \\(105,25\\) está 5 % por encima del cierre anterior\\.`));
    expect(texto).toContain(`«${nemo}»: falta el cierre de hoy.`);
    await expect(page.locator("main .fecha-dato").first()).toContainText("Yahoo (BVC)");
    await expect(page.locator("main .fecha-dato", { hasText: "a las 11:10" })).toContainText("hasta 20 min de retraso");
    expect(prohibidasEn(texto)).toEqual([]);

    // El contador del menú: las 3 sin marcar de los últimos 7 días.
    await expect(contador(page)).toHaveText("3");
    await expect(contador(page)).toHaveAttribute("aria-label", "3 alertas sin marcar de los últimos 7 días");
    await expect(botonesMarcar(page)).toHaveCount(3);

    // Marcar una: la página recarga, esa alerta queda «Vista» y el contador baja a 2.
    await botonesMarcar(page).first().click();
    await expect(contador(page)).toHaveText("2");
    await expect(botonesMarcar(page)).toHaveCount(2);
    await expect(items.locator(".alerta-vista")).toHaveCount(1);
    await expect(items.locator(".alerta-vista")).toContainText("Vista el");

    // Marcar todas: ya no hay botones y con 0 el contador no se muestra.
    await page.getByRole("button", { name: "Marcar todas como vistas", exact: true }).click();
    await expect(contador(page)).toHaveCount(0);
    await expect(botonesMarcar(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Marcar todas como vistas", exact: true })).toHaveCount(0);
    await expect(items.locator(".alerta-vista")).toHaveCount(3);
    expect(prohibidasEn(await page.locator("main").innerText())).toEqual([]);
  });

  test("guarda una versión de los umbrales en /edicion/alertas y queda en la historia; el índice la enlaza", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-alertas-config");
    await page.goto("/edicion");
    await expect(page.getByRole("link", { name: "Alertas", exact: true }).first()).toBeVisible();
    await page.goto("/edicion/alertas");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alertas");
    await page.getByLabel("Distancia al nivel (%)", { exact: true }).fill("4,5");
    await page.getByLabel("Minutos sin renovarse", { exact: true }).fill("60");
    await page.getByLabel("Motivo del cambio", { exact: true }).fill("Umbrales ficticios del e2e");
    await page.getByRole("button", { name: "Guardar la versión", exact: true }).click();
    await expect(page).toHaveURL(/\/edicion\/alertas\?guardada=\d+$/);
    const guardada = page.locator(".alertas-historia li").filter({ hasText: "Versión guardada" });
    await expect(guardada).toContainText("Cerca 4,5 %");
    await expect(guardada).toContainText("Dato viejo 60 min");
    await expect(guardada).toContainText("Umbrales ficticios del e2e");
    // La versión nueva parte de lo vigente.
    await expect(page.getByLabel("Distancia al nivel (%)", { exact: true })).toHaveValue("4,5");
    expect(prohibidasEn(await page.locator("main").innerText())).toEqual([]);
  });

  // El 400 del servidor se registra en la consola del navegador: es lo que se prueba.
  test.describe("con un valor inválido", () => {
    test.use({ erroresEsperados: [/\/api\/alertas\/umbrales$/] });

    test("un valor fuera de rango se marca en su campo y no guarda", async ({ page }, info) => {
      await iniciarSesion(page, info, "dueno-alertas-rango");
      await page.goto("/edicion/alertas");
      const antes = await baseE2E().umbralVersion.count();
      await page.getByLabel("Movimiento del día (%)", { exact: true }).fill("77");
      await page.getByLabel("Motivo del cambio", { exact: true }).fill("Intento fuera de rango");
      await page.getByRole("button", { name: "Guardar la versión", exact: true }).click();
      await expect(page.locator(".edicion-resumen")).toContainText("Movimiento del día (%): Está fuera del rango permitido");
      await expect(page.getByLabel("Movimiento del día (%)", { exact: true })).toHaveAttribute("aria-invalid", "true");
      expect(await baseE2E().umbralVersion.count()).toBe(antes);
    });
  });

  test("a 375 px no se desborda, y en claro y en oscuro los botones y el contador se leen (AA)", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-alertas-movil");
    await marcarTodasPorBase();
    await sembrarAlertas(info);
    await page.setViewportSize(MOVIL);
    for (const esquema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: esquema });
      await page.goto("/alertas");
      await expect(botonesMarcar(page).first()).toBeVisible();
      await expect(contador(page)).toBeVisible();
      expect(await desborde(page), `/alertas ${esquema}`).toBe(0);
      expect(await contraste(botonesMarcar(page)), `Marcar vista ${esquema}`).toBeGreaterThanOrEqual(4.5);
      expect(await contraste(page.getByRole("button", { name: "Marcar todas como vistas", exact: true })), `Marcar todas ${esquema}`).toBeGreaterThanOrEqual(4.5);
      expect(await contraste(contador(page)), `contador ${esquema}`).toBeGreaterThanOrEqual(4.5);
      expect(await contraste(page.locator("main .alerta-texto")), `texto ${esquema}`).toBeGreaterThanOrEqual(4.5);
      await page.goto("/edicion/alertas");
      await expect(page.getByRole("button", { name: "Guardar la versión", exact: true })).toBeEnabled();
      expect(await desborde(page), `/edicion/alertas ${esquema}`).toBe(0);
      expect(await contraste(page.getByRole("button", { name: "Guardar la versión", exact: true })), `Guardar ${esquema}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/** El alta por el camino del comando de Jelk (como tests/e2e/zz-operar-tarifas.spec.ts). */
async function altaDeFamiliar(page: Page, info: TestInfo): Promise<void> {
  const cuenta = { email: `familiar-alertas-${sufijo(info)}@ejemplo.invalid`, clave: "clave-ficticia-familiar-alertas-e2e" };
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

test.describe("la familia ve las alertas pero no marca ni configura", () => {
  // /edicion/alertas le responde 404 y las dos rutas 403 (el navegador lo registra en la consola): es lo que se prueba.
  test.use({ erroresEsperados: [/\/edicion\/alertas|\/api\/alertas\/(vistas|umbrales)$/] });

  test("ve las alertas sin botones; /edicion/alertas le da 404 y sus POST, 403, sin cambiar la base", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    await marcarTodasPorBase();
    const nemo = await sembrarAlertas(info);
    await page.goto("/alertas");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alertas");
    await expect(page.locator("main li.alerta").filter({ hasText: nemo })).toHaveCount(3);
    expect(await page.locator("main").innerText()).toContain(`«${nemo}»: cierre del día (90,5)`);
    // Sin un solo control de escritura: ni botones, ni formularios, ni el enlace a configurar.
    await expect(page.locator("main button, main form, main input")).toHaveCount(0);
    await expect(page.locator('main a[href="/edicion/alertas"]')).toHaveCount(0);
    // Ve el contador (lo que falta por marcar) pero no puede marcar.
    await expect(contador(page)).toHaveText("3");
    expect(prohibidasEn(await page.locator("main").innerText())).toEqual([]);

    expect((await page.goto("/edicion/alertas"))?.status()).toBe(404);
    await page.goto("/alertas");
    const antesVistas = await baseE2E().alertaVista.count();
    const antesUmbrales = await baseE2E().umbralVersion.count();
    const r = await page.evaluate(async () => {
      const post = async (ruta: string, cuerpo: unknown) => {
        const res = await fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
        return { estado: res.status, cuerpo: (await res.json()) as unknown };
      };
      return {
        vista: await post("/api/alertas/vistas", { todas: true }),
        umbral: await post("/api/alertas/umbrales", {
          versionBase: 0, alertaCercaPct: "3", alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: "3", alertaMovimientoActiva: true, alertaCaidaPct: "2",
          alertaCaidaActiva: true, alertaDatoViejoMin: 30, alertaDatoViejoActiva: true, alertaExDiasHabiles: 3, alertaExActiva: true, motivo: "Intento ficticio",
        }),
      };
    });
    expect(r.vista).toEqual({ estado: 403, cuerpo: { error: MENSAJE_SOLO_LECTURA } });
    expect(r.umbral).toEqual({ estado: 403, cuerpo: { error: MENSAJE_SOLO_LECTURA } });
    expect(await baseE2E().alertaVista.count()).toBe(antesVistas);
    expect(await baseE2E().umbralVersion.count()).toBe(antesUmbrales);
  });
});
