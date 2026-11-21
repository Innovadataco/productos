/** Página del tablero para el E2E (INV-SPEC-15): localizadores por rol y nombre accesible. */
import { expect, type Locator, type Page } from "@playwright/test";

export class PaginaTablero {
  readonly titulo: Locator;
  /** La cifra animada del total (el lector de pantalla oye la versión `.sr`). */
  readonly cifraDelTotal: Locator;
  readonly tabla: Locator;
  readonly botonesDeEspecie: Locator;
  readonly avisoIncompletas: Locator;
  readonly botonTema: Locator;

  private constructor(readonly page: Page) {
    this.titulo = page.getByRole("heading", { level: 1 });
    this.cifraDelTotal = this.titulo.locator(".cifra");
    this.tabla = page.getByRole("table");
    this.botonesDeEspecie = this.tabla.locator("tbody").getByRole("button");
    this.avisoIncompletas = page.getByText(/^Con datos incompletos/);
    this.botonTema = page.getByRole("button", { name: "Tema claro", exact: true });
  }

  /**
   * Abre el tablero y espera la hidratación: el contador pasa a «fin» solo cuando su efecto
   * corre en el navegador. Antes de eso, un clic no tendría manejador.
   */
  static async abrir(page: Page): Promise<PaginaTablero> {
    await page.goto("/");
    const t = new PaginaTablero(page);
    await expect(t.cifraDelTotal).toHaveAttribute("data-fase", "fin");
    return t;
  }

  columna(nombre: string): Locator {
    return this.page.getByRole("columnheader", { name: nombre, exact: true });
  }

  async ordenarPor(nombre: string): Promise<void> {
    await this.columna(nombre).getByRole("button").click();
  }

  botonEspecie(nemo: string): Locator {
    return this.botonesDeEspecie.filter({ hasText: new RegExp(`^${nemo}$`) });
  }

  detalle(nemo: string): Locator {
    return this.page.getByRole("complementary", { name: `Detalle de ${nemo}` });
  }

  /** Color de fondo que el navegador le calculó a `body`. */
  fondo(): Promise<string> {
    return this.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  }

  /** Píxeles que el documento se sale de la ventana a lo ancho (0 = sin desborde). */
  desbordeHorizontal(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }
}
