import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearPaisCiudad, crearParametrosReportes } from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearReporteClasificado(numeroSeguimiento: string, identificador: string, eliminado = false) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            usuarioId: usuario.id,
            texto: "Texto de prueba para estadísticas con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            numeroSeguimiento,
            estado: "CLASIFICADO",
            eliminado,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
            confianza: 0.8,
            contienePii: false,
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    return reporte;
}

describe("GET /api/admin/estadisticas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    function crearRequestEstadisticas(token?: string) {
        return new Request("http://localhost:5005/api/admin/estadisticas", {
            method: "GET",
            headers: { "Content-Type": "application/json", Cookie: token ? `token=${token}` : "" },
        });
    }

    it("excluye reportes dados de baja de los totales y de precisionObservada", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const activo = await crearReporteClasificado("RPT-STAT-01", "+57300STAT01");
        const eliminado = await crearReporteClasificado("RPT-STAT-02", "+57300STAT02", true);

        // Corrección confirmada para reporte activo.
        await prisma.correccionAdmin.create({
            data: {
                clasificacionId: (await prisma.clasificacionIA.findUnique({ where: { reporteId: activo.id } }))!.id,
                categoriaOriginal: "OFRECIMIENTO_REGALOS",
                categoriaCorregida: "OFRECIMIENTO_REGALOS",
                adminId: admin.id,
                confirmada: true,
            },
        });
        // Corrección no confirmada para reporte eliminado.
        await prisma.correccionAdmin.create({
            data: {
                clasificacionId: (await prisma.clasificacionIA.findUnique({ where: { reporteId: eliminado.id } }))!.id,
                categoriaOriginal: "OFRECIMIENTO_REGALOS",
                categoriaCorregida: "SOLICITUD_MATERIAL",
                adminId: admin.id,
                confirmada: false,
            },
        });

        const res = await GET(crearRequestEstadisticas(mockToken));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.totales.reportes).toBe(1);
        const precision = body.precisionPorCategoria.find((p: { categoria: string }) => p.categoria === "OFRECIMIENTO_REGALOS");
        expect(precision).toBeDefined();
        expect(precision.confirmadas).toBe(1);
        expect(precision.corregidas).toBe(0);
        expect(precision.totalRevisados).toBe(1);
    });

    it("rechaza si el usuario no es admin", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");

        const res = await GET(crearRequestEstadisticas(mockToken));
        expect(res.status).toBe(403);
    });
});
