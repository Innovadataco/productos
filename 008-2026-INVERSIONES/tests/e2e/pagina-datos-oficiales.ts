/** La pantalla /datos-oficiales para el E2E (frente datos-oficiales-pantalla, C6a): localizadores por rol y nombre accesible. */
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { iniciarSesion } from "./sesion";

/** Los nombres de las series (títulos de las tarjetas), en el orden de la pantalla. */
export const SERIES = ["Tasa Representativa del Mercado", "Tasa de política monetaria", "IBR a 3 meses, efectiva anual", "Índice de precios al consumidor"] as const;
export type NombreSerie = (typeof SERIES)[number];
export const TITULOS_GRAFICAS = [
  "Tasa Representativa del Mercado, último año", "Tasa de política monetaria, último año", "IBR a 3 meses, efectiva anual, último año",
  "Índice de precios al consumidor, últimos cinco años",
] as const;

export class PaginaDatosOficiales {
  readonly titulo: Locator;

  private constructor(readonly page: Page) {
    this.titulo = page.getByRole("heading", { level: 1 });
  }

  /** Abre /datos-oficiales (con un dueño ficticio propio de la prueba, si hace falta) y espera a que hidrate. */
  static async abrir(page: Page, info: TestInfo): Promise<PaginaDatosOficiales> {
    await page.goto("/datos-oficiales");
    if (new URL(page.url()).pathname === "/ingresar") {
      await iniciarSesion(page, info, "datos-oficiales");
      await page.goto("/datos-oficiales");
    }
    const p = new PaginaDatosOficiales(page);
    await expect(p.titulo).toHaveText("Datos oficiales");
    await expect(page.locator(".g-plot[data-hidratado]")).toHaveCount(TITULOS_GRAFICAS.length);
    return p;
  }

  tarjeta(nombre: NombreSerie): Locator {
    return this.page.getByRole("article", { name: nombre });
  }

  figura(titulo: string): Locator {
    return this.page.getByRole("figure", { name: titulo });
  }

  mira(titulo: string): Locator {
    return this.figura(titulo).getByRole("slider", { name: titulo });
  }

  /** Recorre la página para que cada gráfica entre en pantalla, espera a que se dibujen y vuelve arriba. */
  async dibujarTodas(): Promise<void> {
    for (const t of TITULOS_GRAFICAS) await this.figura(t).scrollIntoViewIfNeeded();
    await expect(this.page.locator(".g-plot[data-hidratado]:not([data-visible])")).toHaveCount(0);
    await this.page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => this.page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
  }

  desbordeHorizontal(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }

  /**
   * Captura solo si CAPTURAS_DATOS_OFICIALES apunta a una carpeta absoluta FUERA del repo: el candado de datos reales
   * rechaza capturas versionadas. Sin la variable, no hace nada.
   */
  async capturar(nombre: string, completa = true): Promise<void> {
    const dir = process.env.CAPTURAS_DATOS_OFICIALES;
    if (!dir) return;
    const repo = resolve(process.cwd(), "..");
    const rel = relative(repo, resolve(dir));
    const dentro = !(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
    if (!isAbsolute(dir) || dentro) throw new Error("CAPTURAS_DATOS_OFICIALES debe ser una carpeta absoluta fuera del repo.");
    await this.page.screenshot({ path: join(dir, `${nombre}.png`), fullPage: completa });
  }
}
