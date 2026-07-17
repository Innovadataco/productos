import { test, expect } from "@playwright/test";

test.describe("Dashboard público", () => {
    test("carga la página y muestra las métricas", async ({ page }) => {
        await page.goto("/dashboard-publico");
        await expect(page).toHaveTitle(/Dashboard público/);
        await expect(page.getByRole("heading", { name: "Dashboard público" })).toBeVisible();
        await expect(page.getByText("Reportes registrados")).toBeVisible();
        await expect(page.locator("text=Identificadores visibles").first()).toBeVisible();
        await expect(page.getByText("Score promedio")).toBeVisible();
    });

    test("la API pública responde sin autenticación", async ({ request }) => {
        const response = await request.get("/api/estadisticas-publicas");
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty("totales");
        expect(body).toHaveProperty("porPlataforma");
        expect(body).toHaveProperty("porNivelRiesgo");
        expect(body).toHaveProperty("ultimosIdentificadores");
    });

    test("el dashboard es navegable desde el header", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("link", { name: "Dashboard", exact: false }).first().click();
        await expect(page).toHaveURL("/dashboard-publico");
    });
});
