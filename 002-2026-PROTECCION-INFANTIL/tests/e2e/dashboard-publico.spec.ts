import { test, expect } from "@playwright/test";

test.describe("Dashboard público", () => {
    test("carga la página y muestra las métricas", async ({ page }) => {
        await page.goto("/dashboard-publico");
        await expect(page).toHaveTitle(/Dashboard público/); // metadata (sin cambio)
        // El H1 es COPY de Diseño (hoy «Lo que estamos viendo entre todos»): se afirma el
        // ELEMENTO por id, no la frase, para no romperse con un ajuste de copy.
        await expect(page.locator("#public-dashboard-title")).toBeVisible();
        // KPIs del contrato ACTUAL: «Reportes registrados» + «Cuentas visibles» (antes
        // «Identificadores visibles», renombrado).
        await expect(page.getByText("Reportes registrados")).toBeVisible();
        await expect(page.getByText("Cuentas visibles")).toBeVisible();
        // PRIVACIDAD (I-29/SPEC-139): el dashboard público NO muestra score. Candado de
        // no-regresión (antes el test exigía «Score promedio», que se retiró a propósito).
        await expect(page.getByText(/score promedio/i)).toHaveCount(0);
    });

    test("la API pública responde sin autenticación", async ({ request }) => {
        const response = await request.get("/api/estadisticas-publicas");
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty("totales");
        expect(body).toHaveProperty("porPlataforma");
        // Contrato NUEVO (EstadisticasService.publicas): el desglose de riesgo se expone como
        // `porGrupoCategoria`; `porNivelRiesgo` se retiró. Candado del contrato nuevo.
        expect(body).toHaveProperty("porGrupoCategoria");
        // Y candado de PRIVACIDAD (I-29/SPEC-139): la API pública expone solo AGREGADOS — NUNCA
        // una lista de identificadores (`ultimosIdentificadores`) ni el score. No deben reaparecer.
        expect(body).not.toHaveProperty("ultimosIdentificadores");
        expect(body).not.toHaveProperty("scorePromedio");
    });

    test("el dashboard es navegable desde el header", async ({ page }) => {
        await page.goto("/");
        // El enlace del header a la vista pública (hoy «Estadísticas públicas»): se localiza por
        // HREF, robusto al label de Diseño (antes «Dashboard»).
        await page.locator('a[href="/dashboard-publico"]').first().click();
        await expect(page).toHaveURL("/dashboard-publico");
    });
});
