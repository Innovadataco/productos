/**
 * E2E del segundo factor (TOTP del dueño) contra la base e2e: enrolar en el primer ingreso (después del
 * enlace de un solo uso), entrar con el código de la app, el antireplay, los códigos de recuperación (un
 * solo uso, y regenerarlos), la pre-sesión que no sirve como sesión, el bloqueo y el plazo de 30 min para
 * enrolar. El código se calcula en la prueba desde la clave base32 que muestra la página. Cada prueba usa
 * su cuenta y su IP (tests/e2e/sesion.ts): aguanta `--repeat-each`. Todo inventado.
 */
import { expect } from "@playwright/test";
import { emitirAcceso } from "../../src/auth/acceso";
import { firmarPresesion, generarJti, hashJti } from "../../src/auth/presesion";
import { hashCodigoRecuperacion, normalizarCodigoRecuperacion } from "../../src/auth/recuperacion";
import { decodificarBase32, hotp, pasoDe } from "../../src/auth/totp";
import { secretoSesionE2E } from "./base";
import { baseE2E, cerrarBaseE2E, crearCuenta } from "./cuentas";
import { PaginaCodigo, PaginaIngreso, codigoQueEntra, enrolarEnPagina, entrarConTotp, iniciarSesion, pasarClave, test } from "./sesion";

const INCORRECTO = "Código incorrecto";

test.afterAll(async () => {
  await cerrarBaseE2E();
});

/** Cierra la sesión con el botón del tablero. */
async function salir(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL("/ingresar");
}

/** Un código de 6 dígitos que no vale ahora (ni en el paso anterior ni en el siguiente). */
function codigoMalo(secreto: Buffer): string {
  const validos = new Set([-1, 0, 1].map((d) => hotp(secreto, pasoDe(Date.now()) + d)));
  for (let k = 0; ; k += 1) {
    const c = String(k).padStart(6, "0");
    if (!validos.has(c)) return c;
  }
}

const resultados = async (email: string) =>
  (
    await baseE2E().intentoIngreso.findMany({
      where: { usuario: { email } },
      orderBy: [{ ocurridoEn: "asc" }, { id: "asc" }],
      select: { resultado: true },
    })
  ).map((r) => r.resultado);

test.describe("enrolamiento en el primer ingreso", () => {
  test("enlace → clave → QR y clave base32 → código → 10 códigos una sola vez → tablero", async ({ page, context }, info) => {
    const cuenta = await crearCuenta(info, "enrolar", false);
    const { token } = await emitirAcceso(baseE2E(), { email: cuenta.email, ahora: new Date() });
    await page.goto(`/definir-clave#t=${token}&u=${encodeURIComponent(cuenta.email)}`);
    await page.getByLabel("Contraseña nueva").fill(cuenta.clave);
    await page.getByLabel("Repita la contraseña").fill(cuenta.clave);
    await page.getByRole("button", { name: "Definir contraseña" }).click();
    await expect(page.getByRole("status")).toContainText("Contraseña definida");

    await pasarClave(page, cuenta, "/totp/enrolar");
    // La pre-sesión es otra cookie, también __Host- y de 5 min; todavía no hay sesión.
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "__Host-presesion")).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
    expect(cookies.some((c) => c.name === "__Host-sesion")).toBe(false);

    const enrolada = await enrolarEnPagina(page, cuenta);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Gano?");
    const vigentes = await baseE2E().codigoRecuperacion.findMany({ where: { usuario: { email: cuenta.email }, usadoEn: null, anuladoEn: null } });
    expect(vigentes.map((v) => v.codigoHash).sort()).toEqual(
      enrolada.codigos.map((c) => hashCodigoRecuperacion(normalizarCodigoRecuperacion(c) ?? "")).sort(),
    );
    // Los códigos no se vuelven a mostrar: la pre-sesión se gastó y /totp/enrolar ya no muestra nada
    // (lleva a /ingresar, que con la sesión abierta lleva al tablero).
    expect((await context.cookies()).some((c) => c.name === "__Host-presesion")).toBe(false);
    await page.goto("/totp/enrolar");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("list", { name: "Códigos de recuperación" })).toHaveCount(0);
  });

  test("un código errado al enrolar lo marca, no activa nada y deja reintentar", async ({ page }, info) => {
    const cuenta = await crearCuenta(info, "enrolar-malo", true);
    await pasarClave(page, cuenta, "/totp/enrolar");
    const secreto = decodificarBase32(((await page.locator("[data-clave-totp]").textContent()) ?? "").replace(/\s+/g, ""));
    const p = await PaginaCodigo.de(page, "Activar");
    await p.enviar(codigoMalo(secreto ?? Buffer.alloc(20)));
    await expect(p.aviso).toHaveText(INCORRECTO);
    await expect(p.campo).toHaveAttribute("aria-invalid", "true");
    expect((await baseE2E().usuario.findUniqueOrThrow({ where: { email: cuenta.email } })).totpActivadoEn).toBeNull();
    await enrolarEnPagina(page, cuenta);
  });

  test("pasados 30 min desde el enlace no enrola y dice cómo volver a abrir el plazo", async ({ page }, info) => {
    const cuenta = await crearCuenta(info, "plazo", true, { claveDefinidaHaceMin: 31 });
    await pasarClave(page, cuenta, "/totp/enrolar");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("--reiniciar-totp");
    await expect(page.getByRole("img", { name: "Código QR para la app autenticadora" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Activar" })).toHaveCount(0);
  });
});

test.describe("ingreso con el segundo factor", () => {
  test("con la clave y el código de la app entra al tablero", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "totp");
    await salir(page);
    await entrarConTotp(page, cuenta);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Gano?");
  });

  test("antireplay: el mismo código no entra dos veces y queda TOTP_REPETIDO", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "replay");
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    const codigo = await codigoQueEntra(page, cuenta);
    await (await PaginaCodigo.de(page, "Verificar")).enviar(codigo);
    await expect(page).toHaveURL("/");
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    const p = await PaginaCodigo.de(page, "Verificar");
    await p.enviar(codigo);
    await expect(p.aviso).toHaveText(INCORRECTO);
    await expect(page).toHaveURL("/totp");
    expect((await resultados(cuenta.email)).at(-1)).toBe("TOTP_REPETIDO");
  });

  test("con un código de recuperación entra, avisa cuántos quedan y ese código ya no sirve", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "recuperacion");
    const [codigo = ""] = cuenta.codigos;
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    await page.getByRole("button", { name: "Usar un código de recuperación" }).click();
    const p = await PaginaCodigo.de(page, "Verificar");
    await expect(p.campo).toBeFocused();
    await p.enviar(codigo.toLowerCase());
    await expect(page.getByRole("status")).toContainText("Le quedan 9");
    await page.getByRole("link", { name: "Ir al tablero" }).click();
    await expect(page).toHaveURL("/");

    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    await page.getByRole("button", { name: "Usar un código de recuperación" }).click();
    const otra = await PaginaCodigo.de(page, "Verificar");
    await otra.enviar(codigo);
    await expect(otra.aviso).toHaveText(INCORRECTO);
    // El código gastado no abrió nada: sin sesión, el tablero sigue cerrado.
    expect((await page.context().cookies()).some((c) => c.name === "__Host-sesion")).toBe(false);
    await page.goto("/");
    await expect(page).toHaveURL("/ingresar");
  });

  test("al abrir /totp el campo ya tiene el foco; cambiar de modo lo vacía y lo enfoca", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "foco-totp");
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    const p = await PaginaCodigo.de(page, "Verificar");
    await expect(p.campo).toBeFocused();
    await p.campo.fill("123");
    await page.getByRole("button", { name: "Usar un código de recuperación" }).click();
    await expect(p.campo).toHaveValue("");
    await expect(p.campo).toBeFocused();
  });

  test("el código con espacios («123 456») entra igual", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "espacios");
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    const codigo = await codigoQueEntra(page, cuenta);
    await (await PaginaCodigo.de(page, "Verificar")).enviar(`${codigo.slice(0, 3)} ${codigo.slice(3)}`);
    await expect(page).toHaveURL("/");
  });

  test("5 códigos errados bloquean la cuenta: después ni el código correcto entra", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "bloqueo-totp");
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    const p = await PaginaCodigo.de(page, "Verificar");
    for (let k = 0; k < 5; k += 1) {
      await p.enviar(codigoMalo(cuenta.secreto));
      await expect(p.aviso).toHaveText(INCORRECTO);
      await expect(p.boton).not.toHaveAttribute("aria-disabled", "true");
    }
    await p.enviar(await codigoQueEntra(page, cuenta));
    await expect(p.aviso).toHaveText(INCORRECTO);
    await expect(page).toHaveURL("/totp");
    expect((await baseE2E().usuario.findUniqueOrThrow({ where: { email: cuenta.email } })).bloqueadoHasta).not.toBeNull();
    expect(await resultados(cuenta.email)).toContain("BLOQUEO_SEGUNDO_PASO");
  });
});

/** El estado de un pedido a /api/plan hecho DESDE el navegador (lleva las cookies de la página). */
const estadoApi = (page: import("@playwright/test").Page): Promise<number> => page.evaluate(async () => (await fetch("/api/plan")).status);

test.describe("la pre-sesión no es una sesión", () => {
  // El navegador registra el 401 de /api/plan: es lo esperado.
  test.use({ erroresEsperados: [/\/api\/plan$/] });

  test("con solo la clave, el tablero y las API protegidas siguen cerradas", async ({ page, context }, info) => {
    const cuenta = await iniciarSesion(page, info, "presesion");
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    await page.goto("/");
    await expect(page).toHaveURL("/ingresar");
    await page.goto("/totp/codigos");
    await expect(page).toHaveURL("/ingresar");
    expect((await context.cookies()).some((c) => c.name === "__Host-presesion")).toBe(true);
    expect(await estadoApi(page)).toBe(401);
    expect((await context.cookies()).some((c) => c.name === "__Host-sesion")).toBe(false);
  });

  test("la pre-sesión copiada en la cookie de la sesión no abre nada", async ({ page, context }, info) => {
    const cuenta = await iniciarSesion(page, info, "copiada");
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    const pre = (await context.cookies()).find((c) => c.name === "__Host-presesion")?.value ?? "";
    expect(pre).not.toBe("");
    // La copia la escribe la propia página (no HttpOnly; el servidor no distingue): así viaja como la sesión.
    await page.evaluate((valor) => {
      document.cookie = `__Host-sesion=${valor}; Path=/; Secure; SameSite=Strict`;
    }, pre);
    expect((await context.cookies()).find((c) => c.name === "__Host-sesion")?.value).toBe(pre);
    expect(await estadoApi(page)).toBe(401);
    await page.goto("/");
    await expect(page).toHaveURL("/ingresar");
  });

  test("sin pre-sesión, /totp lleva a /ingresar", async ({ page }) => {
    await page.goto("/totp");
    await expect(page).toHaveURL("/ingresar");
  });
});

test.describe("pre-sesión vencida", () => {
  /** Pone una pre-sesión firmada por la prueba (con el secreto de la corrida) y la deja vigente en la base. */
  async function ponerPresesion(page: import("@playwright/test").Page, email: string, firmadaHaceMs: number): Promise<void> {
    const u = await baseE2E().usuario.findUniqueOrThrow({ where: { email } });
    const jti = generarJti();
    await baseE2E().usuario.update({ where: { id: u.id }, data: { presesionHash: hashJti(jti) } });
    const token = await firmarPresesion({ sub: u.id, sesionVersion: u.sesionVersion, jti }, new TextEncoder().encode(secretoSesionE2E()), Date.now() - firmadaHaceMs);
    await page.goto("/ingresar");
    await page.evaluate((valor) => {
      document.cookie = `__Host-presesion=${valor}; Path=/; Secure; SameSite=Strict`;
    }, token);
  }

  test("una pre-sesión de hace 6 min ya no sirve: /totp lleva a /ingresar y el POST pide volver a ingresar", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "vencida");
    await salir(page);
    // Control: la misma pre-sesión recién firmada sí abre /totp (prueba que el secreto es el de la app).
    await ponerPresesion(page, cuenta.email, 0);
    await page.goto("/totp");
    await expect(page.getByRole("button", { name: "Verificar" })).toBeVisible();

    await ponerPresesion(page, cuenta.email, 6 * 60_000);
    const r = await page.evaluate(async (codigo) => {
      const x = await fetch("/api/sesion/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }) });
      return { estado: x.status, cuerpo: (await x.json()) as unknown };
    }, await codigoQueEntra(page, cuenta));
    expect(r).toEqual({ estado: 401, cuerpo: { error: "La verificación venció. Ingrese de nuevo.", reingresar: true } });
    await page.goto("/totp");
    await expect(page).toHaveURL("/ingresar");
  });
});

test.describe("formularios del segundo paso", () => {
  /**
   * En la página, apenas la API responde bien, vuelve a enviar el formulario (como un segundo Enter) a los
   * 100 ms, cuando la navegación siguiente ya arrancó pero sigue retenida. Lo hace la propia página: un
   * `press` o un `evaluate` de Playwright esperarían a que esa navegación termine.
   */
  const reenviarTrasExito = (page: import("@playwright/test").Page, api: string) =>
    page.addInitScript((ruta) => {
      const original = window.fetch.bind(window);
      let hecho = false;
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const r = await original(...args);
        if (!hecho && r.ok && String(args[0]).endsWith(ruta)) {
          hecho = true;
          setTimeout(() => document.querySelector("form")?.requestSubmit(), 100);
        }
        return r;
      };
    }, api);

  /** Retiene la carga de `ruta` hasta que se suelte (la navegación queda a medias). */
  async function retenerNavegacion(page: import("@playwright/test").Page, ruta: string): Promise<() => void> {
    let soltar: () => void = () => undefined;
    const retenido = new Promise<void>((r) => (soltar = r));
    await page.route((url) => url.pathname === ruta, async (r) => {
      await retenido;
      await r.continue();
    });
    return soltar;
  }

  const contar = (page: import("@playwright/test").Page, api: string): string[] => {
    const envios: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith(api)) envios.push(r.method());
    });
    return envios;
  };

  test("después de entrar, un segundo envío mientras navega no reenvía el código", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "doble-enter");
    await salir(page);
    await reenviarTrasExito(page, "/api/sesion/totp");
    await pasarClave(page, cuenta, "/totp");
    const soltar = await retenerNavegacion(page, "/");
    const envios = contar(page, "/api/sesion/totp");
    const p = await PaginaCodigo.de(page, "Verificar");
    await p.campo.fill(await codigoQueEntra(page, cuenta));
    await p.boton.click();
    await page.waitForTimeout(800);
    expect(envios).toEqual(["POST"]);
    soltar();
    await expect(page).toHaveURL("/");
  });

  test("después de pasar la clave, un segundo envío mientras navega no la reenvía", async ({ page }, info) => {
    const cuenta = await crearCuenta(info, "doble-enter-clave", true);
    await reenviarTrasExito(page, "/api/sesion/ingresar");
    const soltar = await retenerNavegacion(page, "/totp/enrolar");
    const envios = contar(page, "/api/sesion/ingresar");
    const p = await PaginaIngreso.abrir(page);
    await p.correo.fill(cuenta.email);
    await p.clave.fill(cuenta.clave);
    await p.boton.click();
    await page.waitForTimeout(800);
    expect(envios).toEqual(["POST"]);
    soltar();
    await expect(page).toHaveURL("/totp/enrolar");
  });

  test.describe("copiar al portapapeles", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("la clave base32 (sin espacios) y los 10 códigos se copian y lo anuncia", async ({ page }, info) => {
      const cuenta = await crearCuenta(info, "copiar", true);
      await pasarClave(page, cuenta, "/totp/enrolar");
      const base32 = ((await page.locator("[data-clave-totp]").textContent()) ?? "").replace(/\s+/g, "");
      await page.getByRole("button", { name: "Copiar la clave" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Clave copiada" })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(base32);

      const secreto = decodificarBase32(base32) ?? Buffer.alloc(20);
      await (await PaginaCodigo.de(page, "Activar")).enviar(hotp(secreto, pasoDe(Date.now())));
      const items = page.getByRole("list", { name: "Códigos de recuperación" }).getByRole("listitem");
      await expect(items).toHaveCount(10);
      await page.getByRole("button", { name: "Copiar los códigos" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Códigos copiados" })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe((await items.allTextContents()).join("\n"));
    });

    test("si el portapapeles falla, lo dice y pide copiarlos a mano", async ({ page }, info) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("sin permiso")) } });
      });
      const cuenta = await crearCuenta(info, "copiar-falla", true);
      await pasarClave(page, cuenta, "/totp/enrolar");
      await page.getByRole("button", { name: "Copiar la clave" }).click();
      await expect(page.getByRole("status").filter({ hasText: "No se pudo copiar" })).toBeVisible();
    });
  });
});

test.describe("regenerar los códigos de recuperación", () => {
  test("con un código errado no cambia nada y lo dice", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "regenerar-malo");
    const antes = await baseE2E().codigoRecuperacion.findMany({ where: { usuario: { email: cuenta.email }, usadoEn: null, anuladoEn: null }, select: { id: true } });
    await page.goto("/totp/codigos");
    const p = await PaginaCodigo.de(page, "Generar códigos nuevos");
    await p.enviar(codigoMalo(cuenta.secreto));
    await expect(p.aviso).toHaveText(INCORRECTO);
    await expect(page.getByRole("list", { name: "Códigos de recuperación" })).toHaveCount(0);
    const despues = await baseE2E().codigoRecuperacion.findMany({ where: { usuario: { email: cuenta.email }, usadoEn: null, anuladoEn: null }, select: { id: true } });
    expect(despues).toEqual(antes);
  });

  test("con la sesión y un código de la app da 10 nuevos y los anteriores dejan de servir", async ({ page }, info) => {
    const cuenta = await iniciarSesion(page, info, "regenerar");
    await page.goto("/totp/codigos");
    const p = await PaginaCodigo.de(page, "Generar códigos nuevos");
    await p.enviar(await codigoQueEntra(page, cuenta));
    const lista = page.getByRole("list", { name: "Códigos de recuperación" });
    await expect(lista.getByRole("listitem")).toHaveCount(10);
    const nuevos = await lista.getByRole("listitem").allTextContents();
    expect(nuevos.some((c) => cuenta.codigos.includes(c))).toBe(false);
    // Un solo título «Códigos de recuperación» (el h1) y, ya generados, sin la nota de antes.
    await expect(page.getByRole("heading", { name: "Códigos de recuperación", exact: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Sus códigos nuevos" })).toBeVisible();
    await expect(page.getByText("Generar códigos nuevos anula los anteriores")).toHaveCount(0);

    await page.goto("/");
    await salir(page);
    await pasarClave(page, cuenta, "/totp");
    await page.getByRole("button", { name: "Usar un código de recuperación" }).click();
    const viejo = await PaginaCodigo.de(page, "Verificar");
    await viejo.enviar(cuenta.codigos[0] ?? "");
    await expect(viejo.aviso).toHaveText(INCORRECTO);
    await viejo.enviar(nuevos[0] ?? "");
    await expect(page.getByRole("status")).toContainText("Le quedan 9");
  });
});
