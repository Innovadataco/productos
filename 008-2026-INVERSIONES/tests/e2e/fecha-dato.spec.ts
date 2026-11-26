/**
 * E2E de la procedencia de cada dato (frentes fecha-hora-datos y fuente-retraso), a 375 px, en claro y en oscuro, contra la base e2e
 * sembrada por tests/e2e/sembrar.ts. Cada cajón dice la fecha de su dato, cuándo lo trajo 008 (fecha y hora de
 * Colombia, comparada con la de la base pasada por Intl en America/Bogota) y su fuente; los valores que suman cierres
 * dicen el más antiguo y avisan las fechas distintas (FICTC, ilíquida, cerró el 1-nov-2024; las demás, el 22-nov-2024).
 * Los cierres del tablero se sembraron con la fuente «e2e-ficticio», que la app muestra tal cual y sin retraso inventado
 * (el nombre «Yahoo (BVC)» y sus 20 min los cubren las pruebas de unidad y el pie del tablero). Los cierres sembrados son
 * de 2024: con el reloj real llevan muchos días hábiles de atraso, y la pantalla lo avisa. La prueba no cambia la base.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { fecha } from "../../src/app/tablero/formato";
import { textoProcedencia } from "../../src/app/_comun/fecha-dato/textos";
import { PaginaConciliacion } from "./pagina-conciliacion";
import { PaginaDatosOficiales } from "./pagina-datos-oficiales";
import { PaginaPlan } from "./pagina-plan";
import { PaginaTablero } from "./pagina-tablero";
import { diaDeLaLinea, origenDeLaSerie, origenDelCierre, traido } from "./procedencia-e2e";
import { test } from "./sesion";

const MOVIL = { width: 375, height: 812 };
const AVISO = "Cierres de fechas distintas: del 1-nov-2024 al 22-nov-2024.";
const DATO_VIEJO = /^dato de hace \d+ días hábiles$/;
const PIE = "Precios: Yahoo (BVC), cierre diario; durante la rueda, hasta 20 min de retraso. No es tiempo real.";

const limpio = (t: string): string => t.replace(/\s+/g, " ").trim();
/** La línea visible de cada nota (los avisos tienen su propia clase). */
const notas = async (zona: Locator): Promise<string[]> => (await zona.locator(".fecha-dato-linea").allInnerTexts()).map(limpio);
const avisos = async (zona: Locator): Promise<string[]> => (await zona.locator(".fecha-dato-aviso").allInnerTexts()).map(limpio);

/** Ya no hay un detalle oculto que repita la fuente y la hora: ni en el DOM ni como tooltip. */
async function sinDetalleOculto(zona: Locator): Promise<void> {
  expect(await zona.locator(".fecha-dato-detalle").count()).toBe(0);
  expect(await zona.locator("[title]").count()).toBe(0);
}

/** Ninguna línea de procedencia se sale de su celda (el retraso alarga la línea: a 375 px se parte; el desborde de la página se mide aparte). */
async function lineasDentroDeSuCelda(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const caja = (l: Element) => l.closest("td, th, li, section, article, div")!;
    return [...document.querySelectorAll(".fecha-dato-linea")]
      .filter((l) => l.getBoundingClientRect().right > caja(l).getBoundingClientRect().right + 1)
      .map((l) => `${caja(l).tagName}.${caja(l).className} «${l.textContent}» ${Math.round(l.getBoundingClientRect().right)} > ${Math.round(caja(l).getBoundingClientRect().right)}`);
  });
}

/** Contraste WCAG del texto de cada nota contra el primer fondo opaco de sus ancestros (y que ninguna se salga a lo ancho). */
async function revisarNotas(page: Page): Promise<{ readonly peor: number; readonly cuantas: number; readonly desborde: number }> {
  return page.evaluate(() => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const fondo = (el: Element | null): string => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        const partes = rgb(c);
        if (partes.length === 3 || (partes.length === 4 && partes[3]! > 0.95)) return c;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const nodos = [...document.querySelectorAll(".fecha-dato, .fecha-dato-aviso")];
    const razones = nodos.map((n) => {
      const [a, b] = [lum(rgb(getComputedStyle(n).color)), lum(rgb(fondo(n)))];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    return { peor: Math.min(...razones), cuantas: nodos.length, desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}

for (const tema of ["light", "dark"] as const) {
  test.describe(`procedencia de cada dato · ${tema === "light" ? "claro" : "oscuro"} · 375 px`, () => {
    test.use({ viewport: MOVIL, colorScheme: tema });

    test("tablero: cada fila, el panel y cada tarjeta con su cierre, hora y fuente; los totales con el más antiguo y los avisos", async ({ page }, info) => {
      const [a, c] = [await origenDelCierre("FICTA", "2024-11-22"), await origenDelCierre("FICTC", "2024-11-01")];
      const t = await PaginaTablero.abrir(page, info);

      // La línea de cada fila: la fecha ya la dice el chip; sin detalle oculto que la repita.
      expect(await notas(t.fila("FICTA"))).toEqual([traido(a, "2024-11-22")]);
      expect(await notas(t.fila("FICTC"))).toEqual([traido(c, "2024-11-01")]);
      await sinDetalleOculto(t.fila("FICTA"));
      await sinDetalleOculto(page.locator("main"));

      // Cierres de 2024 contra el reloj real: más de un día hábil de atraso, y lo dice.
      const viejo = await avisos(t.fila("FICTA"));
      expect(viejo).toHaveLength(1);
      expect(viejo[0]).toMatch(DATO_VIEJO);
      await expect(t.fila("FICTA").locator(".fecha-dato-aviso")).toBeVisible();

      const lineaC = `Cierre más antiguo ${diaDeLaLinea("2024-11-01", c)} · ${traido(c, "2024-11-01")}`;
      const kpi = page.locator(".kpi").filter({ has: page.getByText("Valor en acciones", { exact: true }) });
      expect(await notas(kpi)).toEqual([lineaC]);
      expect(await avisos(kpi)).toEqual([AVISO, expect.stringMatching(DATO_VIEJO)]);
      expect(await notas(page.getByRole("region", { name: /¿Gano\?/ }))).toEqual([lineaC]);
      await expect(kpi.locator(".fecha-dato-aviso").first()).toBeVisible();
      expect(await notas(page.getByRole("region", { name: "Cómo está repartido" }))).toContain(lineaC);

      const tarjetaA = t.queMovio.getByRole("listitem").filter({ hasText: "FICTA" });
      expect(await notas(tarjetaA)).toEqual([traido(a, "2024-11-22")]);

      await t.botonEspecie("FICTC").click();
      expect(await notas(t.detalle("FICTC"))).toEqual([traido(c, "2024-11-01")]);

      // El pie: de dónde vienen los precios, su retraso en rueda y que no es tiempo real.
      await expect(page.locator("#fuentes-de-precios")).toHaveText(PIE);

      const r = await revisarNotas(page);
      expect(r.cuantas).toBeGreaterThan(5);
      expect(r.peor, "contraste de las notas").toBeGreaterThanOrEqual(4.5);
      expect(r.desborde).toBeLessThanOrEqual(0);
      expect(await lineasDentroDeSuCelda(page), "líneas fuera de su celda").toEqual([]);
      expect((await notas(page.locator("main"))).filter((l) => /retraso/.test(l)), "un cierre no lleva retraso").toEqual([]);

      // No hay datos de rueda en la base: se pone, en la celda «Cierre» de la primera fila, la línea de rueda tal como la arma
      // la app (con retraso) y se mide a 375 px que no se sale de la celda, no desborda la página y conserva el contraste.
      const rueda = textoProcedencia({ dia: "2027-03-17", traidoEn: "2027-03-17 11:44", fuente: "yahoo", tipo: "RUEDA", horaDato: "11:42" }, { sinFecha: true });
      expect(rueda).toMatch(/hasta 20 min de retraso$/);
      await page.locator("td.num .fecha-dato-linea").first().evaluate((el, t) => { el.textContent = t; }, rueda);
      expect(await lineasDentroDeSuCelda(page), "la línea de rueda, fuera de su celda").toEqual([]);
      const conRueda = await revisarNotas(page);
      expect(conRueda.desborde).toBeLessThanOrEqual(0);
      expect(conRueda.peor, "contraste con la línea de rueda").toBeGreaterThanOrEqual(4.5);
    });

    test("plan: el «Último cierre» de cada regla con cuándo se trajo, de dónde y si el dato es viejo", async ({ page }, info) => {
      const [a, c] = [await origenDelCierre("FICTA", "2024-11-22"), await origenDelCierre("FICTC", "2024-11-01")];
      await PaginaTablero.abrir(page, info);
      await page.goto("/plan");
      const p = new PaginaPlan(page);
      await expect(p.titulo).toHaveText("Plan vigente: versión 1");
      expect(await notas(p.fila(p.reglas, "FICTA"))).toEqual([traido(a, "2024-11-22")]);
      expect(await notas(p.fila(p.reglas, "FICTC"))).toEqual([traido(c, "2024-11-01")]);
      await sinDetalleOculto(p.fila(p.reglas, "FICTA"));
      expect(await avisos(p.fila(p.reglas, "FICTC"))).toEqual([expect.stringMatching(DATO_VIEJO)]);
      const r = await revisarNotas(page);
      expect(r.peor, "contraste de las notas").toBeGreaterThanOrEqual(4.5);
      expect(r.desborde).toBeLessThanOrEqual(0);
    });

    test("conciliación: el «Valor sistema» con el cierre del corte con que se calculó, su hora y su fuente", async ({ page }, info) => {
      const [a, b] = [await origenDelCierre("FICTA", "2024-11-22"), await origenDelCierre("FICTB", "2024-11-22")];
      await PaginaTablero.abrir(page, info);
      await page.goto("/conciliacion");
      const k = new PaginaConciliacion(page);
      await expect(k.titulo).toHaveText("Corte del 22-nov-2024: No cuadra");
      expect(await notas(k.fila(k.acciones, "FICTA"))).toEqual([`Cierre ${diaDeLaLinea("2024-11-22", a)} · ${traido(a, "2024-11-22")}`]);
      expect(await notas(k.fila(k.acciones, "FICTB"))).toEqual([`Cierre ${diaDeLaLinea("2024-11-22", b)} · ${traido(b, "2024-11-22")}`]);
      expect(await notas(k.fila(k.acciones, "FICTC"))).toEqual([]);
      const r = await revisarNotas(page);
      expect(r.peor, "contraste de las notas").toBeGreaterThanOrEqual(4.5);
      expect(r.desborde).toBeLessThanOrEqual(0);
    });

    test("datos oficiales: la TRM con su vigencia, cuándo se trajo en hora de Colombia y su fuente", async ({ page }, info) => {
      const trm = await origenDeLaSerie("TRM");
      const d = await PaginaDatosOficiales.abrir(page, info);
      const tarjeta = d.tarjeta("Tasa Representativa del Mercado");
      await expect(tarjeta.locator(".do-vigencia")).toContainText("vigente del");
      await expect(tarjeta.locator("dd").filter({ hasText: "(hora de Colombia)" })).toHaveText(`${fecha(trm.traido.dia)} a las ${trm.traido.hhmm} (hora de Colombia)`);
      await expect(tarjeta.locator("dd").first()).toContainText(trm.fuente);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  });
}
