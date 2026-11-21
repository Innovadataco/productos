/** Ayudas del E2E del login (D-014): la página de ingreso, por rol y nombre accesible. */
import { expect, test as base, type Locator, type Page, type TestInfo } from "@playwright/test";
import type { CuentaE2E } from "./base";

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

/** Inicia sesión y espera el tablero. */
export async function iniciarSesion(page: Page, cuenta: CuentaE2E): Promise<void> {
  const p = await PaginaIngreso.abrir(page);
  await p.enviar(cuenta);
  await expect(page).toHaveURL("/");
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
 * de las respuestas 4xx esperadas de /api/sesion/* (credenciales malas, enlace inválido, sin sesión).
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
        const deSesion = /\/api\/sesion\/[a-z-]+$/.test(url) && /status of 4\d\d/.test(m.text());
        if (!deSesion && !erroresEsperados.some((r) => r.test(url))) errores.push(`${m.text()} @ ${url}`);
      });
      await usar();
      expect(errores, "errores en la consola del navegador").toEqual([]);
    },
    { auto: true },
  ],
});
