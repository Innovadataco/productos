import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

const ADMIN_EMAIL = "admin@proteccion.local";
const ADMIN_PASSWORD = "Admin123!Secure";

async function asegurarAdmin() {
    try {
        await prisma.usuario.upsert({
            where: { email: ADMIN_EMAIL },
            update: {},
            create: {
                email: ADMIN_EMAIL,
                nombre: "Administrador E2E",
                passwordHash: await hashPassword(ADMIN_PASSWORD),
                rol: "ADMIN",
                estado: "activo",
            },
        });
    } catch (error) {
        // Race condition tolerada: otro worker paralelo ya creó el admin
        const msg = error instanceof Error ? error.message : String(error);
        if (!msg.includes("Unique constraint")) {
            throw error;
        }
    }
}

async function obtenerPlataformaWhatsApp() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");
    return plataforma;
}

async function crearReporteAdmin(estado: EstadoReporte, categoria: CategoriaConducta, opciones: { contienePii?: boolean; esAnonimo?: boolean; identificador?: string } = {}) {
    const plataforma = await obtenerPlataformaWhatsApp();
    const identificador = opciones.identificador || `+57300ADMIN${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const numeroSeguimiento = `RPT-ADM-${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 8)}`;

    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            texto: "Texto de prueba para panel de administración con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: opciones.esAnonimo ?? true,
            numeroSeguimiento,
            estado,
        },
    });

    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria,
            confianza: 0.85,
            contienePii: opciones.contienePii ?? false,
            piiDetectada: opciones.contienePii ? ["dato"] : [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });

    return { reporte, plataforma };
}

async function loginAdmin(page: import("@playwright/test").Page) {
    const res = await page.request.post("/api/auth/login", {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.status()).toBe(200);
    await page.goto("/dashboard/admin");
}

test.describe("Panel de administración", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
    });
    test("admin puede iniciar sesión y ver la bandeja de reportes", async ({ page }) => {
        await loginAdmin(page);
        await page.goto("/dashboard/admin");

        await expect(page.getByRole("heading", { name: "Bandeja de reportes" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Aplicar filtros" })).toBeVisible();
        await expect(page.locator("table")).toBeVisible();
    });

    test("admin puede filtrar reportes por estado", async ({ page }) => {
        const { reporte } = await crearReporteAdmin("REVISION_MANUAL", "OFRECIMIENTO_REGALOS");
        await crearReporteAdmin("POSIBLE_SPAM", "OTRO");

        await loginAdmin(page);
        await page.goto("/dashboard/admin");

        await page.getByLabel("Estado").selectOption("REVISION_MANUAL");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();

        await expect(page.getByText(reporte.numeroSeguimiento!)).toBeVisible();
        await expect(page.getByText("POSIBLE_SPAM")).not.toBeVisible();
    });

    test("admin puede corregir la clasificación de un reporte", async ({ page }) => {
        const { reporte } = await crearReporteAdmin("CLASIFICADO", "OFRECIMIENTO_REGALOS");

        await loginAdmin(page);
        await page.goto("/dashboard/admin");

        await page.getByLabel("Estado").selectOption("CLASIFICADO");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();

        const fila = page.locator("tr", { hasText: reporte.numeroSeguimiento! });
        await fila.getByRole("button", { name: "Ver detalle" }).click();

        const modal = page.locator("div").filter({ hasText: "Detalle del reporte" }).first();
        await expect(modal).toBeVisible();

        const selectCorreccion = page.getByTestId("select-correccion-categoria");
        await selectCorreccion.selectOption("SUPLANTACION_IDENTIDAD");
        await expect(selectCorreccion).toHaveValue("SUPLANTACION_IDENTIDAD");
        await page.getByRole("button", { name: "Corregir clasificación" }).click();

        await expect(page.getByText("Clasificación corregida correctamente")).toBeVisible();
        await expect(page.getByText("Corrección registrada")).toBeVisible();
        await expect(page.getByText("Categoría corregida: Suplantación de identidad")).toBeVisible();

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("CORREGIDO");
    });

    test("admin puede anonimizar manualmente un reporte con PII", async ({ page }) => {
        const { reporte } = await crearReporteAdmin("REQUIERE_ANONIMIZACION", "OFRECIMIENTO_REGALOS", { contienePii: true });

        await loginAdmin(page);
        await page.goto("/dashboard/admin");

        await page.getByLabel("Estado").selectOption("REQUIERE_ANONIMIZACION");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();

        const fila = page.locator("tr", { hasText: reporte.numeroSeguimiento! });
        await fila.getByRole("button", { name: "Ver detalle" }).click();

        await page.locator("textarea").filter({ hasText: reporte.texto }).fill(
            "Texto anonimizado de prueba con suficientes caracteres para superar el mínimo."
        );
        await page.getByRole("button", { name: "Confirmar anonimización" }).click();

        await expect(page.getByText("Reporte anonimizado correctamente")).toBeVisible();

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("CLASIFICADO");
    });

    test("admin ve métricas de la cola de procesamiento en el dashboard", async ({ page }) => {
        await loginAdmin(page);
        await page.goto("/dashboard/admin/estadisticas");

        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Cola de procesamiento" })).toBeVisible();
        await expect(page.getByText("En cola")).toBeVisible();
        await expect(page.getByText("Estancados")).toBeVisible();
        await expect(page.getByText("Latencia promedio (ms)")).toBeVisible();
        await expect(page.getByText("Tasa de éxito")).toBeVisible();
    });

    test("usuario no-admin no puede acceder al panel admin", async ({ page }) => {
        const email = `e2e-admin-denied-${crypto.randomUUID()}@example.com`;
        await prisma.usuario.create({
            data: {
                email,
                nombre: "Usuario Denegado",
                passwordHash: await hashPassword("TestPass123"),
                rol: "PARENT",
                estado: "activo",
            },
        });

        await page.goto("/login");
        await page.getByLabel("Correo electrónico").fill(email);
        await page.getByLabel("Contraseña").fill("TestPass123");
        await page.getByRole("button", { name: "Iniciar sesión" }).click();

        await expect(page).toHaveURL(/\/(mis-reportes)?/);

        await page.goto("/dashboard/admin");
        await expect(page).not.toHaveURL("/dashboard/admin");
    });
});
