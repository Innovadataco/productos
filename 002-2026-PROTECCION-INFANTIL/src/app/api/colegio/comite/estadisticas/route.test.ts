import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearComiteCuenta, crearAlertaEstudiante } from "@/lib/comite-test-utils";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const URL_ESTADISTICAS = "http://localhost:5005/api/colegio/comite/estadisticas";

function getEstadisticas() {
    return GET(new Request(URL_ESTADISTICAS, { headers: { cookie: `token=${mockToken}` } }));
}

async function crearSolicitudConCategoria(
    colegioId: string,
    creadoPorId: string,
    numero: string,
    estado: "PENDIENTE" | "RESUELTA",
    categoria: CategoriaConducta,
    fechas?: { creadoEn: Date; resueltoEn: Date }
) {
    const { alerta, reporte } = await crearAlertaEstudiante(colegioId);
    await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria, confianza: 0.9, modeloUsado: "test", latenciaMs: 10 },
    });
    return prisma.solicitudComite.create({
        data: {
            reporteId: reporte.id,
            numero,
            estado,
            colegioId,
            alertaColegioId: alerta.id,
            creadoPorId,
            motivo: "Escalamiento de prueba",
            ...(estado === "RESUELTA" ? { resolucion: "Caso cerrado en prueba" } : {}),
            ...(fechas ? { creadoEn: fechas.creadoEn, resueltoEn: fechas.resueltoEn } : {}),
        },
    });
}

describe("/api/colegio/comite/estadisticas", () => {
    beforeAll(() => {
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    async function setupDosColegios() {
        const ahora = new Date();
        const haceDosDias = new Date(ahora.getTime() - 2 * 24 * 60 * 60 * 1000);

        const { admin: adminA, colegio: colegioA } = await crearColegioConAdmin();
        const comiteA = await crearComiteCuenta(colegioA.id);
        await crearSolicitudConCategoria(colegioA.id, adminA.id, "SOL-CC-A1", "PENDIENTE", "CONTACTO_INSISTENTE");
        await crearSolicitudConCategoria(colegioA.id, adminA.id, "SOL-CC-A2", "RESUELTA", "EXTORSION", {
            creadoEn: haceDosDias,
            resueltoEn: ahora,
        });

        const { admin: adminB, colegio: colegioB } = await crearColegioConAdmin();
        const comiteB = await crearComiteCuenta(colegioB.id);
        await crearSolicitudConCategoria(colegioB.id, adminB.id, "SOL-CC-B1", "PENDIENTE", "DOXING");

        return { adminA, colegioA, comiteA, adminB, colegioB, comiteB };
    }

    it("devuelve los agregados correctos del colegio del comité", async () => {
        const { comiteA } = await setupDosColegios();
        mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");

        const res = await getEstadisticas();

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.casosPorEstado).toEqual({ PENDIENTE: 1, RESUELTA: 1 });
        expect(data.tiempoMedioResolucionDias).toBeGreaterThan(1.9);
        expect(data.tiempoMedioResolucionDias).toBeLessThan(2.1);
        expect(data.topCategorias).toHaveLength(2);
        expect(data.topCategorias).toEqual(
            expect.arrayContaining([
                { categoria: "CONTACTO_INSISTENTE", total: 1 },
                { categoria: "EXTORSION", total: 1 },
            ])
        );
    });

    it("aísla los agregados por colegioId", async () => {
        const { comiteA, comiteB } = await setupDosColegios();

        mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");
        const resA = await getEstadisticas();
        const dataA = await resA.json();
        expect(resA.status).toBe(200);
        expect(dataA.topCategorias.map((c: { categoria: string }) => c.categoria)).not.toContain("DOXING");
        const totalesA = Object.values(dataA.casosPorEstado as Record<string, number>);
        expect(totalesA.reduce((acc, n) => acc + n, 0)).toBe(2);

        mockToken = await crearTokenUsuario(comiteB.id, "COMITE_CONVIVENCIA");
        const resB = await getEstadisticas();
        const dataB = await resB.json();
        expect(resB.status).toBe(200);
        expect(dataB.casosPorEstado).toEqual({ PENDIENTE: 1 });
        expect(dataB.tiempoMedioResolucionDias).toBeNull();
        expect(dataB.topCategorias).toEqual([{ categoria: "DOXING", total: 1 }]);
    });

    it("no expone texto de reporte ni datos del denunciante", async () => {
        const { comiteA } = await setupDosColegios();
        mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");

        const res = await getEstadisticas();

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Object.keys(data).sort()).toEqual([
            "casosPorEstado",
            "tiempoMedioResolucionDias",
            "topCategorias",
        ]);
        const crudo = JSON.stringify(data);
        expect(crudo).not.toContain("Escalamiento de prueba");
        expect(crudo).not.toContain("Reporte de prueba");
        expect(crudo).not.toContain("motivo");
        expect(crudo).not.toContain("resolucion");
        expect(crudo).not.toContain("texto");
    });

    it("rechaza sin autenticación (401)", async () => {
        const res = await GET(new Request(URL_ESTADISTICAS));
        expect(res.status).toBe(401);
    });

    it("rechaza rol PARENT (403)", async () => {
        await setupDosColegios();
        const parent = await prisma.usuario.create({
            data: {
                email: `parent-${Date.now()}@example.com`,
                nombre: "Padre de prueba",
                passwordHash: await hashPassword("TestPass123"),
                rol: "PARENT",
                estado: "activo",
            },
        });
        mockToken = await crearTokenUsuario(parent.id, "PARENT");

        const res = await getEstadisticas();
        expect(res.status).toBe(403);
    });

    it("rechaza rol SCHOOL_ADMIN (403)", async () => {
        const { adminA } = await setupDosColegios();
        mockToken = await crearTokenUsuario(adminA.id, "SCHOOL_ADMIN");

        const res = await getEstadisticas();
        expect(res.status).toBe(403);
    });
});
