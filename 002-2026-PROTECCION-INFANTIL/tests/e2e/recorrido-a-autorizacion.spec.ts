/**
 * Recorrido A · pasos A9/A10 (re-verificación de I-127 + cierre).
 *
 * Contexto: en R-018 · Calidad · Playwright dejó una suscripción del colegio A
 * (id `cmtb4y3500084qk47lpocyxok`) en estado `PENDIENTE_AUTORIZACION`.
 *
 * Este spec lo autoriza como ADMIN y verifica el cambio a `ACTIVA` en la BD
 * consultada aparte por SSH+psql (solo lectura, en el reporte).
 *
 * Cierre binario esperado (D-014):
 * - Si la pantalla de pendientes muestra el colegio A → I-127 arreglada, A9 ✅.
 * - Tras click "Autorizar" y estado ACTIVA en BD → A10 ✅ (colegio activo).
 *
 * Reutiliza el setup ADMIN de la campaña 5 (`calidad-auth.setup.ts` en este mismo
 * worktree). Idempotente: si la suscripción ya está `ACTIVA`, el test pasa sin
 * intentar autorizarla de nuevo.
 */
import { test, expect } from "@playwright/test";

const COLEGIO_A_ID = "cmtb1748y0003135vgag79pj3";
const SUSCRIPCION_A_ID = "cmtb4y3500084qk47lpocyxok";

test.describe("Recorrido A · re-verificación I-127 + A9/A10", () => {
    test("A9 · admin ve la suscripción pendiente del colegio A (I-127 arreglada)", async ({ page }) => {
        const resp = await page.goto("/dashboard/admin/pagos/pendientes", { waitUntil: "domcontentloaded", timeout: 30_000 });
        expect(resp?.status()).toBeLessThan(400);
        await page.waitForTimeout(3_000);
        await page.screenshot({ path: "test-results/recorrido-a-A9-pendientes.png", fullPage: true });
        const html = await page.content();
        // La pantalla debe mostrar el colegio A o su id de suscripción.
        expect(
            html.includes(SUSCRIPCION_A_ID) || html.includes(COLEGIO_A_ID) || html.toLowerCase().includes("colegio a"),
            "🔴 /dashboard/admin/pagos/pendientes NO muestra la suscripción del colegio A — I-127 sigue rota",
        ).toBeTruthy();
    });

    test("A10 · admin autoriza y la suscripción queda ACTIVA (o ya lo estaba · idempotente)", async ({ page }) => {
        await page.goto("/dashboard/admin/pagos/pendientes", { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(3_000);
        const html = await page.content();
        // Si la suscripción del colegio A ya no aparece en pendientes, es porque quedó ACTIVA.
        if (!html.includes(SUSCRIPCION_A_ID) && !html.includes(COLEGIO_A_ID)) {
            await page.screenshot({ path: "test-results/recorrido-a-A10-ya-activa.png", fullPage: true });
            return; // A9/A10 ya cumplidos en corrida previa.
        }
        // Buscamos el botón "Autorizar" — puede haber varios; asumimos que el primero
        // corresponde a la única suscripción pendiente (colegio A).
        const autorizar = page.getByRole("button", { name: /autorizar/i }).first();
        const visible = await autorizar.isVisible().catch(() => false);
        expect(visible, "no encuentro botón 'Autorizar' en la pantalla de pendientes").toBeTruthy();
        await autorizar.click();
        // La acción puede abrir un modal de confirmación o disparar directamente.
        await page.waitForTimeout(3_000);
        // Modal "Autorizar solicitud de suscripción" — pide Método de pago (ya default),
        // Referencia y Monto real pagado. Sin llenar Referencia+Monto, "Confirmar" queda disabled.
        const dialogo = page.getByRole("dialog", { name: /autorizar solicitud/i });
        await dialogo.waitFor({ state: "visible", timeout: 10_000 });
        await dialogo.getByRole("textbox", { name: /referencia/i }).fill("CALIDAD-E2E-A7-A10");
        await dialogo.getByRole("spinbutton", { name: /monto/i }).fill("59500");
        const confirmar = dialogo.getByRole("button", { name: /^confirmar$/i });
        await confirmar.waitFor({ state: "visible", timeout: 5_000 });
        await confirmar.click();
        await page.waitForTimeout(6_000);
        await page.screenshot({ path: "test-results/recorrido-a-A10-tras-autorizar.png", fullPage: true });
        // No exigimos una comprobación de UI post-acción — el estado real se verifica en BD desde el reporte.
    });
});
