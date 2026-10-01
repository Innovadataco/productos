/**
 * SPEC-809 (Calidad) · Restablecimiento de contraseña, re-expresado contra el flujo REAL.
 *
 * Antes: el helper `registrarUsuario` conducía `/registro` esperando «Enviar código de verificación»
 * y «Código de verificación» (flujo de CÓDIGO), y el recorrido de reset leía `devToken` de
 * `recuperar/solicitar`. Dos problemas de la MISMA clase:
 *   · `/registro` del padre es hoy solo-correo por ENLACE (SPEC-339): esa UI de código no existe.
 *   · `devCode`/`devToken` solo llegan cuando el correo FALLA al salir (no-prod); en e2e el correo
 *     SÍ sale → vienen `undefined`. El verde dependía de un mailer roto.
 *
 * Ahora: la cuenta se crea por ENLACE (`registrarPadre`) y el token de recuperación se PLANTA por
 * Prisma (`plantarTokenRecuperacion`) — puerta SOLO de pruebas. Cero dependencia del camino de error.
 * El flujo de reset en sí (`/recuperar/[token]`) no se toca: es producto correcto.
 *
 * Las contraseñas son valores de PRUEBA del app bajo prueba (localhost), nunca credenciales reales.
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { registrarPadre, plantarTokenRecuperacion, limpiarPadre, type PadreRegistrado } from "./fixtures/registrar-padre";

const padresCreados: PadreRegistrado[] = [];

/**
 * Crea la cuenta del padre en un contexto EFÍMERO, no en el de la `page`: `registro/completar`
 * autologuea, y el recorrido de reset es de un usuario DESLOGUEADO (si la page quedara logueada,
 * `/recuperar` la redirige y no hay formulario). La sesión muere con el contexto; la page sigue limpia.
 */
async function crearCuentaPadre(email: string, password: string): Promise<PadreRegistrado> {
    const req = await playwrightRequest.newContext();
    try {
        return await registrarPadre({ request: req, email, password });
    } finally {
        await req.dispose();
    }
}

test.describe("Restablecimiento de contraseña", () => {
    test.afterAll(async () => {
        for (const p of padresCreados) await limpiarPadre(p);
        padresCreados.length = 0;
    });

    test("un usuario puede recuperar su contraseña y luego iniciar sesión", async ({ page }) => {
        const email = `e2e-reset-${Date.now()}@example.com`;
        const oldPassword = "TestPass123";
        const newPassword = "NewPass456";

        // Cuenta por ENLACE en contexto efímero: la page queda DESLOGUEADA para el flujo de reset.
        const padre = await crearCuentaPadre(email, oldPassword);
        padresCreados.push(padre);

        // 1. Solicitar recuperación — ejercita el endpoint real; la respuesta NO trae el token (anti-enum).
        await page.goto("/recuperar");
        await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible();
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
        // SPEC-623: estado de éxito único y genérico («Si el correo está registrado…», antes «email»).
        await expect(page.getByText("Si el correo está registrado")).toBeVisible();

        // 2. El token real vive hasheado en BD y NO se apoya en devToken (camino de error): se PLANTA
        //    uno válido por Prisma y se abre el enlace, como si hubiera llegado el correo.
        const token = await plantarTokenRecuperacion(padre);
        await page.goto(`/recuperar/${token}`);
        await expect(page.getByRole("heading", { name: "Restablecer contraseña" })).toBeVisible();
        await expect(page.getByText("Ingresa tu nueva contraseña.")).toBeVisible();

        // 3. Restablecer la contraseña.
        await page.getByLabel("Nueva contraseña").fill(newPassword);
        await page.getByLabel("Confirmar contraseña").fill(newPassword);
        await page.getByRole("button", { name: "Restablecer contraseña" }).click();
        await expect(page.getByText("Contraseña actualizada correctamente.")).toBeVisible();

        // 4. Login con la nueva contraseña.
        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByLabel("Contraseña").fill(newPassword);
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        // Login OK = salió de /login. Un padre recién creado (sin camino) aterriza en el onboarding, no
        // en /mis-reportes; lo que este test prueba es que la NUEVA contraseña autentica, no la pantalla.
        await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
    });

    test("un token inválido o expirado muestra mensaje de error", async ({ page }) => {
        await page.goto("/recuperar/token-invalido");
        await expect(page.getByRole("heading", { name: "Restablecer contraseña" })).toBeVisible();
        await expect(page.getByText("El enlace no es válido o ha expirado.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Solicitar nuevo enlace" })).toBeVisible();
    });

    test("la respuesta de solicitud no revela si el email existe (anti-enumeración, SPEC-630)", async ({ page }) => {
        const existente = `e2e-exists-${Date.now()}@example.com`;
        const noExistente = `e2e-noexists-${Date.now()}@example.com`;

        // Cuenta REAL plantada (contexto efímero): el caso «existente» es genuino, no simulado.
        const padre = await crearCuentaPadre(existente, "TestPass123");
        padresCreados.push(padre);

        const resExistente = await page.request.post("/api/auth/recuperar/solicitar", { data: { email: existente } });
        const resNoExistente = await page.request.post("/api/auth/recuperar/solicitar", { data: { email: noExistente } });
        expect(resExistente.status()).toBe(200);
        expect(resNoExistente.status()).toBe(200);

        const bodyExistente = await resExistente.json();
        const bodyNoExistente = await resNoExistente.json();
        // Anti-enum (SPEC-630): la respuesta es IDÉNTICA exista o no el correo.
        expect(bodyExistente).toEqual(bodyNoExistente);
        // Y NO revela el token aun para un correo REAL registrado (plantado arriba): el cuerpo es SOLO el
        // `message` — sin devToken ni ningún campo de token. Candado anti-fuga con el dato REAL, no por
        // ausencia de campo en un tipo.
        expect(Object.keys(bodyExistente).sort()).toEqual(["message"]);
        expect(typeof bodyExistente.message).toBe("string");
    });
});
