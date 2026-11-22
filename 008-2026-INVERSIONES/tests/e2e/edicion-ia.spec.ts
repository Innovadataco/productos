/**
 * E2E de /edicion/ia (E8) contra la base e2e sembrada, con la app corriendo (`next dev` en el 5008):
 *  - Jelk guarda una versión (la nube con su tope, la dirección del Ollama inventada) y la ve en la historia;
 *  - la nube sin tope no se puede guardar (el campo queda marcado y la base no cambia);
 *  - el estado de las puertas: la local sin la lista de PI (el e2e no la tiene), la sonda y los candados «por verificar»;
 *    «Identificar modelos» usa solo lo guardado y, sin el servicio de IA, dice que la conexión la hace ese servicio
 *    (pendiente): ningún pedido sale a la red;
 *  - a 375 px no hay desborde, y en claro y en oscuro el botón principal se lee (AA);
 *  - un familiar recibe 404 en la página y 403 en las dos API, sin cambiar la base.
 * ESCRIBE en la base e2e solo config_ia (nada que lean las otras pantallas). Datos e IP inventados (la IP se arma al correr).
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { emitirAccesoFamiliar } from "../../src/auth/familia";
import { MENSAJE_SOLO_LECTURA } from "../../src/auth/respuestas";
import { baseE2E, cerrarBaseE2E, sufijo } from "./cuentas";
import { enrolarEnPagina, iniciarSesion, pasarClave, test } from "./sesion";

const MOVIL = { width: 375, height: 812 };
const ip = (...o: readonly number[]): string => o.join(".");
const HOST = ip(100, 87, 41, 157);

test.afterAll(async () => {
  await cerrarBaseE2E();
});

const contar = () => baseE2E().configIa.count();
const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
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

test.describe("el dueño configura la IA", () => {
  // La nube sin tope responde 400 a propósito (el navegador lo registra en la consola).
  test.use({ erroresEsperados: [/\/api\/ia\/config$/] });

  test("la nube sin tope no se guarda; con tope sí, y queda en la historia; identificar usa lo guardado y dice que la conexión es del servicio", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-ia");
    await page.goto("/edicion/plan");
    await page.getByRole("link", { name: "Configuración de la IA", exact: true }).click();
    await expect(page).toHaveURL("/edicion/ia");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Configuración de la IA");
    await expect(page.getByText("Encender la nube tiene costo y envía a Anthropic los hechos ciegos (sin cifras, especies ni cuentas).")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar la versión nueva", exact: true })).toBeEnabled();

    const antes = await contar();
    await page.getByLabel("Modo", { exact: true }).selectOption({ label: "Solo la nube (Claude)" });
    await page.getByLabel("Tope mensual de la nube (USD)", { exact: true }).fill("");
    await page.getByLabel("Motivo del cambio", { exact: true }).fill("Intento ficticio sin tope (e2e)");
    await page.getByRole("button", { name: "Guardar la versión nueva", exact: true }).click();
    await expect(page.locator(".edicion-resumen")).toContainText("Con la nube, el tope mensual es obligatorio");
    await expect(page.getByLabel("Tope mensual de la nube (USD)", { exact: true })).toHaveAttribute("aria-invalid", "true");
    expect(await contar()).toBe(antes);

    await page.getByLabel("Tope mensual de la nube (USD)", { exact: true }).fill("4,61");
    await page.getByLabel("Dirección del Ollama", { exact: true }).fill(HOST);
    await page.getByLabel("Puerto", { exact: true }).fill("47213");
    await page.getByLabel("Motivo del cambio", { exact: true }).fill("Nube con tope ficticio (e2e)");
    await page.getByRole("button", { name: "Guardar la versión nueva", exact: true }).click();
    await expect(page).toHaveURL(/\/edicion\/ia\?guardada=\d+$/);
    await expect(page.getByRole("status").filter({ hasText: /^Se guardó la versión \d+\.$/ })).toBeVisible();
    await expect(page.locator('[aria-labelledby="t-historia"]')).toContainText("Nube con tope ficticio (e2e)");
    expect(await contar()).toBe(antes + 1);
    const ultima = await baseE2E().configIa.findFirstOrThrow({ orderBy: { version: "desc" } });
    expect({ modo: ultima.modo, tope: ultima.topeMensualUsd?.toString(), host: ultima.ollamaHost }).toEqual({ modo: "nube", tope: "4.61", host: HOST });

    // El estado de las puertas: la local sin la lista de PI; lo que la app no puede saber, «por verificar».
    const puertas = page.locator('[aria-labelledby="t-puertas"]');
    await expect(puertas).toContainText("Falta la lista de modelos de PI");
    await expect(puertas).toContainText("Por verificar");
    await expect(puertas).toContainText("Tope mensual: El tope mensual está guardado.");

    // Identificar: con lo guardado; sin el servicio de IA, la sonda pendiente (sin red).
    const pedidos: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/api/ia/ollama")) pedidos.push(r.postData() ?? ""); });
    await page.getByRole("button", { name: "Identificar modelos", exact: true }).click();
    await expect(page.locator(".ia-sonda")).toHaveText("Desde el servidor, la conexión la hace el servicio de IA (pendiente).");
    expect(pedidos).toEqual([JSON.stringify({ accion: "identificar" })]);
  });

  test("a 375 px no se desborda, y en claro y en oscuro el botón principal se lee (AA)", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-ia-movil");
    await page.setViewportSize(MOVIL);
    for (const esquema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: esquema });
      await page.goto("/edicion/ia");
      await expect(page.getByRole("button", { name: "Guardar la versión nueva", exact: true })).toBeEnabled();
      expect(await desborde(page), esquema).toBe(0);
      expect(await contrasteDelBoton(page, "Guardar la versión nueva"), esquema).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/** El alta por el camino del comando de Jelk (como zz-edicion.spec.ts). */
async function altaDeFamiliar(page: Page, info: TestInfo): Promise<void> {
  const cuenta = { email: `familiar-ia-${sufijo(info)}@ejemplo.invalid`, clave: "clave-ficticia-familiar-ia-e2e" };
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

test.describe("la familia no configura la IA", () => {
  test.use({ erroresEsperados: [/\/edicion\/ia|\/api\/ia\/(config|ollama)$/] });

  test("la página le da 404 y las dos API 403 «Solo lectura», sin cambiar la base", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    const antes = await contar();
    expect((await page.goto("/edicion/ia"))?.status()).toBe(404);
    for (const [ruta, cuerpo] of [["/api/ia/config", { modo: "nube" }], ["/api/ia/ollama", { accion: "identificar" }]] as const) {
      const r = await page.evaluate(async ({ ruta: url, cuerpo: datos }) => {
        const respuesta = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
        return { estado: respuesta.status, cuerpo: (await respuesta.json()) as unknown };
      }, { ruta, cuerpo });
      expect(r.estado, ruta).toBe(403);
      expect(r.cuerpo, ruta).toEqual({ error: MENSAJE_SOLO_LECTURA });
    }
    expect(await contar()).toBe(antes);
  });
});
