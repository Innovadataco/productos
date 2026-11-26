/**
 * E2E de la tarjeta de resumen (E5, frente ia-resumenes-pantalla) contra la base e2e sembrada (tests/e2e/sembrar.ts):
 *  - sin ningún PUBLICADO, el tablero, /plan y /proyecciones muestran su tarjeta: el resumen sin IA («Resumen sin IA»)
 *    o, si hoy no se puede armar, «Sin resumen» con su nota; a 375 px, en claro y en oscuro, sin desborde, con
 *    contraste AA y sin lenguaje de consejo fuera del aviso fijo del validador;
 *  - con un PUBLICADO DIARIO de hoy INVENTADO (los hechos de las pruebas de src/ia, con especies FICTICIA-*), el
 *    tablero lo revalida y lo muestra con el pie de la IA local y su modelo, y como sus hechos no son los de la base,
 *    lo marca DESACTUALIZADO; «Cifras usadas» se abre y trae fuente, fecha y calidad.
 *  - los tres motivos de una tarjeta sin análisis de la IA (a 375 px, en claro y en oscuro, sin desborde y con contraste AA):
 *    «IA apagada» (la configuración apagada, para todos), «el último intento falló» (REGLAS) y «el análisis guardado ya no
 *    pasa la revisión» (ESCENARIOS). Corren antes del PUBLICADO DIARIO de hoy, con la configuración apagada que dejan.
 * ESCRIBE en la base e2e (config_ia y filas de resumen_ia, de solo inserción): el prefijo `zz-` lo hace correr al final.
 * Correos y contraseñas inventados.
 */
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { Prisma } from "@prisma/client";
import type { EntradaPaquete, TipoResumen } from "../../src/ia/contrato";
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


/** Una versión nueva de config_ia (solo inserción) con el modo apagado: la IA está apagada para todas las tarjetas. */
async function guardarConfigApagada(): Promise<void> {
  const db = baseE2E();
  const dueno = await db.usuario.findFirstOrThrow({ where: { rol: "DUENO" }, select: { id: true } });
  const ultima = (await db.configIa.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
  await db.configIa.create({
    data: {
      version: ultima + 1, modo: "apagado", temperaturaLocal: new Prisma.Decimal("0"),
      tareas: { DIARIO: { activo: true, modeloLocal: null }, REGLAS: { activo: true, modeloLocal: null }, ESCENARIOS: { activo: true, modeloLocal: null } },
      modeloNube: "claude-opus-5-5", horaResumen: "19:00", limiteSegundos: 60, esfuerzoNube: "low", analisisDemanda: false,
      motivo: `Prueba de los motivos de la tarjeta (e2e) ${Date.now()}`, autorId: dueno.id,
    },
  });
}

/** El paquete inventado de un tipo, fechado hoy y con un aviso propio de cada llamada (otro hash: no choca con uno anterior). */
function paqueteInventado(tipo: TipoResumen) {
  const hoy = hoyDelE2E().toISOString().slice(0, 10);
  const base = ENTRADAS_FICTICIAS[tipo]();
  return construirPaquete({ ...base, hoy, hechos: base.hechos.map((h) => ({ ...h, fecha: hoy })), avisos: [...base.avisos, `E2E_MOTIVOS_${Date.now()}`] } as never);
}
const PROMPT = () => ({ version: "resumen-ficticio-v3", hash: sha256Hex(`prompt ficticio e2e motivos ${Date.now()}`) });

/** Un intento FALLIDO (sin salida del modelo) de ese tipo. */
async function registrarFallido(tipo: TipoResumen): Promise<void> {
  await registrarResumen(baseE2E(), {
    paquete: paqueteInventado(tipo), prompt: PROMPT(), opciones: { temperature: 0, seed: 42 }, validadorVersion: "validador-v2",
    estado: "FALLIDO", puerta: "local", motivo: "TIEMPO_AGOTADO", detalles: ["DETALLE_FICTICIO"], modelo: MODELO, latenciaMs: 4127,
  });
}

/** Un PUBLICADO de ese tipo cuya salida guardada ya no pasa el validador. */
async function registrarPublicadoQueNoPasa(tipo: TipoResumen): Promise<void> {
  await registrarResumen(baseE2E(), {
    paquete: paqueteInventado(tipo), prompt: PROMPT(), opciones: { temperature: 0, seed: 42 }, validadorVersion: "validador-v2", estado: "PUBLICADO",
    texto: "Resumen ficticio del e2e.",
    exito: { ok: true, puerta: "local", salidaCruda: "FICTICIA-ALFA no es json", modelo: MODELO, modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
  });
}

const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const PALABRAS_DE_CONFIGURACION = /configuraci|interruptor|modo\b|demanda|tarea/i;

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

  test.describe("los motivos de una tarjeta sin análisis de la IA", () => {
    // El servidor registra (solo con el código) que el publicado no pasó el validador, y `next dev` lo reenvía a la consola.
    test.use({ erroresEsperados: [/el publicado no pasó el validador y no se muestra \(SALIDA_INVALIDA\)/] });
    for (const tema of ["light", "dark"] as const) {
      const nombre = tema === "light" ? "claro" : "oscuro";

      test.describe(`a 375 px · ${nombre}`, () => {
        test.use({ viewport: ANCHO_CELULAR, colorScheme: tema });

        test("«IA apagada» en las tres pantallas, sin detalles de configuración", async ({ page }, info) => {
          await guardarConfigApagada();
          await abrir(page, info, "/");
          for (const p of PANTALLAS) {
            if (p.ruta !== "/") await page.goto(p.ruta);
            const tarjeta = page.locator(`section.resumen-ia[aria-labelledby="t-resumen-ia-${p.tipo}"]`);
            const motivo = tarjeta.locator(".resumen-ia-sin-ia");
            await expect(motivo).toBeVisible();
            await expect(motivo).toHaveText("IA apagada");
            expect(await contraste(motivo)).toBeGreaterThanOrEqual(4.5);
            expect(await desborde(page)).toBeLessThanOrEqual(0);
            const visible = await textoSinAviso(tarjeta);
            expect(visible).not.toMatch(PALABRAS_DE_CONFIGURACION);
            expect(prohibidasEn(visible)).toEqual([]);
          }
        });

        test("«el último intento falló» (REGLAS), con su fecha y sin códigos", async ({ page }, info) => {
          await registrarFallido("REGLAS");
          await abrir(page, info, "/plan");
          const tarjeta = page.locator('section.resumen-ia[aria-labelledby="t-resumen-ia-reglas"]');
          const fallo = tarjeta.locator(".resumen-ia-fallo");
          await expect(fallo).toBeVisible();
          await expect(fallo).toHaveText(/^El último intento de análisis \(\d{1,2}-[a-z]{3}-\d{4}, \d{2}:\d{2}\) falló; se muestra el resumen sin IA\.$/);
          expect(await contraste(fallo)).toBeGreaterThanOrEqual(4.5);
          expect(await desborde(page)).toBeLessThanOrEqual(0);
          const visible = await textoSinAviso(tarjeta);
          expect(visible).not.toContain("TIEMPO_AGOTADO");
          expect(prohibidasEn(visible)).toEqual([]);
        });

        test("«el análisis guardado ya no pasa la revisión» (DIARIO), sin mostrar lo guardado", async ({ page }, info) => {
          await registrarPublicadoQueNoPasa("DIARIO");
          await abrir(page, info, "/");
          const tarjeta = page.locator('section.resumen-ia[aria-labelledby="t-resumen-ia-diario"]');
          const nota = tarjeta.locator(".resumen-ia-descartado");
          await expect(nota).toBeVisible();
          await expect(nota).toHaveText(/^El análisis guardado ya no pasa la revisión; se muestra el resumen sin IA\.$/);
          expect(await contraste(nota)).toBeGreaterThanOrEqual(4.5);
          expect(await desborde(page)).toBeLessThanOrEqual(0);
          const visible = await textoSinAviso(tarjeta);
          expect(visible).not.toContain("FICTICIA-ALFA");
          expect(prohibidasEn(visible)).toEqual([]);
        });
      });
    }
  });

  test.describe("con un PUBLICADO DIARIO de hoy", () => {
    test.use({ viewport: ANCHO_CELULAR });

    test("el tablero lo muestra revalidado, con el pie de la IA local y DESACTUALIZADO (sus hechos no son los de hoy)", async ({ page }, info) => {
      await publicarDiarioInventado();
      await abrir(page, info, "/");
      const tarjeta = page.locator('section.resumen-ia[aria-labelledby="t-resumen-ia-diario"]');
      await expect(tarjeta).toHaveAttribute("data-estado", "IA");
      await expect(tarjeta.locator(".resumen-ia-pie")).toContainText(`Redactado por IA local (${MODELO}) · cifras calculadas por Inversiones y cotejadas`);
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
