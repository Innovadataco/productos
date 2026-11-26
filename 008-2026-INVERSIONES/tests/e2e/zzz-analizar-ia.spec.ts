/**
 * E2E del botón «Analizar con IA» y de la tarjeta con fecha (frente ia-analizar) contra la base e2e sembrada
 * (tests/e2e/sembrar.ts). NADA contra Ollama ni contra el servicio de IA: el navegador habla con un doble de
 * /api/ia/analizar (page.route) y, donde la prueba llega al servidor, la app no tiene token del servicio (503).
 *  - el dueño ve el botón en el tablero, en /plan y en /proyecciones; la familia no lo ve y la ruta le responde 403;
 *  - con el interruptor de config_ia apagado (el valor de omisión) el dueño tampoco lo ve (falla cerrada);
 *  - al hacer clic: «Analizando…» con el botón deshabilitado; al terminar, la pantalla se refresca y dice cuándo se
 *    puede volver a analizar (a 375 px, en claro y en oscuro, sin desborde y con contraste AA);
 *  - la tarjeta muestra el ÚLTIMO análisis válido con su fecha y hora aunque sea de otro día, con el aviso de
 *    DESACTUALIZADO cuando sus hechos ya no son los de hoy.
 * ESCRIBE en la base e2e (config_ia y resumen_ia, de solo inserción): el prefijo `zzz-` lo hace correr al final, después
 * de zz-resumen-ia. Correos y contraseñas inventados.
 */
import { Prisma } from "@prisma/client";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { emitirAccesoFamiliar } from "../../src/auth/familia";
import type { EntradaPaquete } from "../../src/ia/contrato";
import { sha256Hex } from "../../src/ia/hash";
import { construirPaquete } from "../../src/ia/paquete";
import { registrarResumen } from "../../src/ia/registro/registro";
import { salidaDePlantilla } from "../../src/ia/validador/plantilla";
import { ENTRADAS_FICTICIAS } from "../unit/ia/apoyo/hechos.ficticio";
import { prohibidasEn } from "../unit/operar/informe/lenguaje";
import { hoyDelE2E } from "./base";
import { baseE2E, cerrarBaseE2E, sufijo } from "./cuentas";
import { PaginaTablero } from "./pagina-tablero";
import { enrolarEnPagina, pasarClave, test } from "./sesion";

const ANCHO_CELULAR = { width: 375, height: 812 };
const PANTALLAS = [
  { ruta: "/", tipo: "diario" },
  { ruta: "/plan", tipo: "reglas" },
  { ruta: "/proyecciones", tipo: "escenarios" },
] as const;
const MODELO = "ficticio-modelo:7b";
const BOTON = "Analizar con IA";
const API = "**/api/ia/analizar";
const LIBRE = { enCurso: null, enEspera: null, reintentarEnS: 0, ultimo: null };

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

const desborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function abrir(page: Page, info: TestInfo, ruta: string): Promise<void> {
  await PaginaTablero.abrir(page, info);
  if (ruta !== "/") await page.goto(ruta);
}

const tarjetaDe = (page: Page, tipo: string): Locator => page.locator(`section.resumen-ia[aria-labelledby="t-resumen-ia-${tipo}"]`);

/** Una versión nueva de config_ia (solo inserción) con el interruptor dado; las tareas activas, sin modelo (modo apagado). */
async function guardarConfig(analisisDemanda: boolean): Promise<void> {
  const db = baseE2E();
  const dueno = await db.usuario.findFirstOrThrow({ where: { rol: "DUENO" }, select: { id: true } });
  const ultima = (await db.configIa.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
  await db.configIa.create({
    data: {
      version: ultima + 1, modo: "apagado", temperaturaLocal: new Prisma.Decimal("0"),
      tareas: { DIARIO: { activo: true, modeloLocal: null }, REGLAS: { activo: true, modeloLocal: null }, ESCENARIOS: { activo: true, modeloLocal: null } },
      modeloNube: "claude-opus-5-5", horaResumen: "19:00", limiteSegundos: 60, esfuerzoNube: "low", analisisDemanda,
      motivo: `Prueba del botón (e2e) ${Date.now()}`, autorId: dueno.id,
    },
  });
}

/** Un PUBLICADO DIARIO con hechos inventados de AYER: pasa el validador y sus hechos ya no son los de hoy. */
async function publicarDiarioDeAyer(): Promise<void> {
  const ayer = new Date(hoyDelE2E().getTime() - 86_400_000).toISOString().slice(0, 10);
  const base = ENTRADAS_FICTICIAS.DIARIO();
  const entrada: EntradaPaquete<"DIARIO"> = { ...base, hoy: ayer, hechos: base.hechos.map((h) => ({ ...h, fecha: ayer })) };
  const paquete = construirPaquete(entrada);
  await registrarResumen(baseE2E(), {
    paquete, prompt: { version: "resumen-ficticio-v3", hash: sha256Hex(`prompt ficticio e2e boton ${Date.now()}`) }, opciones: { temperature: 0, seed: 42 },
    validadorVersion: "validador-v2", estado: "PUBLICADO", texto: "Resumen ficticio del e2e.",
    exito: { ok: true, puerta: "local", salidaCruda: salidaDePlantilla(paquete), modelo: MODELO, modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
  });
}

test.describe("con el interruptor de config_ia apagado (el valor de omisión)", () => {
  test.use({ viewport: ANCHO_CELULAR });

  test("el dueño no ve el botón en ninguna pantalla (falla cerrada)", async ({ page }, info) => {
    await guardarConfig(false);
    await abrir(page, info, "/");
    for (const p of PANTALLAS) {
      if (p.ruta !== "/") await page.goto(p.ruta);
      await expect(tarjetaDe(page, p.tipo)).toBeVisible();
      await expect(page.getByRole("button", { name: BOTON })).toHaveCount(0);
    }
  });
});

test.describe("el dueño, con el interruptor encendido", () => {
  test.beforeAll(async () => {
    await guardarConfig(true);
  });

  for (const tema of ["light", "dark"] as const) {
    const nombre = tema === "light" ? "claro" : "oscuro";

    test.describe(`a 375 px · ${nombre}`, () => {
      test.use({ viewport: ANCHO_CELULAR, colorScheme: tema });

      for (const p of PANTALLAS) {
        test(`${p.ruta}: el botón, «Analizando…», el refresco y cuándo se puede de nuevo`, async ({ page }, info) => {
          let lecturas = 0;
          let pedidos = 0;
          await page.route(API, async (ruta) => {
            if (ruta.request().method() === "POST") {
              pedidos += 1;
              expect(ruta.request().postDataJSON()).toEqual({ tarea: p.tipo.toUpperCase() });
              return ruta.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ estado: "ACEPTADO", lugar: "EN_CURSO" }) });
            }
            lecturas += 1;
            // La lectura inicial (0) está libre; durante el análisis, en curso; después, libre y con la espera mínima.
            const estado = pedidos === 0 ? LIBRE : lecturas <= 3 ? { ...LIBRE, enCurso: p.tipo.toUpperCase() } : { ...LIBRE, reintentarEnS: 120, ultimo: { tarea: p.tipo.toUpperCase(), estado: "PUBLICADO" } };
            return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ estado }) });
          });
          await abrir(page, info, p.ruta);
          const tarjeta = tarjetaDe(page, p.tipo);
          const boton = tarjeta.getByRole("button", { name: BOTON });
          await expect(boton).toBeVisible();
          await expect(boton).toBeEnabled();
          expect(await contraste(boton), "contraste del botón").toBeGreaterThanOrEqual(4.5);
          expect(await desborde(page)).toBeLessThanOrEqual(0);
          await boton.click();
          const estado = tarjeta.locator(".resumen-ia-analizar-estado");
          await expect(estado).toHaveText("Analizando…");
          await expect(boton).toBeDisabled();
          expect(await contraste(estado), "contraste del estado").toBeGreaterThanOrEqual(4.5);
          expect(await desborde(page)).toBeLessThanOrEqual(0);
          await expect(estado).toHaveText("Análisis listo. Puede volver a analizar en 2 min.", { timeout: 30_000 });
          await expect(boton).toBeDisabled();
          expect(pedidos).toBe(1);
          expect(prohibidasEn((await estado.textContent()) ?? "")).toEqual([]);
        });
      }
    });
  }

  test.describe("un clic de más", () => {
    // Las respuestas 429 y 503 son lo que se prueba: el navegador las registra como «Failed to load resource».
    test.use({ viewport: ANCHO_CELULAR, erroresEsperados: [/\/api\/ia\/analizar$/] });

    test("con uno en curso y otro en espera, el clic se descarta con un mensaje claro y el botón sigue disponible", async ({ page }, info) => {
      await page.route(API, (ruta) =>
        ruta.request().method() === "POST"
          ? ruta.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "x", codigo: "OCUPADO" }) })
          : ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ estado: LIBRE }) }));
      await abrir(page, info, "/");
      const tarjeta = tarjetaDe(page, "diario");
      await tarjeta.getByRole("button", { name: BOTON }).click();
      await expect(tarjeta.locator(".resumen-ia-analizar-estado")).toContainText("Ya hay un análisis en curso y otro en espera");
      await expect(tarjeta.getByRole("button", { name: BOTON })).toBeEnabled();
    });

    test("sin doble del servicio, la ruta real responde 503 (la app no tiene el servicio de IA en pruebas) y el botón lo dice", async ({ page }, info) => {
      await abrir(page, info, "/");
      const tarjeta = tarjetaDe(page, "diario");
      const respuesta = page.waitForResponse((r) => r.url().endsWith("/api/ia/analizar") && r.request().method() === "POST");
      await tarjeta.getByRole("button", { name: BOTON }).click();
      expect((await respuesta).status()).toBe(503);
      await expect(tarjeta.locator(".resumen-ia-analizar-estado")).toContainText("El servicio de análisis no responde");
    });
  });
});

test.describe("la tarjeta con el último análisis válido y su fecha", () => {
  // El botón lee el estado al cargar y la app de pruebas no tiene el servicio de IA (503): el navegador lo registra.
  test.use({ viewport: ANCHO_CELULAR, erroresEsperados: [/\/api\/ia\/analizar$/] });

  for (const tema of ["light", "dark"] as const) {
    test(`un análisis de AYER sale con su fecha y hora y el aviso de desactualizado · ${tema === "light" ? "claro" : "oscuro"}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: tema });
      await publicarDiarioDeAyer();
      await abrir(page, info, "/");
      const tarjeta = tarjetaDe(page, "diario");
      await expect(tarjeta).toHaveAttribute("data-estado", "IA");
      await expect(tarjeta.locator(".resumen-ia-analisis")).toHaveText(/^Análisis de la IA del \d{1,2}-[a-z]{3}-\d{4}, \d{2}:\d{2}$/);
      const aviso = tarjeta.locator(".resumen-ia-desactualizado");
      await expect(aviso).toHaveText("DESACTUALIZADO: los datos cambiaron desde este análisis.");
      expect(await contraste(aviso)).toBeGreaterThanOrEqual(4.5);
      expect(await contraste(tarjeta.locator(".resumen-ia-analisis"))).toBeGreaterThanOrEqual(4.5);
      await expect(tarjeta.locator(".resumen-ia-pie")).toContainText("cifras calculadas por Inversiones y cotejadas");
      await expect(tarjeta).not.toContainText("008");
      expect(await desborde(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("la familia (solo lectura)", () => {
  // Las respuestas 403 son lo que se prueba: el navegador las registra como «Failed to load resource».
  test.use({ viewport: ANCHO_CELULAR, erroresEsperados: [/\/api\/ia\/analizar$/] });

  test("no ve el botón en ninguna pantalla y la ruta le responde 403, aunque el interruptor esté encendido", async ({ page }, info) => {
    await guardarConfig(true);
    const cuenta = { email: `familiar-${sufijo(info)}@ejemplo.invalid`, clave: "clave-ficticia-familiar-e2e" };
    const { token } = await emitirAccesoFamiliar(baseE2E(), { email: cuenta.email, ahora: new Date() });
    await page.goto("about:blank");
    await page.goto(`/definir-clave#t=${token}&u=${encodeURIComponent(cuenta.email)}`);
    await page.getByLabel("Contraseña nueva").fill(cuenta.clave);
    await page.getByLabel("Repita la contraseña").fill(cuenta.clave);
    await page.getByRole("button", { name: "Definir contraseña" }).click();
    await expect(page.getByRole("status")).toContainText("Contraseña definida");
    await pasarClave(page, cuenta, "/totp/enrolar");
    await enrolarEnPagina(page, cuenta);
    for (const p of PANTALLAS) {
      await page.goto(p.ruta);
      await expect(tarjetaDe(page, p.tipo)).toBeVisible();
      await expect(page.getByRole("button", { name: BOTON })).toHaveCount(0);
    }
    // Desde el navegador (con su Origin y su sesión), como lo haría la pantalla.
    const respuestas = await page.evaluate(async () => {
      const pedido = await fetch("/api/ia/analizar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tarea: "DIARIO" }) });
      const estado = await fetch("/api/ia/analizar");
      return { pedido: pedido.status, estado: estado.status };
    });
    expect(respuestas).toEqual({ pedido: 403, estado: 403 });
  });
});
