/** Página /conciliacion para el E2E (PR-C): localizadores por rol y nombre accesible. */
import type { Locator, Page } from "@playwright/test";

export class PaginaConciliacion {
  readonly titulo: Locator;
  readonly acciones: Locator;
  readonly saldos: Locator;
  readonly porLiquidar: Locator;
  readonly cortes: Locator;

  constructor(readonly page: Page) {
    this.titulo = page.getByRole("heading", { level: 1 });
    this.acciones = page.getByRole("table", { name: "Acciones", exact: true });
    this.saldos = page.getByRole("table", { name: "Fondo y efectivo", exact: true });
    this.porLiquidar = page.getByRole("table", { name: "Por liquidar al corte", exact: true });
    this.cortes = page.getByRole("navigation", { name: "Otros cortes", exact: true });
  }

  /** La fila cuyo encabezado de fila es `nombre` (una especie, «Total de acciones», «Efectivo»). */
  fila(tabla: Locator, nombre: string): Locator {
    return tabla.getByRole("row").filter({ has: this.page.getByRole("rowheader", { name: nombre, exact: true }) });
  }

  /** Las celdas de una fila, como texto. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.getByRole("cell").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  }

  corte(texto: string): Locator {
    return this.cortes.getByRole("link", { name: texto, exact: true });
  }

  /** Píxeles que el documento se sale de la ventana a lo ancho (0 = sin desborde). */
  desbordeHorizontal(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }
}
