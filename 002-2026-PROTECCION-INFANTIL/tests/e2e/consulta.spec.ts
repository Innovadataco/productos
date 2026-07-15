import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

async function seedConsultaData(identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");

    const usuario = await prisma.usuario.create({
        data: {
            email: `e2e-consulta-${crypto.randomUUID()}@example.com`,
            nombre: "Usuario E2E Consulta",
            passwordHash: await hashPassword("TestPass123"),
            rol: "PARENT",
            estado: "activo",
        },
    });

    const base = {
        identificador,
        plataformaId: plataforma.id,
        texto: "Texto de prueba E2E para consulta pública.",
        fechaIncidente: new Date("2026-07-10T10:00:00Z"),
        ciudad: "Bogotá",
        pais: "Colombia",
        estado: "CLASIFICADO" as const,
    };

    for (let i = 0; i < 3; i++) {
        const numeroSeguimiento = `RPT-${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 12)}${i}`;
        const reporte = await prisma.reporte.create({
            data: {
                ...base,
                numeroSeguimiento,
                esAnonimo: i === 0,
                usuarioId: i === 0 ? null : usuario.id,
                creadoEn: new Date(Date.now() - i * 86400000),
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OFRECIMIENTO_REGALOS",
                confianza: 0.85,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
    }

    return { usuario, plataforma };
}

test.describe("Consulta pública de identificador", () => {
    test("usuario anónimo ve información agregada básica", async ({ page }) => {
        const identificador = `+57300E2E${Date.now()}`;
        await seedConsultaData(identificador);

        await page.goto("/");
        await page.getByPlaceholder("Ej: +573001234567").fill(identificador);
        await page.getByRole("combobox").selectOption("whatsapp");
        await page.getByRole("button", { name: "Buscar" }).click();

        await expect(page.getByText(`En los últimos`)).toBeVisible();
        await expect(page.getByTestId("total-reportes").getByText("3")).toBeVisible();
        await expect(page.getByTestId("reportes-autenticados").getByText("2")).toBeVisible();
        await expect(page.getByTestId("reportes-anonimos").getByText("1")).toBeVisible();
        await expect(page.getByRole("cell", { name: "Bogotá" }).first()).toBeVisible();
        await expect(page.getByText("Inicia sesión para conocer")).toBeVisible();
    });

    test("usuario autenticado ve score y nivel de riesgo", async ({ page }) => {
        const identificador = `+57300E2EAUTH${Date.now()}`;
        const { usuario } = await seedConsultaData(identificador);

        // Login directo vía API
        await page.request.post("/api/auth/login", {
            data: { email: usuario.email, password: "TestPass123" },
        });

        await page.goto("/");
        await page.getByPlaceholder("Ej: +573001234567").fill(identificador);
        await page.getByRole("combobox").selectOption("whatsapp");
        await page.getByRole("button", { name: "Buscar" }).click();

        await expect(page.getByText("Score de riesgo")).toBeVisible();
        await expect(page.getByText(/Riesgo (BAJO|MEDIO|ALTO|CRITICO)/i)).toBeVisible();
        await expect(page.getByText("Clasificaciones de la IA")).toBeVisible();
        await expect(page.getByText("Línea de tiempo")).toBeVisible();
    });
});
