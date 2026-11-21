/** Página del tablero para el E2E (INV-SPEC-15): localizadores por rol y nombre accesible. */
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { iniciarSesion } from "./sesion";

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
   * Abre el tablero (iniciando sesión, con un dueño ficticio propio de la prueba y su TOTP, si hace falta)
   * y espera la hidratación:
   * el contador pasa a «fin» solo cuando su efecto corre en el navegador. Antes, un clic no tendría manejador.
   */
  static async abrir(page: Page, info: TestInfo): Promise<PaginaTablero> {
    await page.goto("/");
    if (new URL(page.url()).pathname === "/ingresar") await iniciarSesion(page, info, "tablero");
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
