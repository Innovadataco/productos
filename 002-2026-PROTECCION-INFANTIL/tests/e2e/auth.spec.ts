import { test, expect } from "@playwright/test";

test.describe("Flujo de autenticación", () => {
    test("un usuario puede registrarse y luego iniciar sesión", async ({ page }) => {
        const email = `e2e-${Date.now()}@example.com`;
        const password = "TestPass123";
        const nombre = "Usuario E2E";

        // Interceptar respuesta de solicitud de código para obtener devCode
        let devCode = "";
        await page.route("**/api/auth/verificar/solicitar", async (route) => {
            const response = await route.fetch();
            const body = await response.json();
            if (body.devCode) {
                devCode = body.devCode;
            }
            await route.fulfill({ response });
        });

        // 1. Ir a registro
        await page.goto("/registro");
        await expect(page.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();

        // 2. Ingresar email y solicitar código
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByRole("button", { name: "Enviar código de verificación" }).click();

        // 3. Verificar que pasamos al paso de verificación
        await expect(page.getByText("Ingresa el código de 6 dígitos")).toBeVisible();
        await expect(devCode).toHaveLength(6);

        // 4. Completar registro
        await page.getByLabel("Código de verificación").fill(devCode);
        await page.getByLabel("Tu nombre").fill(nombre);
        await page.getByLabel("Contraseña").fill(password);
        await page.getByRole("button", { name: "Crear cuenta" }).click();

        // 5. Debe redirigir a mis-reportes
        await expect(page).toHaveURL("/mis-reportes");
        await expect(page.getByRole("heading", { name: "Mis reportes" })).toBeVisible();

        // 6. Logout
        await page.goto("/api/auth/logout");

        // 7. Login con la nueva cuenta
        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByLabel("Contraseña").fill(password);
        await page.getByRole("button", { name: "Iniciar sesión" }).click();

        await expect(page).toHaveURL("/mis-reportes");
    });

    test("un usuario no-admin no puede acceder al panel admin", async ({ page }) => {
        const email = `e2e-parent-${Date.now()}@example.com`;
        const password = "TestPass123";

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

        await expect(page.getByText("Ingresa el código de 6 dígitos")).toBeVisible();
        await expect(devCode).toHaveLength(6);

        await page.getByLabel("Código de verificación").fill(devCode);
        await page.getByLabel("Tu nombre").fill("Padre E2E");
        await page.getByLabel("Contraseña").fill(password);
        await page.getByRole("button", { name: "Crear cuenta" }).click();

        await expect(page).toHaveURL("/mis-reportes");

        // Intentar acceder al panel admin
        await page.goto("/dashboard/admin");
        await expect(page).not.toHaveURL("/dashboard/admin");
        await expect(page).toHaveURL("/");
    });
});
