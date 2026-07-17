import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("POST /api/admin/reportes-revision/[id]/confirmar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    async function setupReporteRevision() {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const usuario = await crearUsuario("PARENT");
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300CONFIRMAR",
                plataformaId: plataforma!.id,
                usuarioId: usuario.id,
                texto: "Mensaje ofreciendo regalos a cambio de fotos.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-CONF001",
                estado: "REVISION_MANUAL",
            },
        });
        const clasificacion = await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
                confianza: 0.8,
                contienePii: false,
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
        return { reporte, clasificacion };
    }

    function crearRequestConfirmar(reporteId: string, token?: string) {
        return new Request(`http://localhost:5005/api/admin/reportes-revision/${reporteId}/confirmar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: token ? `token=${token}` : "" },
        });
    }

    it("confirma la clasificación, registra corrección confirmada y pasa a CLASIFICADO", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte, clasificacion } = await setupReporteRevision();

        const req = crearRequestConfirmar(reporte.id, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.estado).toBe("CLASIFICADO");
        expect(body.categoria).toBe("OFRECIMIENTO_REGALOS");

        const correccion = await prisma.correccionAdmin.findUnique({
            where: { clasificacionId: clasificacion.id },
        });
        expect(correccion).not.toBeNull();
        expect(correccion?.confirmada).toBe(true);
        expect(correccion?.categoriaOriginal).toBe("OFRECIMIENTO_REGALOS");
        expect(correccion?.categoriaCorregida).toBe("OFRECIMIENTO_REGALOS");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("CLASIFICADO");
    });

    it("rechaza si el usuario no es admin", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const { reporte } = await setupReporteRevision();

        const req = crearRequestConfirmar(reporte.id, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });
});
