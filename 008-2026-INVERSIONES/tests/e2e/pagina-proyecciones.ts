/** La pantalla de proyecciones para el E2E (frente proyecciones-pantalla): localizadores por rol y nombre accesible. */
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { iniciarSesion } from "./sesion";

export const TITULO_ABANICO = "Valor real y proyección";

export class PaginaProyecciones {
  readonly titulo: Locator;
  readonly abanico: Locator;
  readonly mira: Locator;
  readonly resultado: Locator;
  readonly horizonte: Locator;
  readonly supuestos: Locator;
  readonly anuncio: Locator;

  private constructor(readonly page: Page) {
    this.titulo = page.getByRole("heading", { level: 1 });
    this.abanico = page.getByRole("figure", { name: TITULO_ABANICO });
    this.mira = this.abanico.getByRole("slider", { name: TITULO_ABANICO });
    this.resultado = page.locator(".proy-resultado");
    this.horizonte = page.getByRole("group", { name: "Horizonte" });
    this.supuestos = page.getByRole("region", { name: "Supuestos" });
    this.anuncio = page.locator(".proy-anuncio");
  }

  /** Abre /proyecciones (con un dueño ficticio propio de la prueba, si hace falta) y espera a que hidrate. */
  static async abrir(page: Page, info: TestInfo): Promise<PaginaProyecciones> {
    await page.goto("/proyecciones");
    if (new URL(page.url()).pathname === "/ingresar") {
      await iniciarSesion(page, info, "proyecciones");
      await page.goto("/proyecciones");
    }
    const p = new PaginaProyecciones(page);
    await expect(p.resultado).toHaveAttribute("data-hidratado", "");
    await expect(p.resultado).toHaveAttribute("aria-busy", "false");
    return p;
  }

  botonHorizonte(texto: string): Locator {
    return this.horizonte.getByRole("button", { name: texto, exact: true });
  }

  bandaSuave(): Locator {
    return this.abanico.locator("path.g-banda-suave");
  }

  indicador(nombre: string): Locator {
    return this.page.locator(".proy-indicador").filter({ hasText: nombre }).locator(".sr");
  }

  /** Espera a que termine el cálculo en curso y a que no quede animación corriendo. */
  async esperarCalculo(): Promise<void> {
    await expect(this.resultado).toHaveAttribute("aria-busy", "false");
    await expect.poll(() => this.page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
  }

  /** Un deslizador (input range) a un valor, como lo deja el usuario: Playwright no hace `fill` en un range. */
  async mover(deslizador: Locator, valor: number): Promise<void> {
    await deslizador.evaluate((el, v) => {
      const input = el as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, String(v));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, valor);
  }

  desbordeHorizontal(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }

  /**
   * Captura solo si CAPTURAS_PROYECCIONES apunta a una carpeta absoluta FUERA del repo: el candado de datos reales
   * rechaza capturas versionadas. Sin la variable, no hace nada.
   */
  async capturar(nombre: string, completa = true): Promise<void> {
    const dir = process.env.CAPTURAS_PROYECCIONES;
    if (!dir) return;
    const repo = resolve(process.cwd(), "..");
    const rel = relative(repo, resolve(dir));
    const dentro = !(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
    if (!isAbsolute(dir) || dentro) throw new Error("CAPTURAS_PROYECCIONES debe ser una carpeta absoluta fuera del repo.");
    await this.page.screenshot({ path: join(dir, `${nombre}.png`), fullPage: completa });
  }
}
