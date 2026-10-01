/**
 * SPEC-809 (Calidad) · Autenticación E2E, re-expresada contra el flujo de ENLACE.
 *
 * ANTES: los dos tests registraban al usuario por la UI de CÓDIGO del colegio («Enviar código de
 * verificación» → «Ingresa el código de 6 dígitos» → `devCode`). Dos problemas de la MISMA clase que
 * el resto de SPEC-809:
 *   · Esa UI de código YA NO existe para el padre: desde SPEC-339 (A-67 §2.1) `/registro` es
 *     solo-correo por ENLACE.
 *   · `devCode` solo llega en NO-producción Y SOLO cuando el correo FALLA al salir; en e2e el correo
 *     SÍ sale → venía `undefined`. El verde dependía de un mailer roto.
 * Por eso `auth.spec.ts` estaba en el allowlist del candado `registro-padre-enlace`; este rewrite lo
 * saca en el MISMO commit (ratchet de salida autoexigida).
 *
 * AHORA:
 *  (1) Registro caminado por la UID del ENLACE: `/registro` (solo correo) → aviso genérico → token
 *      PLANTADO por Prisma (sin consumir; la anti-enum NO lo devuelve) → `/registro/crear-clave/[token]`
 *      → contraseña → auto-login → y, por separado, login con la contraseña recién creada.
 *  (2) No-admin bloqueado del panel admin, con la cuenta creada por ENLACE (no por código).
 *
 * Las contraseñas son valores de PRUEBA del app bajo prueba (localhost), nunca credenciales reales.
 */
import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { registrarPadre, plantarTokenRegistro, limpiarPadre, type PadreRegistrado } from "./fixtures/registrar-padre";

const padresCreados: PadreRegistrado[] = [];

test.describe("Autenticación", () => {
    test.afterAll(async () => {
        for (const p of padresCreados) await limpiarPadre(p);
        padresCreados.length = 0;
    });

    test("un usuario puede registrarse por el enlace y luego iniciar sesión", async ({ page }) => {
        const email = `e2e-auth-${Date.now()}@example.com`;
        const password = "TestPass123";

        // 1. `/registro` es solo-correo (SPEC-339). El input vive en `CampoCorreoDominio`: su aria-label es
        //    «<label>: nombre de usuario». Tecleado el correo COMPLETO, el componente lo parsea y arma
        //    «local@dominio» (un dominio no-atajo como example.com cae en modo «Otro», que es válido).
        await page.goto("/registro");
        await page.getByLabel("Tu correo: nombre de usuario").fill(email);
        await page.getByRole("button", { name: "Continuar" }).click();

        // 2. Aviso genérico (anti-enum SPEC-338): idéntico exista o no el correo; NO trae el token.
        await expect(page.getByRole("heading", { name: "Te escribimos" })).toBeVisible();

        // 3. En e2e el correo SÍ sale → no hay `devCode`/`devToken`. El token se PLANTA por Prisma (puerta
        //    solo-pruebas que simula «llegó el correo») SIN consumirlo: lo consume la UI de crear-clave.
        const { token, registroId } = await plantarTokenRegistro(email);

        // 4. Abrir el enlace y elegir contraseña (las dos condiciones del brief: ≥8 con letra y número ·
        //    coinciden; el botón queda apagado hasta cumplirlas).
        await page.goto(`/registro/crear-clave/${token}`);
        await expect(page.getByRole("heading", { name: "Elige tu contraseña" })).toBeVisible();
        await page.getByLabel("Contraseña").fill(password);
        await page.getByLabel("Repítela").fill(password);
        await page.getByRole("button", { name: "Guardar y empezar" }).click();

        // 5. `completar` crea la cuenta, sella la cookie de sesión y hace navegación DURA (I-411). Un padre
        //    recién creado tiene el CAMINO de onboarding pendiente: el middleware lo lleva del /dashboard/padre
        //    optimista a su paso (/camino/…). Que aterrice en una ruta AUTENTICADA —fuera de /registro y SIN
        //    rebotar a /login— prueba que la cuenta quedó creada y con sesión (si no, /dashboard/padre
        //    rebotaría a /login por el Paso 2 del middleware).
        await page.waitForURL(
            (u) => !u.pathname.startsWith("/registro") && !u.pathname.startsWith("/login"),
            { timeout: 15_000 },
        );

        // Rastro para limpieza: la cuenta la creó la UI; se recupera por email. `registroId` cubre el token
        // plantado (si `completar` ya lo borró, el deleteMany de limpieza es no-op).
        const usuario = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
        expect(usuario, "la UI de crear-clave debió crear el Usuario").not.toBeNull();
        padresCreados.push({
            usuarioId: usuario!.id,
            email,
            _limpieza: { usuarios: [usuario!.id], tokensRegistro: [registroId], tokensRecuperacion: [] },
        });

        // 6. «luego iniciar sesión»: se limpia la sesión del auto-login y se entra con la contraseña recién
        //    creada — lo que prueba este test es que esa contraseña AUTENTICA.
        await page.context().clearCookies();
        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByLabel("Contraseña").fill(password);
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        // Login OK = salió de /login (un padre sin camino aterriza en el onboarding, no en un panel; lo que
        // se afirma es la autenticación, no la pantalla de destino).
        await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
    });

    test("un usuario no-admin no puede acceder al panel admin", async ({ page }) => {
        const email = `e2e-auth-denied-${Date.now()}@example.com`;
        // Cuenta no-admin (PARENT) por ENLACE. `page.request` comparte las cookies del navegador, así la
        // `page` queda AUTENTICADA como PARENT (no el fixture `request`, que es otro contexto).
        const padre = await registrarPadre({ request: page.request, email, password: "TestPass123" });
        padresCreados.push(padre);

        await page.goto("/dashboard/admin");
        // Un PARENT no aterriza NUNCA en el panel: la guardia de rol por página (`verifyAuth`, SPEC-571) y
        // el gate de onboarding del middleware lo desvían. Se afirma la invariante robusta: NO queda en
        // /dashboard/admin.
        await expect(page).not.toHaveURL("/dashboard/admin");
    });
});
