import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { encryptParameter } from "@/lib/param-encryption";

const PII_NOMBRE = "Juan Pérez E2E";
const PII_TELEFONO = "+573001234567";
const TEXTO_CRUDO = `Mi nombre es ${PII_NOMBRE} y mi teléfono es ${PII_TELEFONO}`;
const TEXTO_ANONIMIZADO = "Mi nombre es [NOMBRE] y mi teléfono es [TELEFONO]";

async function seedAdmin() {
    const email = `e2e-admin-${crypto.randomUUID()}@example.com`;
    const admin = await prisma.usuario.create({
        data: {
            email,
            nombre: "Admin E2E Anonimización",
            passwordHash: await hashPassword("TestPass123"),
            rol: "ADMIN",
            estado: "activo",
        },
    });
    return admin;
}

async function seedReporteAnonimizado(identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    if (!plataforma) throw new Error("Plataforma whatsapp no encontrada");

    const numeroSeguimiento = `RPT-${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 6)}`;

    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            texto: TEXTO_ANONIMIZADO,
            textoOriginal: encryptParameter(TEXTO_CRUDO),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "CLASIFICADO",
            esAnonimo: false,
            numeroSeguimiento,
        },
    });

    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "OFRECIMIENTO_REGALOS",
            confianza: 0.85,
            contienePii: true,
            piiDetectada: ["NOMBRE", "TELEFONO"],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });

    await prisma.identificadorReportado.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            totalReportes: 1,
            reportesAutenticados: 1,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
            score: 50,
            scoreAutenticado: 50,
            scoreAjustado: 50,
            nivelRiesgo: "ALTO",
            ultimoReporteEn: new Date(),
        },
    });

    return { reporte, plataforma, numeroSeguimiento };
}

async function seedDatasetAnonimizado() {
    const dataset = await prisma.datasetEntrenamiento.create({
        data: {
            texto: TEXTO_ANONIMIZADO,
            clasificacionCorrecta: "OFRECIMIENTO_REGALOS",
            fuente: "correccion_admin",
            textoAnonimizado: true,
        },
    });

    await prisma.$executeRaw`
        INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${dataset.id}, ${"[" + Array(768).fill(0.01).join(",") + "]"}::vector, 'nomic-embed-text', NOW())
    `;

    return dataset;
}

test.describe("Anonimización de PII", () => {
    test("la consulta pública no expone texto ni PII cruda", async ({ request }) => {
        const identificador = `+57300ANON${Date.now()}`;
        await seedReporteAnonimizado(identificador);

        const response = await request.get(`/api/consulta?identificador=${encodeURIComponent(identificador)}`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.totalReportes).toBe(1);

        const responseText = JSON.stringify(body);
        expect(responseText).not.toContain(PII_NOMBRE);
        expect(responseText).not.toContain(PII_TELEFONO);
        expect(responseText).not.toContain(TEXTO_CRUDO);
    });

    test("el dataset de entrenamiento no contiene PII cruda", async ({ request }) => {
        const admin = await seedAdmin();
        await seedDatasetAnonimizado();

        const login = await request.post("/api/auth/login", {
            data: { email: admin.email, password: "TestPass123" },
        });
        expect(login.status()).toBe(200);

        const response = await request.get("/api/admin/dataset-entrenamiento?pageSize=100");
        expect(response.status()).toBe(200);
        const body = await response.json();
        const items = body.items || [];
        const match = items.find((item: { texto: string }) => item.texto === TEXTO_ANONIMIZADO);
        expect(match).toBeDefined();

        for (const item of items) {
            expect(item.texto).not.toContain(PII_NOMBRE);
            expect(item.texto).not.toContain(PII_TELEFONO);
            expect(item.texto).not.toContain(TEXTO_CRUDO);
        }
    });

    test("los logs de error no exponen PII cruda del reporte", async () => {
        const reporte = await seedReporteAnonimizado(`+57300LOG${Date.now()}`);
        expect(reporte.reporte.texto).not.toContain(PII_NOMBRE);
        expect(reporte.reporte.texto).not.toContain(PII_TELEFONO);
        expect(reporte.reporte.texto).toBe(TEXTO_ANONIMIZADO);
        expect(reporte.reporte.textoOriginal).toMatch(/^enc:/);
    });
});
