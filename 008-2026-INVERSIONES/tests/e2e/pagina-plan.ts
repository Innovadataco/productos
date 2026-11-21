/** Páginas /plan, /decisiones y /decisiones/[id] para el E2E (fase B, corte 3): localizadores por rol y nombre accesible. */
import type { Locator, Page } from "@playwright/test";

export class PaginaPlan {
  readonly titulo: Locator;
  readonly reglas: Locator;
  readonly versiones: Locator;
  readonly decisiones: Locator;
  readonly sinDecision: Locator;
  readonly secciones: Locator;

  constructor(readonly page: Page) {
    this.titulo = page.getByRole("heading", { level: 1 });
    this.reglas = page.getByRole("table", { name: "Reglas", exact: true });
    this.versiones = page.getByRole("navigation", { name: "Versiones del plan", exact: true });
    this.decisiones = page.getByRole("table", { name: "Decisiones", exact: true });
    this.sinDecision = page.getByRole("table", { name: "Órdenes sin decisión registrada", exact: true });
    this.secciones = page.getByRole("navigation", { name: "Secciones", exact: true });
  }

  /** La fila cuyo encabezado de fila es `nombre` (la especie en el plan, la fecha en el diario). */
  fila(tabla: Locator, nombre: string): Locator {
    return tabla.getByRole("row").filter({ has: this.page.getByRole("rowheader", { name: nombre, exact: true }) });
  }

  /** Las celdas de una fila (sin el encabezado de fila), como texto. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.getByRole("cell").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  }

  /** Píxeles que el documento se sale de la ventana a lo ancho (0 = sin desborde). */
  desbordeHorizontal(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }
}
