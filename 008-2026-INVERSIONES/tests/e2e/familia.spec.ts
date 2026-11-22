/**
 * E2E de la familia en SOLO LECTURA (frente familia-lectura) contra la base e2e sembrada (tests/e2e/sembrar.ts):
 *  - un familiar ficticio dado de alta por el camino real (emitirAccesoFamiliar, el mismo del comando de Jelk) define su
 *    clave con el enlace, enrola su TOTP y ve las cinco pantallas con «Solo lectura», sin formularios que escriban;
 *  - el simulador de Proyecciones le calcula (200) y nada del portafolio cambia en la base durante toda su visita;
 *  - revocado, su siguiente pedido lo lleva a /ingresar y la API le responde 401;
 *  - el dueño entra igual y no ve «Solo lectura».
 * Cada prueba crea su cuenta (correo único) y llega con su propia IP. Correos y contraseñas inventados.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { emitirAccesoFamiliar, revocarFamiliar } from "../../src/auth/familia";
import { baseE2E, cerrarBaseE2E, sufijo } from "./cuentas";
import { PaginaProyecciones } from "./pagina-proyecciones";
import { enrolarEnPagina, iniciarSesion, pasarClave, test, type CuentaConTotp } from "./sesion";

const PANTALLAS = [
  { ruta: "/", titulo: /¿Gano\?/ },
  { ruta: "/plan", titulo: /./ },
  { ruta: "/decisiones", titulo: "Diario de decisiones" },
  { ruta: "/conciliacion", titulo: /./ },
  { ruta: "/proyecciones", titulo: "Proyecciones" },
] as const;

test.afterAll(async () => {
  await cerrarBaseE2E();
});

/** El alta por el camino del comando de Jelk: enlace de un solo uso → clave propia → primer ingreso → TOTP propio. */
async function altaDeFamiliar(page: Page, info: TestInfo): Promise<CuentaConTotp> {
  const cuenta = { email: `familiar-${sufijo(info)}@ejemplo.invalid`, clave: "clave-ficticia-familiar-e2e" };
  const { token } = await emitirAccesoFamiliar(baseE2E(), { email: cuenta.email, ahora: new Date() });
  await page.goto("about:blank");
  await page.goto(`/definir-clave#t=${token}&u=${encodeURIComponent(cuenta.email)}`);
  await page.getByLabel("Contraseña nueva").fill(cuenta.clave);
  await page.getByLabel("Repita la contraseña").fill(cuenta.clave);
  await page.getByRole("button", { name: "Definir contraseña" }).click();
  await expect(page.getByRole("status")).toContainText("Contraseña definida");
  await pasarClave(page, cuenta, "/totp/enrolar");
  return enrolarEnPagina(page, cuenta);
}

/** Conteos de las tablas del portafolio: lo que una visita de solo lectura nunca debe cambiar. */
async function fotoDelPortafolio(): Promise<Record<string, number>> {
  const db = baseE2E();
  const [planes, reglas, decisiones, ordenes, lotes, cierres, certificaciones, conciliaciones, fondos, cargas] = await Promise.all([
    db.planVersion.count(),
    db.reglaPlan.count(),
    db.decision.count(),
    db.orden.count(),
    db.lote.count(),
    db.precioCierre.count(),
    db.certificacion.count(),
    db.conciliacion.count(),
    db.movimientoFondo.count(),
    db.cargaArchivo.count(),
  ]);
  return { planes, reglas, decisiones, ordenes, lotes, cierres, certificaciones, conciliaciones, fondos, cargas };
}

async function verPantallas(page: Page, soloLectura: boolean): Promise<void> {
  for (const p of PANTALLAS) {
    await page.goto(p.ruta);
    await expect(page).toHaveURL(p.ruta);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(p.titulo);
    const marca = page.locator("header .solo-lectura");
    if (soloLectura) await expect(marca, p.ruta).toHaveText("Solo lectura");
    else await expect(marca, p.ruta).toHaveCount(0);
    // Ninguna pantalla de lectura le ofrece un formulario que mande algo al servidor.
    await expect(page.locator('form[method="post"], form[action]'), p.ruta).toHaveCount(0);
  }
}

test.describe("la familia, en solo lectura", () => {
  test("un familiar dado de alta con el enlace entra con su clave y su TOTP y ve las cinco pantallas en «Solo lectura»", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    await expect(page).toHaveURL("/");
    await verPantallas(page, true);
  });

  test("el simulador le calcula (200) y nada del portafolio cambia en la base durante su visita", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    const antes = await fotoDelPortafolio();
    await verPantallas(page, true);
    const p = await PaginaProyecciones.abrir(page, info);
    const respuesta = page.waitForResponse((r) => r.url().endsWith("/api/proyecciones") && r.request().method() === "POST");
    await p.botonHorizonte("10 años").click();
    expect((await respuesta).status()).toBe(200);
    await p.esperarCalculo();
    expect(await fotoDelPortafolio()).toEqual(antes);
  });

  test("revocado, su siguiente pedido lo lleva a /ingresar y la API le responde 401", async ({ page }, info) => {
    const cuenta = await altaDeFamiliar(page, info);
    await revocarFamiliar(baseE2E(), { email: cuenta.email, ahora: new Date() });
    await page.goto("/plan");
    await expect(page).toHaveURL("/ingresar");
    const r = await page.request.post("/api/proyecciones", {
      data: { horizonteMeses: 36, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0 },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(r.status()).toBe(401);
  });
});

test.describe("el dueño no cambia", () => {
  test("entra como siempre y no ve «Solo lectura» en ninguna pantalla", async ({ page }, info) => {
    await iniciarSesion(page, info, "dueno-familia");
    await verPantallas(page, false);
  });
});
