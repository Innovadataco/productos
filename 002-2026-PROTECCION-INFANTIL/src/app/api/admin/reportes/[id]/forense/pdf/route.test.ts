import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
} from "@/lib/reporte-test-utils";
import {
    findAuditNuevaAccion,
    ACCION_EXPEDIENTE_FORENSE_EXPORTADO,
} from "@/lib/audit-nuevas-acciones";
import type { RolUsuario } from "@prisma/client";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

function getPdf(reporteId: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (activeToken) headers.cookie = `token=${activeToken}`;
    return GET(new Request(`http://localhost:5005/api/admin/reportes/${reporteId}/forense/pdf`, { headers }), {
        params: Promise.resolve({ id: reporteId }),
    });
}

async function revocarModulo(rol: RolUsuario, clave: string) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave } });
    await prisma.permisoModulo.update({
        where: { rol_moduloId: { rol, moduloId: modulo!.id } },
        data: { activo: false },
    });
}

async function crearReporteClasificado() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: "+57300FORPDF",
            plataformaId: plataforma!.id,
            texto: "Texto del reporte que nunca viaja al PDF forense.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Cali",
            pais: "Colombia",
            esAnonimo: true,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-FORPDF-${Date.now()}`,
            clasificacion: {
                create: {
                    categoria: "EXTORSION",
                    confianza: 0.9,
                    modeloUsado: "rubrica:test",
                    latenciaMs: 700,
                },
            },
        },
    });
}

describe("GET /api/admin/reportes/[id]/forense/pdf (SPEC-140, N-4, SC-004)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("403 sin el módulo denuncia_formal (sin documento ni evento)", async () => {
        const admin = await crearUsuario("ADMIN");
        await revocarModulo("ADMIN", "denuncia_formal");
        const reporte = await crearReporteClasificado();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getPdf(reporte.id);
        expect(res.status).toBe(403);
        const eventos = await findAuditNuevaAccion(ACCION_EXPEDIENTE_FORENSE_EXPORTADO, { recursoId: reporte.id });
        expect(eventos).toHaveLength(0);
    });

    it("200: PDF por attachment, no se retiene y audita EXPEDIENTE_FORENSE_EXPORTADO", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteClasificado();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getPdf(reporte.id);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("application/pdf");
        expect(res.headers.get("content-disposition")).toContain("attachment");

        const buffer = Buffer.from(await res.arrayBuffer());
        expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");

        const eventos = await findAuditNuevaAccion(ACCION_EXPEDIENTE_FORENSE_EXPORTADO, { recursoId: reporte.id });
        expect(eventos).toHaveLength(1);
        expect(eventos[0].usuarioId).toBe(admin.id);
        const metadatos = JSON.stringify(eventos[0].metadatos);
        expect(metadatos).not.toContain("Texto del reporte");
        expect(metadatos).not.toContain("%PDF");
    });

    it("404 si el reporte no existe (sin evento)", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getPdf("c".padEnd(25, "1"));
        expect(res.status).toBe(404);
        const eventos = await findAuditNuevaAccion(ACCION_EXPEDIENTE_FORENSE_EXPORTADO);
        expect(eventos).toHaveLength(0);
    });
});
