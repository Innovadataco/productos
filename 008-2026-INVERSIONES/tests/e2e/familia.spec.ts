/**
 * E2E de la familia en SOLO LECTURA (frente familia-lectura) contra la base e2e sembrada (tests/e2e/sembrar.ts):
 *  - un familiar ficticio dado de alta por el camino real (emitirAccesoFamiliar, el mismo del comando de Jelk) define su
 *    clave con el enlace, enrola su TOTP y ve las cinco pantallas con «Solo lectura»;
 *  - durante su visita (las cinco pantallas y el simulador de Proyecciones, que le calcula con 200), el navegador no hace
 *    ningún pedido que no sea GET salvo el cálculo del simulador, ninguna pantalla trae un formulario con method o action,
 *    y la HUELLA de la base (el contenido de cada tabla fuera de las de autenticación, no solo sus conteos) no cambia;
 *  - revocado, su siguiente pedido lo lleva a /ingresar y la API le responde 401;
 *  - el dueño entra igual y no ve «Solo lectura».
 * Las rutas web de escritura del área de edición (fase B) y su 403 para la familia se prueban de punta a punta en
 * tests/e2e/zz-edicion.spec.ts; el guardián, en integración (tests/integracion/auth-familia-guardian.test.ts).
 * Cada prueba crea su cuenta (correo único) y llega con su propia IP.
 * Correos y contraseñas inventados.
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
  { ruta: "/analisis", titulo: "Análisis del portafolio" },
] as const;
/** Las tablas del login y del TOTP: las únicas que una visita puede tocar (intentos, pre-sesión, último paso). */
const TABLAS_DE_AUTENTICACION = new Set(["usuario", "intento_ingreso", "token_acceso", "codigo_recuperacion", "_prisma_migrations"]);
const CALCULO = "/api/proyecciones";

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

/**
 * La huella de la base: el md5 del contenido de cada tabla de public fuera de las de autenticación, en orden estable,
 * y, de las cuentas, lo que una visita nunca cambia (rol, activo, clave): el login sí escribe intentos, la pre-sesión y
 * el último paso del TOTP, pero nunca el rol ni el estado de una cuenta (revisión e2e-runner).
 */
async function huellaDeLaBase(): Promise<Record<string, string>> {
  const db = baseE2E();
  const cuentas = await db.$queryRaw<{ h: string }[]>`
    SELECT md5(coalesce(string_agg(concat_ws(':', "id", "rol"::text, "activo"::text, coalesce("claveHash", '-')), '|' ORDER BY "id"), '')) AS h FROM "usuario"`;
  const tablas = await db.$queryRaw<{ nombre: string }[]>`
    SELECT table_name::text AS nombre FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`;
  const huellas = await Promise.all(
    tablas
      .map((t) => t.nombre)
      .filter((nombre) => !TABLAS_DE_AUTENTICACION.has(nombre) && /^[a-z_]+$/.test(nombre))
      // El nombre sale del catálogo y pasa por la forma [a-z_]: se puede citar sin riesgo.
      .map(async (nombre) => {
        const filas = await db.$queryRawUnsafe<{ h: string | null }[]>(`SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS h FROM "${nombre}" t`);
        return [nombre, filas[0]?.h ?? ""] as const;
      }),
  );
  return { ...Object.fromEntries(huellas), "usuario (rol, activo, clave)": cuentas[0]?.h ?? "" };
}

/** Los pedidos del navegador que no son GET ni HEAD (lo que podría escribir), con su ruta. */
function vigilarPedidos(page: Page): string[] {
  const vistos: string[] = [];
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())) vistos.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return vistos;
}

async function verPantallas(page: Page, soloLectura: boolean): Promise<void> {
  for (const p of PANTALLAS) {
    await page.goto(p.ruta);
    await expect(page).toHaveURL(p.ruta);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(p.titulo);
    const marca = page.locator("header .solo-lectura");
    if (soloLectura) await expect(marca, p.ruta).toHaveText("Solo lectura");
    else await expect(marca, p.ruta).toHaveCount(0);
    await expect(page.locator('form[method], form[action]'), `${p.ruta}: ningún formulario con method o action`).toHaveCount(0);
  }
}

test.describe("la familia, en solo lectura", () => {
  test("un familiar dado de alta con el enlace entra con su clave y su TOTP y ve las cinco pantallas en «Solo lectura»", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    await expect(page).toHaveURL("/");
    const antes = await huellaDeLaBase();
    const pedidos = vigilarPedidos(page);
    await verPantallas(page, true);
    expect(pedidos, "pedidos que no son GET durante la visita").toEqual([]);
    expect(await huellaDeLaBase()).toEqual(antes);
  });

  test("el simulador le calcula (200), no hay otros pedidos de escritura y la huella de la base no cambia", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    const antes = await huellaDeLaBase();
    expect(Object.keys(antes).length).toBeGreaterThan(10);
    const pedidos = vigilarPedidos(page);
    await verPantallas(page, true);
    const p = await PaginaProyecciones.abrir(page, info);
    const respuesta = page.waitForResponse((r) => r.url().endsWith(CALCULO) && r.request().method() === "POST");
    await p.botonHorizonte("10 años").click();
    expect((await respuesta).status()).toBe(200);
    await p.esperarCalculo();
    expect(pedidos.filter((x) => x !== `POST ${CALCULO}`), "pedidos que no son GET, fuera del cálculo").toEqual([]);
    expect(pedidos).toContain(`POST ${CALCULO}`);
    expect(await huellaDeLaBase()).toEqual(antes);
  });

  test("revocado, su siguiente pedido lo lleva a /ingresar y la API le responde 401", async ({ page }, info) => {
    const cuenta = await altaDeFamiliar(page, info);
    await revocarFamiliar(baseE2E(), { email: cuenta.email, ahora: new Date() });
    await page.goto("/plan");
    await expect(page).toHaveURL("/ingresar");
    const r = await page.request.post(CALCULO, {
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
