/**
 * Ayudas del E2E del login (D-014) y del TOTP: la página de ingreso y la del segundo paso, por rol y nombre
 * accesible, y el ingreso completo (clave → TOTP). Como cada código TOTP entra una sola vez (antireplay),
 * cada prueba que necesita sesión crea su cuenta y la enrola por la interfaz, leyendo la clave base32 de la
 * página; el código se calcula aquí con src/auth/totp. Todo inventado.
 */
import { expect, test as base, type Locator, type Page, type TestInfo } from "@playwright/test";
import { decodificarBase32, hotp, pasoDe } from "../../src/auth/totp";
import type { CuentaE2E } from "./base";
import { baseE2E, crearCuenta } from "./cuentas";

export class PaginaIngreso {
  readonly correo: Locator;
  readonly clave: Locator;
  readonly boton: Locator;
  readonly aviso: Locator;

  private constructor(readonly page: Page) {
    this.correo = page.getByLabel("Correo");
    this.clave = page.getByLabel("Contraseña", { exact: true });
    this.boton = page.getByRole("button", { name: "Ingresar" });
    // Dentro de `main`: el anunciador de rutas de Next también tiene role="alert".
    this.aviso = page.getByRole("main").getByRole("alert");
  }

  /** Abre /ingresar y espera la hidratación: el botón está deshabilitado hasta entonces. */
  static async abrir(page: Page): Promise<PaginaIngreso> {
    await page.goto("/ingresar");
    const p = new PaginaIngreso(page);
    await expect(p.boton).toBeEnabled();
    return p;
  }

  async enviar(cuenta: CuentaE2E): Promise<void> {
    await this.correo.fill(cuenta.email);
    await this.clave.fill(cuenta.clave);
    await this.boton.click();
  }
}

/** El formulario de un código del segundo paso (/totp, /totp/enrolar, /totp/codigos). */
export class PaginaCodigo {
  readonly campo: Locator;
  readonly aviso: Locator;

  constructor(
    readonly page: Page,
    readonly boton: Locator,
  ) {
    this.campo = page.getByRole("textbox", { name: /^Código de/ });
    this.aviso = page.getByRole("main").getByRole("alert");
  }

  static async de(page: Page, nombreBoton: string): Promise<PaginaCodigo> {
    const p = new PaginaCodigo(page, page.getByRole("button", { name: nombreBoton, exact: true }));
    await expect(p.boton).toBeEnabled();
    return p;
  }

  async enviar(codigo: string): Promise<void> {
    await this.campo.fill(codigo);
    await this.boton.click();
  }
}

/** Una cuenta del E2E ya enrolada: su secreto TOTP (leído de la página) y sus códigos de recuperación. */
export interface CuentaConTotp extends CuentaE2E {
  readonly secreto: Buffer;
  readonly codigos: readonly string[];
}

/** Pasa la clave en /ingresar y espera la página del segundo paso que corresponda. */
export async function pasarClave(page: Page, cuenta: CuentaE2E, destino: "/totp" | "/totp/enrolar"): Promise<void> {
  const p = await PaginaIngreso.abrir(page);
  await p.enviar(cuenta);
  await expect(page).toHaveURL(destino);
}

/** En /totp/enrolar: lee la clave base32, activa con el código actual y guarda los 10 códigos. Termina en "/". */
export async function enrolarEnPagina(page: Page, cuenta: CuentaE2E): Promise<CuentaConTotp> {
  await expect(page.getByRole("img", { name: "Código QR para la app autenticadora" })).toBeVisible();
  const base32 = ((await page.locator("[data-clave-totp]").textContent()) ?? "").replace(/\s+/g, "");
  const secreto = decodificarBase32(base32);
  if (!secreto) throw new Error("La página no mostró una clave base32 válida.");
  const p = await PaginaCodigo.de(page, "Activar");
  await p.enviar(hotp(secreto, pasoDe(Date.now())));
  const lista = page.getByRole("list", { name: "Códigos de recuperación" });
  await expect(lista.getByRole("listitem")).toHaveCount(10);
  const codigos = await lista.getByRole("listitem").allTextContents();
  await page.getByRole("link", { name: "Ya los guardé: ir al tablero" }).click();
  await expect(page).toHaveURL("/");
  return { ...cuenta, secreto, codigos };
}

/**
 * El código TOTP que entra ahora: el del paso actual, o el siguiente si el actual ya se usó (antireplay;
 * la ventana es ±1). Si ni el siguiente sirve, espera a que avance el paso.
 */
export async function codigoQueEntra(page: Page, cuenta: CuentaConTotp): Promise<string> {
  const { totpUltimoPaso } = await baseE2E().usuario.findUniqueOrThrow({ where: { email: cuenta.email }, select: { totpUltimoPaso: true } });
  const ultimo = totpUltimoPaso ?? -1;
  while (ultimo + 1 > pasoDe(Date.now()) + 1) await page.waitForTimeout(1000);
  return hotp(cuenta.secreto, Math.max(pasoDe(Date.now()), ultimo + 1));
}

/** Ingreso completo de una cuenta ya enrolada: la clave y el código TOTP. Termina en el tablero. */
export async function entrarConTotp(page: Page, cuenta: CuentaConTotp): Promise<void> {
  await pasarClave(page, cuenta, "/totp");
  const p = await PaginaCodigo.de(page, "Verificar");
  await p.enviar(await codigoQueEntra(page, cuenta));
  await expect(page).toHaveURL("/");
}

/** Crea un dueño ficticio propio de la prueba, entra con su clave y enrola el TOTP. Termina en el tablero. */
export async function iniciarSesion(page: Page, info: TestInfo, prefijo = "sesion"): Promise<CuentaConTotp> {
  const cuenta = await crearCuenta(info, prefijo, true);
  await pasarClave(page, cuenta, "/totp/enrolar");
  return enrolarEnPagina(page, cuenta);
}

/** Hash corto y estable de un texto (FNV-1a, 16 bits). */
function hash16(texto: string): string {
  let h = 0x811c9dc5;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return (h & 0xffff).toString(16);
}

/**
 * Cada prueba (y cada repetición) llega con su propia IP de documentación (RFC 3849), como la pondría
 * Cloudflare en `Cf-Connecting-IP`: así los topes por IP no se arrastran de una prueba a otra.
 */
export const ipDePrueba = (info: TestInfo): string => `2001:db8:${hash16(info.testId)}:${(info.repeatEachIndex * 16 + info.retry).toString(16)}::1`;

/**
 * Además, falla la prueba si el navegador registró errores. Se admiten solo los «Failed to load resource»
 * de las respuestas 4xx esperadas de /api/sesion/* (credenciales malas, código errado, enlace inválido,
 * sin sesión) y lo que cada prueba declare en `erroresEsperados` (una expresión que cuadre con la URL del recurso o con el
 * texto del mensaje: el servidor de desarrollo reenvía sus `console.error` al navegador).
 */
export const test = base.extend<{ consolaLimpia: void; erroresEsperados: RegExp[] }>({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, usar, info) => {
    await usar({ ...extraHTTPHeaders, "cf-connecting-ip": ipDePrueba(info) });
  },
  erroresEsperados: [[], { option: true }],
  consolaLimpia: [
    async ({ page, erroresEsperados }, usar) => {
      const errores: string[] = [];
      page.on("pageerror", (e) => errores.push(e.message));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const url = m.location().url;
        const deSesion = /\/api\/sesion\/[a-z-]+(\/[a-z-]+)?$/.test(url) && /status of 4\d\d/.test(m.text());
        if (!deSesion && !erroresEsperados.some((r) => r.test(url) || r.test(m.text()))) errores.push(`${m.text()} @ ${url}`);
      });
      await usar();
      expect(errores, "errores en la consola del navegador").toEqual([]);
    },
    { auto: true },
  ],
});
