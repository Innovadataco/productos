/**
 * E2E de /datos-oficiales (frente datos-oficiales-pantalla, C6a) contra la base e2e: tests/e2e/sembrar.ts más las
 * series inventadas de tests/e2e/sembrar-datos-oficiales.ts, con fechas relativas al «hoy» de la corrida (la app usa la
 * fecha real de Colombia). Cubre:
 *  - la navegación desde el tablero; las cuatro series con su cifra, su vigencia («Vale hoy» solo la que cubre hoy), su
 *    frescura en texto (al día y atrasada), su fuente con enlace https y la variación del IPC «calculada por Inversiones»;
 *  - cada gráfica: con el teclado, el deslizador dice el último valor; «Ver los datos» abre su tabla;
 *  - sin sesión lleva a /ingresar;
 *  - un familiar la ve en «Solo lectura»: el navegador no hace ningún pedido que no sea GET, no hay formularios y la
 *    HUELLA de la base (el contenido de cada tabla fuera de las de autenticación) no cambia (como familia.spec.ts);
 *  - «reducir movimiento»: nada se anima; claro y oscuro, en escritorio y a 375 px sin desborde.
 * La sección de dividendos decretados (frente datos-oficiales-decretos-pantalla, C6b), con los decretos inventados de
 * sembrar-datos-oficiales.ts (DECRETOS_E2E): los próximos con su referencia (enlace solo si es https de la SFC o la BVC;
 * el radicado, texto) y el bruto estimado (o «no se estima»), el cruce con su estado y su motivo, la «diferencia bruto −
 * neto» y nunca «retención»; a 375 px cada tabla se desplaza dentro de su región, que se enfoca con el teclado.
 * Capturas solo con CAPTURAS_DATOS_OFICIALES (carpeta absoluta fuera del repo). Correos y contraseñas inventados.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { emitirAccesoFamiliar } from "../../src/auth/familia";
import { baseE2E, cerrarBaseE2E, sufijo } from "./cuentas";
import { PaginaDatosOficiales, SERIES, TITULOS_GRAFICAS } from "./pagina-datos-oficiales";
import { PaginaTablero } from "./pagina-tablero";
import { ESPERADO } from "./sembrar-datos-oficiales";
import { enrolarEnPagina, pasarClave, test } from "./sesion";

const ANCHO_CELULAR = { width: 375, height: 812 };
const PIE = "Inversiones informa; no recomienda comprar ni vender.";
const HOSTS = new Set(["www.datos.gov.co", "suameca.banrep.gov.co", "www.dane.gov.co"]);
/** Las referencias oficiales de los decretos (la condición de C1). */
const HOSTS_REFERENCIAS = new Set(["www.superfinanciera.gov.co", "www.bvc.com.co"]);
/** Las tablas del login y del TOTP: las únicas que una visita puede tocar (intentos, pre-sesión, último paso). */
const TABLAS_DE_AUTENTICACION = new Set(["usuario", "intento_ingreso", "token_acceso", "codigo_recuperacion", "_prisma_migrations"]);

test.afterAll(async () => {
  await cerrarBaseE2E();
});

/** El alta de un familiar por el camino del comando de Jelk (como familia.spec.ts): enlace → clave → TOTP propio. */
async function altaDeFamiliar(page: Page, info: TestInfo): Promise<void> {
  const cuenta = { email: `familiar-do-${sufijo(info)}@ejemplo.invalid`, clave: "clave-ficticia-familiar-do-e2e" };
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

/** El md5 del contenido de cada tabla fuera de las de autenticación, y de las cuentas, lo que una visita nunca cambia. */
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

test.describe("pantalla de datos oficiales", () => {
  test("desde el tablero: las cuatro series con su cifra, su vigencia, su frescura, su fuente y la variación del IPC", async ({ page }, info) => {
    const t = await PaginaTablero.abrir(page, info);
    await t.cabecera.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Datos oficiales", exact: true }).click();
    await expect(page).toHaveURL("/datos-oficiales");
    const p = await PaginaDatosOficiales.abrir(page, info);
    await expect(page.locator(".do-hero .eyebrow")).toHaveText(/^Consultado el \d{1,2}-[a-z]{3}-\d{4} \(hora de Colombia\)$/);

    const trm = p.tarjeta("Tasa Representativa del Mercado");
    await expect(trm.locator(".do-estado-texto")).toHaveText("Al día");
    await expect(trm.locator(".do-cifra")).toHaveText(ESPERADO.trm);
    await expect(trm.locator(".do-vigencia")).toHaveText(/^Vale hoy · vigente del /);

    const tpm = p.tarjeta("Tasa de política monetaria");
    await expect(tpm.locator(".do-estado-texto")).toHaveText("Al día");
    await expect(tpm.locator(".do-cifra")).toHaveText(ESPERADO.tpm);
    await expect(tpm.locator(".do-vigencia")).toHaveText(/^No es la cifra de hoy · vigente el /);
    await expect(tpm).not.toContainText("Vale hoy");

    const ibr = p.tarjeta("IBR a 3 meses, efectiva anual");
    await expect(ibr.locator(".do-estado-texto")).toHaveText("Atrasada");
    await expect(ibr.locator(".do-cifra")).toHaveText(ESPERADO.ibr);
    await expect(ibr).toContainText(/Terminó hace 1[01] días; se marca atrasada desde 7 días\./);

    const ipc = p.tarjeta("Índice de precios al consumidor");
    await expect(ipc.locator(".do-estado-texto")).toHaveText("Al día");
    await expect(ipc.locator(".do-cifra")).toHaveText(ESPERADO.ipc);
    await expect(ipc.locator(".do-vigencia")).toHaveText(/^No es la cifra de hoy · corresponde a [a-z]{3}-\d{4}$/);
    await expect(ipc.locator(".do-variacion")).toHaveText(`Variación en 12 meses ${ESPERADO.variacionIpc} % de variación (calculada por Inversiones)`);

    const enlaces = page.locator(".do-series").getByRole("link");
    await expect(enlaces).toHaveCount(SERIES.length);
    for (const a of await enlaces.all()) {
      const href = new URL((await a.getAttribute("href")) ?? "");
      expect(href.protocol).toBe("https:");
      expect(HOSTS.has(href.hostname), href.hostname).toBe(true);
      expect(((await a.getAttribute("rel")) ?? "").split(" ").sort()).toEqual(["noopener", "noreferrer"]);
      expect(await a.getAttribute("target")).toBeNull();
    }
    await expect(page.locator("footer.pie")).toHaveText(PIE);
  });

  test("los dividendos decretados: próximos con su referencia y su bruto, y el cruce con su estado y su motivo", async ({ page }, info) => {
    const p = await PaginaDatosOficiales.abrir(page, info);
    await expect(p.decretos.getByRole("heading", { level: 2 })).toHaveText("Dividendos decretados");

    const proximos = p.tablaDecretos("Próximos ex-dividendos");
    await expect(proximos.getByRole("columnheader")).toHaveText(["Especie", "Decreto", "Valor por acción", "Fecha ex", "Fecha de pago", "Tenencia", "Bruto estimado", "Referencia oficial"]);
    // Por fecha ex: FICTE (hoy + 2), FICTD (hoy + 12) y FICTI (hoy + 20).
    await expect(proximos.getByRole("rowheader")).toHaveText(["FICTE", "FICTD", "FICTI"]);
    const fictd = p.filaDecretos(proximos, "FICTD");
    await expect(fictd).toContainText("Ordinario · cuota 2");
    await expect(fictd).toContainText("$ 37,91");
    await expect(fictd).toContainText("0 acciones");
    await expect(fictd.getByRole("link", { name: "Referencia oficial de FICTD, ordinario cuota 2 (sitio externo)" })).toHaveAttribute("href", "https://www.bvc.com.co/ficticio/e2e-c6b-fictd-2");
    const ficte = p.filaDecretos(proximos, "FICTE");
    await expect(ficte).toContainText("Radicado SFC FICTICIO-E2E-4617");
    await expect(ficte.getByRole("link")).toHaveCount(0);
    await expect(p.filaDecretos(proximos, "FICTI")).toContainText("No se estima: la tenencia sale negativa (faltan órdenes cargadas).");

    const cruce = p.tablaDecretos("Cruce con lo recibido de Trii");
    await expect(cruce.getByRole("columnheader")).toHaveText([
      "Especie", "Fecha de pago", "Decretos", "Bruto esperado (estimado)", "Neto de Trii", "Diferencia bruto − neto", "Estado", "Por qué",
    ]);
    // Lo más reciente primero: FICTE (pago hoy + 5) y FICTI (pago hoy − 23). FICTD, sin acciones antes de la ex, va aparte.
    await expect(cruce.getByRole("rowheader")).toHaveText(["FICTE", "FICTI"]);
    await expect(p.filaDecretos(cruce, "FICTE").locator(".do-cruce-estado-texto")).toHaveText("Pendiente");
    const ficti = p.filaDecretos(cruce, "FICTI");
    await expect(ficti.locator(".do-cruce-estado-texto")).toHaveText("Revisar");
    await expect(ficti).toContainText("La tenencia antes de la ex sale negativa");
    await expect(ficti).toContainText("× −10 acciones = −$ 174,30");
    await expect(p.decretos.locator(".do-sin-tenencia")).toHaveText("1 decreto con fecha ex pasada no esperaba pago: no había acciones de la especie antes de la ex.");

    const enlaces = p.decretos.getByRole("link");
    expect(await enlaces.count()).toBeGreaterThan(0);
    for (const a of await enlaces.all()) {
      const href = new URL((await a.getAttribute("href")) ?? "");
      expect(href.protocol).toBe("https:");
      expect(HOSTS_REFERENCIAS.has(href.hostname), href.hostname).toBe(true);
      expect(((await a.getAttribute("rel")) ?? "").split(" ").sort()).toEqual(["noopener", "noreferrer"]);
      expect(await a.getAttribute("target")).toBeNull();
    }
    expect(await page.content()).not.toMatch(/retenci[oó]n/i);
    // El glosario para la familia; en escritorio, la pista de deslizar la tabla no se muestra.
    await expect(p.decretos.locator("dl.do-glosario dt")).toHaveText(["Fecha ex", "Tenencia", "Bruto", "Neto", "Cuota", "Revisar"]);
    await expect(p.decretos.locator(".do-desliza").first()).toBeHidden();
    await expect(page.locator("footer.pie")).toHaveText(PIE);
  });

  test("cada gráfica: con el teclado el deslizador dice el último valor, y «Ver los datos» abre su tabla", async ({ page }, info) => {
    const p = await PaginaDatosOficiales.abrir(page, info);
    const ultimo: Readonly<Record<string, RegExp>> = {
      [TITULOS_GRAFICAS[0]]: new RegExp(` · ${ESPERADO.trm} Tasa Representativa del Mercado · Vigente hasta el `),
      [TITULOS_GRAFICAS[1]]: new RegExp(` · ${ESPERADO.tpm} % Tasa de política monetaria$`),
      [TITULOS_GRAFICAS[2]]: new RegExp(` · ${ESPERADO.ibr} % IBR a 3 meses, efectiva anual$`),
      [TITULOS_GRAFICAS[3]]: new RegExp(`^[a-z]{3}-\\d{4} · ${ESPERADO.ipc} Índice de precios al consumidor$`),
    };
    for (const titulo of TITULOS_GRAFICAS) {
      await p.mira(titulo).focus();
      await page.keyboard.press("End");
      await expect(p.mira(titulo)).toHaveAttribute("aria-valuetext", ultimo[titulo]!);
    }
    const figura = p.figura(TITULOS_GRAFICAS[3]);
    await figura.getByText("Ver los datos").click();
    const tabla = figura.getByRole("table", { name: TITULOS_GRAFICAS[3] });
    await expect(tabla).toBeVisible();
    await expect(tabla.getByRole("row").last()).toContainText(ESPERADO.ipc);
  });

  test("sin sesión, /datos-oficiales lleva a /ingresar", async ({ page }) => {
    await page.goto("/datos-oficiales");
    await expect(page).toHaveURL("/ingresar");
  });

  test("un familiar la ve en «Solo lectura»: sin pedidos que no sean GET, sin formularios, y la base no cambia", async ({ page }, info) => {
    await altaDeFamiliar(page, info);
    const antes = await huellaDeLaBase();
    expect(Object.keys(antes)).toContain("valor_serie_oficial");
    const pedidos: string[] = [];
    page.on("request", (r) => { if (!["GET", "HEAD"].includes(r.method())) pedidos.push(`${r.method()} ${new URL(r.url()).pathname}`); });
    const p = await PaginaDatosOficiales.abrir(page, info);
    await expect(page.locator("header .solo-lectura")).toHaveText("Solo lectura");
    // En la página (el encabezado y el contenido): `next dev` agrega su propio botón de herramientas fuera de ellos.
    await expect(page.locator("header, main").locator("form, button, input, select, textarea")).toHaveCount(0);
    await p.mira(TITULOS_GRAFICAS[0]).focus();
    await page.keyboard.press("Home");
    await p.figura(TITULOS_GRAFICAS[0]).getByText("Ver los datos").click();
    expect(pedidos, "pedidos que no son GET durante la visita").toEqual([]);
    expect(await huellaDeLaBase()).toEqual(antes);
  });

  test.describe("con «reducir movimiento»", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nada se anima: el trazo sale entero al entrar en pantalla", async ({ page }, info) => {
      const p = await PaginaDatosOficiales.abrir(page, info);
      const figura = p.figura(TITULOS_GRAFICAS[3]);
      await figura.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      const d1 = await figura.locator("path.g-linea").getAttribute("d");
      await page.waitForTimeout(120);
      expect(await figura.locator("path.g-linea").getAttribute("d")).toBe(d1);
    });
  });

  for (const tema of ["light", "dark"] as const) {
    const nombre = tema === "light" ? "claro" : "oscuro";

    test.describe(`escritorio · ${nombre}`, () => {
      test.use({ colorScheme: tema });

      test("se dibujan todas y se captura", async ({ page }, info) => {
        const p = await PaginaDatosOficiales.abrir(page, info);
        await p.dibujarTodas();
        await p.capturar(`datos-oficiales-escritorio-${nombre}`);
        await p.decretos.scrollIntoViewIfNeeded();
        await p.capturarElemento(p.decretos, `decretos-escritorio-${nombre}`);
      });
    });

    test.describe(`a 375 px · ${nombre}`, () => {
      test.use({ viewport: ANCHO_CELULAR, colorScheme: tema });

      test("sin desborde horizontal: cada tarjeta y su gráfica caben en el ancho", async ({ page }, info) => {
        const p = await PaginaDatosOficiales.abrir(page, info);
        await p.dibujarTodas();
        await expect.poll(() => p.desbordeHorizontal()).toBeLessThanOrEqual(0);
        for (const s of SERIES) expect((await p.tarjeta(s).boundingBox())!.width, s).toBeLessThanOrEqual(ANCHO_CELULAR.width);
        for (const t of TITULOS_GRAFICAS) expect((await p.figura(t).boundingBox())!.width, t).toBeLessThanOrEqual(ANCHO_CELULAR.width);
        // Las tablas de los decretos: la región cabe en el ancho y la tabla se desplaza dentro de ella.
        for (const nombreTabla of ["Próximos ex-dividendos", "Cruce con lo recibido de Trii"] as const) {
          const region = p.regionDecretos(nombreTabla);
          expect((await region.boundingBox())!.width, nombreTabla).toBeLessThanOrEqual(ANCHO_CELULAR.width);
          expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth), nombreTabla).toBe(true);
          await expect(region).toHaveAttribute("tabindex", "0");
        }
        await p.capturar(`datos-oficiales-375-${nombre}`);
        await p.decretos.scrollIntoViewIfNeeded();
        await p.capturarElemento(p.decretos, `decretos-375-${nombre}`);
      });

      test("con el teclado, la región de una tabla de los decretos se enfoca y se desplaza con las flechas", async ({ page }, info) => {
        const p = await PaginaDatosOficiales.abrir(page, info);
        const region = p.regionDecretos("Cruce con lo recibido de Trii");
        await expect(p.decretos.locator(".do-desliza").first()).toBeVisible();
        await region.focus();
        await expect(region).toBeFocused();
        const antes = await region.evaluate((el) => el.scrollLeft);
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(antes);
        // La especie queda fija al desplazar: su celda sigue dentro de la región (revisión a11y-architect, MEDIO).
        await region.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        const caja = (await region.boundingBox())!;
        const especie = (await p.tablaDecretos("Cruce con lo recibido de Trii").getByRole("rowheader").first().boundingBox())!;
        expect(especie.x).toBeGreaterThanOrEqual(caja.x - 1);
      });

      test("con Mayús+Tab hacia arriba, nada de lo enfocado queda bajo el encabezado fijo (WCAG 2.4.11)", async ({ page }, info) => {
        await PaginaDatosOficiales.abrir(page, info);
        // Desde lo último que se enfoca en la página (la sección de decretos, C6b) hacia arriba.
        await page.getByRole("main").locator('a, summary, [tabindex="0"]').last().focus();
        const vistos: string[] = [];
        for (let k = 0; k < 40; k += 1) {
          await page.keyboard.press("Shift+Tab");
          const r = await page.evaluate(() => {
            const el = document.activeElement;
            const main = document.querySelector("main");
            const header = document.querySelector("header.top");
            if (!el || !main?.contains(el) || !header) return null;
            return { arriba: el.getBoundingClientRect().top, encabezado: header.getBoundingClientRect().bottom, texto: (el.textContent ?? "").slice(0, 40) };
          });
          if (r === null) break;
          vistos.push(r.texto);
          expect(r.arriba, `«${r.texto}» queda bajo el encabezado`).toBeGreaterThanOrEqual(r.encabezado - 1);
        }
        expect(vistos.length).toBeGreaterThan(8);
      });
    });
  }
});
