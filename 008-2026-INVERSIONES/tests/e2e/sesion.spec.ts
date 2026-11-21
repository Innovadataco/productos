/**
 * E2E del login de Inversiones (D-014) contra la base e2e sembrada por tests/e2e/sembrar.ts (el segundo
 * factor tiene su propio archivo, totp.spec.ts; aquí cada ingreso completo enrola una cuenta propia):
 * entrar, fallar, correo inexistente, bloqueo, la cookie, el enlace de un solo uso (vigente, usado y
 * vencido), salir, rutas protegidas, cabeceras, 404 con CSP, contraste y foco. Cada prueba que cambia una
 * cuenta crea la suya (tests/e2e/cuentas.ts) y llega con su propia IP (tests/e2e/sesion.ts): aguanta
 * `--repeat-each`. Cuentas y contraseñas inventadas.
 */
import { expect, type Page } from "@playwright/test";
import { emitirAcceso } from "../../src/auth/acceso";
import { DUENO_E2E } from "./base";
import { baseE2E, cerrarBaseE2E, crearCuenta } from "./cuentas";
import { PaginaIngreso, iniciarSesion, pasarClave, test } from "./sesion";

const GENERICO = "Usuario o contraseña incorrectos";
const ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pida uno nuevo.";
const OCHO_HORAS = 8 * 60 * 60;
const MIN = 60_000;

test.afterAll(async () => {
  await cerrarBaseE2E();
});

test.describe("ingreso", () => {
  test("con la clave correcta y el segundo factor entra al tablero, que se llama Inversiones", async ({ page }, info) => {
    await iniciarSesion(page, info, "entra");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Gano?");
    await expect(page).toHaveTitle(/^Inversiones/);
  });

  test("la cookie de sesión es __Host-sesion, HttpOnly, Secure, SameSite=Strict y de 8 h", async ({ page, context }, info) => {
    await iniciarSesion(page, info, "cookie");
    const sesion = (await context.cookies()).find((c) => c.name === "__Host-sesion");
    expect(sesion).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
    expect(Math.abs((sesion?.expires ?? 0) - (Date.now() / 1000 + OCHO_HORAS))).toBeLessThan(120);
  });

  test("con la clave incorrecta muestra el error genérico y no entra", async ({ page, context }) => {
    const p = await PaginaIngreso.abrir(page);
    await p.enviar({ email: DUENO_E2E.email, clave: "clave-equivocada-ficticia" });
    await expect(p.aviso).toHaveText(GENERICO);
    await expect(page).toHaveURL("/ingresar");
    expect((await context.cookies()).some((c) => c.name === "__Host-sesion")).toBe(false);
  });

  test("un correo que no existe recibe exactamente el mismo mensaje", async ({ page }) => {
    const p = await PaginaIngreso.abrir(page);
    await p.enviar({ email: "nadie-e2e@ejemplo.invalid", clave: DUENO_E2E.clave });
    await expect(p.aviso).toHaveText(GENERICO);
  });

  test("5 fallos bloquean la cuenta: después ni la clave correcta entra", async ({ page }, info) => {
    const cuenta = await crearCuenta(info, "bloqueo", true);
    const p = await PaginaIngreso.abrir(page);
    for (let k = 0; k < 5; k += 1) {
      await p.enviar({ email: cuenta.email, clave: `clave-equivocada-ficticia-${k}` });
      await expect(p.aviso).toHaveText(GENERICO);
      await expect(p.boton).not.toHaveAttribute("aria-disabled", "true");
    }
    await p.enviar(cuenta);
    await expect(p.aviso).toHaveText(GENERICO);
    await expect(page).toHaveURL("/ingresar");
  });

  test("el formulario no puede mandar la clave por la URL", async ({ page }) => {
    await PaginaIngreso.abrir(page);
    await expect(page.locator("form")).toHaveAttribute("method", "post");
  });

  test("mientras envía, el botón conserva el foco y queda aria-disabled", async ({ page }, info) => {
    const cuenta = await crearCuenta(info, "foco", true);
    let soltar: () => void = () => undefined;
    const retenido = new Promise<void>((r) => (soltar = r));
    await page.route("**/api/sesion/ingresar", async (ruta) => {
      await retenido;
      await ruta.continue();
    });
    const p = await PaginaIngreso.abrir(page);
    await p.correo.fill(cuenta.email);
    await p.clave.fill(cuenta.clave);
    await p.boton.focus();
    await page.keyboard.press("Enter");
    await expect(p.boton).toHaveAttribute("aria-disabled", "true");
    await expect(p.boton).toBeFocused();
    soltar();
    await expect(page).toHaveURL("/totp/enrolar");
  });
});

/** El botón con texto en tema claro y oscuro: contraste de al menos 4,5:1 (WCAG AA). */
async function contraste(page: Page): Promise<number> {
  return page.getByRole("button", { name: "Ingresar" }).evaluate((boton) => {
    const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const lineal = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luz = (c: string) => {
      const [r = 0, g = 0, b = 0] = rgb(c).map(lineal);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const estilo = getComputedStyle(boton);
    const [a, b] = [luz(estilo.color), luz(estilo.backgroundColor)].sort((x, y) => y - x);
    return ((a ?? 0) + 0.05) / ((b ?? 0) + 0.05);
  });
}

for (const tema of ["light", "dark"] as const) {
  test.describe(`contraste en tema ${tema === "light" ? "claro" : "oscuro"}`, () => {
    test.use({ colorScheme: tema });
    test("el botón de ingresar tiene al menos 4,5:1", async ({ page }) => {
      await PaginaIngreso.abrir(page);
      expect(await contraste(page)).toBeGreaterThanOrEqual(4.5);
    });
  });
}

test.describe("enlace de un solo uso", () => {
  const abrirEnlace = async (page: Page, token: string, email = "") => {
    await page.goto("about:blank");
    await page.goto(`/definir-clave#t=${token}${email ? `&u=${encodeURIComponent(email)}` : ""}`);
  };

  test("define la clave, quita el token de la barra, no sirve dos veces y la clave nueva entra", async ({ page }, info) => {
    const cuenta = await crearCuenta(info, "enlace", false);
    const { token } = await emitirAcceso(baseE2E(), { email: cuenta.email, ahora: new Date() });
    await abrirEnlace(page, token, cuenta.email);
    await expect(page).toHaveURL("/definir-clave");
    await expect(page.locator('input[autocomplete="username"]')).toHaveValue(cuenta.email);
    await page.getByLabel("Contraseña nueva").fill(cuenta.clave);
    await page.getByLabel("Repita la contraseña").fill(cuenta.clave);
    await page.getByRole("button", { name: "Definir contraseña" }).click();
    await expect(page.getByRole("status")).toContainText("Contraseña definida");

    await abrirEnlace(page, token);
    await page.getByLabel("Contraseña nueva").fill("otra-clave-ficticia-e2e");
    await page.getByLabel("Repita la contraseña").fill("otra-clave-ficticia-e2e");
    await page.getByRole("button", { name: "Definir contraseña" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(ENLACE_INVALIDO);
    await expect(page.getByRole("button", { name: "Definir contraseña" })).toHaveCount(0);

    // La clave nueva pasa el primer paso; como es el primer ingreso, toca enrolar el segundo factor.
    await pasarClave(page, cuenta, "/totp/enrolar");
  });

  test("un enlace vencido (más de 30 min) no sirve y lo dice", async ({ page }, info) => {
    const cuenta = await crearCuenta(info, "vencido", false);
    const { token } = await emitirAcceso(baseE2E(), { email: cuenta.email, ahora: new Date(Date.now() - 31 * MIN) });
    await abrirEnlace(page, token);
    await page.getByLabel("Contraseña nueva").fill(cuenta.clave);
    await page.getByLabel("Repita la contraseña").fill(cuenta.clave);
    await page.getByRole("button", { name: "Definir contraseña" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(ENLACE_INVALIDO);
    expect((await baseE2E().usuario.findUniqueOrThrow({ where: { email: cuenta.email } })).claveHash).toBeNull();
  });

  test("si la confirmación no coincide, lo marca en el campo y lo enfoca, sin gastar el enlace", async ({ page }, info) => {
    const cuenta = await crearCuenta(info, "confirma", false);
    const { token } = await emitirAcceso(baseE2E(), { email: cuenta.email, ahora: new Date() });
    await abrirEnlace(page, token);
    await page.getByLabel("Contraseña nueva").fill(cuenta.clave);
    await page.getByLabel("Repita la contraseña").fill(`${cuenta.clave}-distinta`);
    await page.getByRole("button", { name: "Definir contraseña" }).click();
    const confirmacion = page.getByLabel("Repita la contraseña");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Las contraseñas no coinciden.");
    await expect(confirmacion).toHaveAttribute("aria-invalid", "true");
    await expect(confirmacion).toBeFocused();
    await expect(page.getByLabel("Contraseña nueva")).not.toHaveAttribute("minlength");
  });

  test("sin token en el enlace lo avisa como alerta y no muestra el formulario", async ({ page }) => {
    await page.goto("/definir-clave");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("no trae su código");
    await expect(page.getByRole("button", { name: "Definir contraseña" })).toHaveCount(0);
  });
});

test.describe("rutas protegidas y salida", () => {
  test("sin sesión, el tablero lleva a /ingresar", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/ingresar");
  });

  test("sin sesión, una API protegida responde 401", async ({ request }) => {
    const r = await request.get("/api/plan");
    expect(r.status()).toBe(401);
    expect(await r.json()).toEqual({ error: "No autenticado" });
  });

  test("con sesión, /ingresar lleva al tablero", async ({ page }, info) => {
    await iniciarSesion(page, info, "con-sesion");
    await page.goto("/ingresar");
    await expect(page).toHaveURL("/");
  });

  test("«Salir» cierra la sesión con un solo pedido aunque se haga doble clic", async ({ page, context }, info) => {
    await iniciarSesion(page, info, "salir");
    const salidas: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/sesion/salir")) salidas.push(r.method());
    });
    await page.getByRole("button", { name: "Salir" }).dblclick();
    await expect(page).toHaveURL("/ingresar");
    expect(salidas).toEqual(["POST"]);
    expect((await context.cookies()).some((c) => c.name === "__Host-sesion")).toBe(false);
    await page.goto("/");
    await expect(page).toHaveURL("/ingresar");
  });

  test("las páginas llevan las cabeceras de seguridad y no se guardan en caché", async ({ page }, info) => {
    await iniciarSesion(page, info, "cabeceras");
    const r = await page.goto("/");
    const c = r?.headers() ?? {};
    expect(c["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(c["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(c["x-frame-options"]).toBe("DENY");
    expect(c["x-content-type-options"]).toBe("nosniff");
    expect(c["referrer-policy"]).toBe("no-referrer");
    expect(c["permissions-policy"]).toContain("camera=()");
    expect(c["strict-transport-security"]).toContain("max-age=63072000");
    expect(c["x-robots-tag"]).toBe("noindex, nofollow");
    expect(c["cache-control"]).toContain("no-store");
  });

  test.describe("404 con la CSP activa", () => {
    test.use({ erroresEsperados: [/\/no-existe$/] });
    test("una ruta que no existe responde 404, todo su HTML trae el nonce y no hay violaciones de CSP", async ({ page }, info) => {
      await page.addInitScript(() => {
        const w = window as unknown as { violaciones: string[] };
        w.violaciones = [];
        document.addEventListener("securitypolicyviolation", (e) => w.violaciones.push(`${e.violatedDirective} ${e.blockedURI}`));
      });
      await iniciarSesion(page, info, "no-existe");
      const r = await page.goto("/no-existe");
      expect(r?.status()).toBe(404);
      const nonce = /'nonce-([^']+)'/.exec(r?.headers()["content-security-policy"] ?? "")?.[1] ?? "";
      expect(nonce).not.toBe("");
      // Los <script> del HTML del servidor llevan el nonce; los que agrega el runtime pasan por strict-dynamic.
      const scripts = (await r?.text())?.match(/<script\b[^>]*>/g) ?? [];
      expect(scripts.length).toBeGreaterThan(0);
      for (const s of scripts) expect(s).toContain(`nonce="${nonce}"`);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => (window as unknown as { violaciones: string[] }).violaciones)).toEqual([]);
    });
  });
});
