import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { CategoriaConducta } from "@prisma/client";

const ADMIN_EMAIL = "admin-reasignar@proteccion.local";
const ADMIN_PASSWORD = "Admin123!Secure";

async function asegurarAdmin() {
    try {
        await prisma.usuario.upsert({
            where: { email: ADMIN_EMAIL },
            update: {},
            create: {
                email: ADMIN_EMAIL,
                nombre: "Administrador Reasignar E2E",
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

async function crearOperador(suffix: string) {
    const email = `op-reasignar-${suffix}-${Date.now()}@proteccion.local`;
    const user = await prisma.usuario.create({
        data: {
            email,
            nombre: `Operador Reasignar ${suffix}`,
            passwordHash: await hashPassword("Operador123!"),
            rol: "OPERADOR",
            estado: "activo",
        },
    });
    await prisma.perfilOperador.create({
        data: {
            usuarioId: user.id,
            cupoMaximo: 10,
            creadoPorId: user.id,
        },
    });
    return user;
}

async function crearReporteRevisionManual(operadorId: string, categoria: CategoriaConducta = "OFRECIMIENTO_REGALOS") {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");

    const numeroSeguimiento = `RPT-REA-${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 8)}`;
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `+57300REA${Date.now()}`,
            plataformaId: plataforma.id,
            texto: "Texto de prueba para reasignación de operador en E2E.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento,
            estado: "REVISION_MANUAL",
            operadorId,
        },
    });

    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria,
            confianza: 0.85,
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });

    return reporte;
}

test.describe("Reasignación de operador", () => {
    test.beforeAll(async () => {
        await asegurarAdmin();
    });

    test("admin puede reasignar un caso a otro operador", async ({ page }) => {
        const origen = await crearOperador("origen");
        const destino = await crearOperador("destino");
        const reporte = await crearReporteRevisionManual(origen.id);

        await loginAdmin(page);
        await page.goto(`/dashboard/admin/operadores/${origen.id}`);

        await expect(page.getByRole("heading", { name: "Operador Reasignar origen" })).toBeVisible();
        await expect(page.getByText(reporte.numeroSeguimiento!)).toBeVisible();

        const fila = page.locator("tr", { hasText: reporte.numeroSeguimiento! });
        await fila.getByRole("button", { name: "Reasignar" }).click();

        const modal = page.locator("div").filter({ hasText: "Reasignar reporte" }).first();
        await expect(modal).toBeVisible();

        await modal.getByLabel("Operador destino").selectOption(destino.id);
        await modal.locator("textarea#motivo-reasignacion").fill(
            "Reasignación por balance de carga de trabajo en prueba E2E"
        );
        await modal.getByRole("button", { name: "Confirmar reasignación" }).click();

        await expect(modal).not.toBeVisible();

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBe(destino.id);

        const transicion = await prisma.transicionReporte.findFirst({
            where: { reporteId: reporte.id },
        });
        expect(transicion).not.toBeNull();
        expect(transicion?.responsableTipo).toBe("ADMIN");
    });
});
