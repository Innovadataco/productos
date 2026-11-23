/**
 * E2E de la tarjeta de resumen (E5, frente ia-resumenes-pantalla) contra la base e2e sembrada (tests/e2e/sembrar.ts):
 *  - sin ningún PUBLICADO, el tablero, /plan y /proyecciones muestran su tarjeta: el resumen sin IA («Resumen sin IA»)
 *    o, si hoy no se puede armar, «Sin resumen» con su nota; a 375 px, en claro y en oscuro, sin desborde, con
 *    contraste AA y sin lenguaje de consejo fuera del aviso fijo del validador;
 *  - con un PUBLICADO DIARIO de hoy INVENTADO (los hechos de las pruebas de src/ia, con especies FICTICIA-*), el
 *    tablero lo revalida y lo muestra con el pie de la IA local y su modelo, y como sus hechos no son los de la base,
 *    lo marca DESACTUALIZADO; «Cifras usadas» se abre y trae fuente, fecha y calidad.
 * ESCRIBE en la base e2e (una fila de resumen_ia, de solo inserción): el prefijo `zz-` lo hace correr al final.
 * Correos y contraseñas inventados.
 */
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import type { EntradaPaquete } from "../../src/ia/contrato";
import { sha256Hex } from "../../src/ia/hash";
import { construirPaquete } from "../../src/ia/paquete";
import { registrarResumen } from "../../src/ia/registro/registro";
import { salidaDePlantilla } from "../../src/ia/validador/plantilla";
import { prohibidasEn } from "../unit/operar/informe/lenguaje";
import { ENTRADAS_FICTICIAS } from "../unit/ia/apoyo/hechos.ficticio";
import { hoyDelE2E } from "./base";
import { baseE2E, cerrarBaseE2E } from "./cuentas";
import { PaginaTablero } from "./pagina-tablero";
import { test } from "./sesion";

const ANCHO_CELULAR = { width: 375, height: 812 };
const PANTALLAS = [
  { ruta: "/", tipo: "diario" },
  { ruta: "/plan", tipo: "reglas" },
  { ruta: "/proyecciones", tipo: "escenarios" },
] as const;
const MODELO = "ficticio-modelo:7b";

test.afterAll(async () => {
  await cerrarBaseE2E();
});

/** Contraste del texto contra el primer fondo opaco de sus ancestros (WCAG). */
const contraste = (l: Locator) =>
  l.evaluate((el) => {
    const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    let fondo: Element | null = el;
    while (fondo && (rgba(getComputedStyle(fondo).backgroundColor)[3] ?? 1) === 0) fondo = fondo.parentElement;
    const bg = fondo ? getComputedStyle(fondo).backgroundColor : getComputedStyle(document.body).backgroundColor;
    const [l1, l2] = [lum(rgba(getComputedStyle(el).color)), lum(rgba(bg))].sort((x, y) => y - x);
    return (l1! + 0.05) / (l2! + 0.05);
  });

/** El texto de la tarjeta sin el aviso fijo (lo pone el validador y niega la recomendación a propósito). */
const textoSinAviso = (tarjeta: Locator) =>
  tarjeta.evaluate((el) => {
    const copia = el.cloneNode(true) as HTMLElement;
    copia.querySelector(".resumen-ia-aviso")?.remove();
    return (copia.textContent ?? "").replace(/\s+/g, " ").trim();
  });

async function abrir(page: Page, info: TestInfo, ruta: string): Promise<void> {
  await PaginaTablero.abrir(page, info);
  if (ruta !== "/") await page.goto(ruta);
}

/** Un PUBLICADO DIARIO de hoy con hechos inventados (fechados hoy) y la salida de la plantilla: pasa el validador. */
async function publicarDiarioInventado(): Promise<void> {
  const hoy = hoyDelE2E().toISOString().slice(0, 10);
  const base = ENTRADAS_FICTICIAS.DIARIO();
  const entrada: EntradaPaquete<"DIARIO"> = { ...base, hoy, hechos: base.hechos.map((h) => ({ ...h, fecha: hoy })) };
  const paquete = construirPaquete(entrada);
  await registrarResumen(baseE2E(), {
    paquete, prompt: { version: "resumen-ficticio-v3", hash: sha256Hex(`prompt ficticio e2e ${Date.now()}`) }, opciones: { temperature: 0, seed: 42 },
    validadorVersion: "validador-v2", estado: "PUBLICADO", texto: "Resumen ficticio del e2e.",
    exito: { ok: true, puerta: "local", salidaCruda: salidaDePlantilla(paquete), modelo: MODELO, modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
  });
}

test.describe("tarjeta de resumen", () => {
  for (const tema of ["light", "dark"] as const) {
    const nombre = tema === "light" ? "claro" : "oscuro";

    test.describe(`a 375 px · ${nombre}`, () => {
      test.use({ viewport: ANCHO_CELULAR, colorScheme: tema });

      for (const p of PANTALLAS) {
        test(`${p.ruta}: la tarjeta sin IA, sin desborde, con contraste AA y sin consejos`, async ({ page }, info) => {
          await abrir(page, info, p.ruta);
          const tarjeta = page.locator(`section.resumen-ia[aria-labelledby="t-resumen-ia-${p.tipo}"]`);
          await expect(tarjeta).toBeVisible();
          await expect(tarjeta.getByRole("heading", { level: 2 })).toBeVisible();
          const estado = await tarjeta.getAttribute("data-estado");
          expect(["SIN_IA", "NO_DISPONIBLE"]).toContain(estado);
          await expect(tarjeta.locator(".resumen-ia-pie")).toHaveText(estado === "SIN_IA" ? "Resumen sin IA" : "Sin resumen");
          if (estado === "SIN_IA") await expect(tarjeta.locator(".resumen-ia-frases li").first()).toBeVisible();
          else await expect(tarjeta.locator(".resumen-ia-nota")).toBeVisible();
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
          const textos = [tarjeta.locator("h2"), tarjeta.locator(".resumen-ia-pie"), tarjeta.locator(".resumen-ia-frases li, .resumen-ia-nota").first()];
          for (const l of textos) expect(await contraste(l), await l.evaluate((e) => `${e.tagName}.${e.className}`)).toBeGreaterThanOrEqual(4.5);
          expect(prohibidasEn(await textoSinAviso(tarjeta))).toEqual([]);
        });
      }
    });
  }

  test.describe("con un PUBLICADO DIARIO de hoy", () => {
    test.use({ viewport: ANCHO_CELULAR });

    test("el tablero lo muestra revalidado, con el pie de la IA local y DESACTUALIZADO (sus hechos no son los de hoy)", async ({ page }, info) => {
      await publicarDiarioInventado();
      await abrir(page, info, "/");
      const tarjeta = page.locator('section.resumen-ia[aria-labelledby="t-resumen-ia-diario"]');
      await expect(tarjeta).toHaveAttribute("data-estado", "IA");
      await expect(tarjeta.locator(".resumen-ia-pie")).toContainText(`Redactado por IA local (${MODELO}) · cifras calculadas por 008 y cotejadas`);
      await expect(tarjeta.locator(".resumen-ia-pie time")).toHaveCount(1);
      await expect(tarjeta.locator(".resumen-ia-desactualizado")).toHaveText(/^DESACTUALIZADO/);
      expect(await contraste(tarjeta.locator(".resumen-ia-desactualizado"))).toBeGreaterThanOrEqual(4.5);
      await expect(tarjeta).not.toContainText("Resumen ficticio del e2e.");
      await tarjeta.getByText("Cifras usadas").click();
      const cifra = tarjeta.locator(".resumen-ia-cifras li").first();
      await expect(cifra).toBeVisible();
      await expect(cifra).toContainText("fuente-ficticia");
      await expect(cifra.locator("time")).toHaveCount(1);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      expect(prohibidasEn(await textoSinAviso(tarjeta))).toEqual([]);
    });
  });
});
