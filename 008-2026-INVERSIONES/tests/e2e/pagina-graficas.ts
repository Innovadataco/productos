/** Las gráficas del tablero para el E2E (frente graficas-tablero): localizadores por rol y nombre accesible. */
import { isAbsolute, join, relative, resolve } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

export const TITULOS = ["Valor frente al costo de lo que tiene", "TWR acumulada", "Composición", "Rentabilidad sin vender por especie"] as const;

export class PaginaGraficas {
  readonly evolucion: Locator;
  readonly foto: Locator;
  readonly rango: Locator;

  constructor(readonly page: Page) {
    this.evolucion = page.getByRole("region", { name: "Cómo ha ido" });
    this.foto = page.getByRole("region", { name: "Cómo está repartido" });
    this.rango = this.evolucion.getByRole("group", { name: "Rango de fechas" });
  }

  figura(titulo: (typeof TITULOS)[number]): Locator {
    return this.page.getByRole("figure", { name: titulo });
  }

  /** La zona interactiva (mira) de una gráfica de tiempo: el grupo enfocable con el nombre de la gráfica. */
  mira(titulo: (typeof TITULOS)[number]): Locator {
    return this.figura(titulo).locator("[role=group][tabindex='0']");
  }

  detalleDelDia(titulo: (typeof TITULOS)[number]): Locator {
    return this.figura(titulo).locator(".g-tip");
  }

  anuncio(titulo: (typeof TITULOS)[number]): Locator {
    return this.figura(titulo).locator("[aria-live=polite]");
  }

  botonRango(texto: string): Locator {
    return this.rango.getByRole("button", { name: texto, exact: true });
  }

  /** Recorre la página para que cada gráfica entre en pantalla y espera a que todas se hayan dibujado. */
  async dibujarTodas(): Promise<void> {
    for (const t of TITULOS) await this.figura(t).scrollIntoViewIfNeeded();
    await expect(this.page.locator(".g-anima:not([data-visible])")).toHaveCount(0);
    await this.page.evaluate(() => window.scrollTo(0, 0));
    // Las entradas duran ~1,2 s: se espera a que no quede ninguna animación ni transición corriendo.
    await expect.poll(() => this.page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
  }

  /**
   * Captura solo si CAPTURAS_GRAFICAS apunta a una carpeta absoluta FUERA del repo: el candado de datos reales
   * rechaza capturas versionadas. Sin la variable, no hace nada.
   */
  async capturar(nombre: string, completa = true): Promise<void> {
    const dir = process.env.CAPTURAS_GRAFICAS;
    if (!dir) return;
    // Playwright corre desde 008-2026-INVERSIONES/: el repo es la carpeta de arriba.
    const repo = resolve(process.cwd(), "..");
    const dentro = !relative(repo, resolve(dir)).startsWith("..");
    if (!isAbsolute(dir) || dentro) throw new Error("CAPTURAS_GRAFICAS debe ser una carpeta absoluta fuera del repo.");
    await this.page.screenshot({ path: join(dir, `${nombre}.png`), fullPage: completa });
  }
}
