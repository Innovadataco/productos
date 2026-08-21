import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const ADMIN_EMAIL = "admin-monitoreo-logs@proteccion.local";
const ADMIN_PASSWORD = "Admin123!Secure";

async function asegurarAdmin() {
    try {
        await prisma.usuario.upsert({
            where: { email: ADMIN_EMAIL },
            update: {},
            create: {
                email: ADMIN_EMAIL,
                nombre: "Administrador Monitoreo Logs E2E",
                passwordHash: await hashPassword(ADMIN_PASSWORD),
                rol: "ADMIN",
                estado: "activo",
            },
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (!msg.includes("Unique constraint")) {
            throw error;
        }
    }
}

async function loginAdmin(page: import("@playwright/test").Page) {
    const res = await page.request.post("/api/auth/login", {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.status()).toBe(200);
}

async function crearLogsDePrueba() {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() - 1);
    base.setUTCHours(12, 0, 0, 0);

    await prisma.workerLog.createMany({
        data: [
            { servicio: "pi-app", nivel: "INFO", mensaje: "inicio saludable", creadoEn: base },
            { servicio: "pi-worker", nivel: "ERROR", mensaje: "fallo al procesar reporte", creadoEn: base },
            { servicio: "pi-monitor", nivel: "WARN", mensaje: "latencia alta", creadoEn: base },
        ],
    });
}

function formatoDateTimeLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

test.describe("Panel de monitoreo de logs", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
    });

    test("admin puede consultar, filtrar y purgar logs", async ({ page }) => {
        await prisma.workerLog.deleteMany();
        await crearLogsDePrueba();

        await loginAdmin(page);
        await page.goto("/dashboard/admin/estadisticas/operacion?tab=logs");

        // Verifica que la tabla renderiza logs.
        await expect(page.getByRole("heading", { name: "Logs de workers" })).toBeVisible();
        await expect(page.locator("table")).toBeVisible();
        await expect(page.getByText("inicio saludable")).toBeVisible();
        await expect(page.getByText("fallo al procesar reporte")).toBeVisible();

        // Aplicar filtro por servicio.
        await page.getByLabel("Servicio").selectOption("pi-app");
        await page.getByRole("button", { name: "Aplicar" }).click();

        await expect(page.getByText("inicio saludable")).toBeVisible();
        await expect(page.getByText("fallo al procesar reporte")).not.toBeVisible();

        // Navegar a configuración, sección Mantenimiento.
        await page.goto("/dashboard/admin/configuracion");
        await expect(page.getByRole("heading", { name: "Mantenimiento de logs" })).toBeVisible();

        // Purga de logs de ayer.
        const ayer = new Date();
        ayer.setUTCDate(ayer.getUTCDate() - 1);
        ayer.setUTCHours(23, 59, 0, 0);

        await page.getByLabel("Hasta").fill(formatoDateTimeLocal(ayer));
        await page.getByLabel("Motivo de la purga").fill(
            "Limpieza de logs de ayer por política de retención de pruebas automatizadas"
        );

        await page.getByRole("button", { name: "Confirmar purga" }).first().click();

        const modal = page.locator("div").filter({ hasText: "Confirmar purga de logs" }).first();
        await expect(modal).toBeVisible();
        await modal.getByRole("button", { name: "Confirmar purga" }).click();

        await expect(page.getByText(/Purga completada/)).toBeVisible();

        // Verificar que los logs desaparecieron del listado.
        await page.goto("/dashboard/admin/estadisticas/operacion?tab=logs");
        await expect(page.getByText("inicio saludable")).not.toBeVisible();
        await expect(page.getByText("fallo al procesar reporte")).not.toBeVisible();
    });
});
