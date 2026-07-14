import { test, expect, type Page } from "@playwright/test";

async function registrarUsuario(page: Page, email: string, password: string, nombre: string) {
    let devCode = "";
    await page.route("**/api/auth/verificar/solicitar", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (body.devCode) {
            devCode = body.devCode;
        }
        await route.fulfill({ response });
    });

    await page.goto("/registro");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByRole("button", { name: "Enviar código de verificación" }).click();
    await expect.poll(() => devCode).toHaveLength(6);
    await page.getByLabel("Código de verificación").fill(devCode);
    await page.getByLabel("Tu nombre").fill(nombre);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL("/mis-reportes");
}

test.describe("Restablecimiento de contraseña", () => {
    test("un usuario puede recuperar su contraseña y luego iniciar sesión", async ({ page }) => {
        const email = `e2e-reset-${Date.now()}@example.com`;
        const oldPassword = "TestPass123";
        const newPassword = "NewPass456";
        const nombre = "Usuario Reset";

        await registrarUsuario(page, email, oldPassword, nombre);

        let devToken = "";
        await page.route("**/api/auth/recuperar/solicitar", async (route) => {
            const response = await route.fetch();
            const body = await response.json();
            if (body.devToken) {
                devToken = body.devToken;
            }
            await route.fulfill({ response });
        });

        // 1. Solicitar recuperación
        await page.goto("/recuperar");
        await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible();
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();

        await expect(page.getByText("Si el email está registrado")).toBeVisible();
        expect(devToken).toHaveLength(64);

        // 2. Ir al enlace de recuperación
        await page.goto(`/recuperar/${devToken}`);
        await expect(page.getByRole("heading", { name: "Restablecer contraseña" })).toBeVisible();
        await expect(page.getByText("Ingresa tu nueva contraseña.")).toBeVisible();

        // 3. Restablecer contraseña
        await page.getByLabel("Nueva contraseña").fill(newPassword);
        await page.getByLabel("Confirmar contraseña").fill(newPassword);
        await page.getByRole("button", { name: "Restablecer contraseña" }).click();

        await expect(page.getByText("Contraseña actualizada correctamente.")).toBeVisible();

        // 4. Login con nueva contraseña
        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByLabel("Contraseña").fill(newPassword);
        await page.getByRole("button", { name: "Iniciar sesión" }).click();

        await page.waitForURL("/mis-reportes");
    });

    test("un token inválido o expirado muestra mensaje de error", async ({ page }) => {
        await page.goto("/recuperar/token-invalido");
        await expect(page.getByRole("heading", { name: "Restablecer contraseña" })).toBeVisible();
        await expect(page.getByText("El enlace no es válido o ha expirado.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Solicitar nuevo enlace" })).toBeVisible();
    });

    test("la respuesta de solicitud no revela si el email existe", async ({ page }) => {
        const existente = `e2e-exists-${Date.now()}@example.com`;
        const noExistente = `e2e-noexists-${Date.now()}@example.com`;

        await registrarUsuario(page, existente, "TestPass123", "Existente");

        let respuestaExistente: { message?: string; emailSent?: boolean } | null = null;
        await page.route("**/api/auth/recuperar/solicitar", async (route) => {
            const response = await route.fetch();
            respuestaExistente = await response.json();
            await route.fulfill({ response });
        });

        await page.goto("/recuperar");
        await page.getByLabel("Correo electrónico").fill(existente);
        await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
        await expect(page.getByText("Si el email está registrado")).toBeVisible();

        await page.unroute("**/api/auth/recuperar/solicitar");

        let respuestaNoExistente: { message?: string; emailSent?: boolean } | null = null;
        await page.route("**/api/auth/recuperar/solicitar", async (route) => {
            const response = await route.fetch();
            respuestaNoExistente = await response.json();
            await route.fulfill({ response });
        });

        await page.goto("/recuperar");
        await page.getByLabel("Correo electrónico").fill(noExistente);
        await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
        await expect(page.getByText("Si el email está registrado")).toBeVisible();

        const a = respuestaExistente as { message?: string; emailSent?: boolean } | null;
        const b = respuestaNoExistente as { message?: string; emailSent?: boolean } | null;
        expect(a?.message).toBe(b?.message);
        expect(a?.emailSent).not.toBe(b?.emailSent);
    });
});
