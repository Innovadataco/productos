import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { crearApelacion } from "@/lib/apealaciones";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearApelacionDePrueba(identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId: plataforma!.id } },
        update: { totalReportes: 1, reportesAutenticados: 1, reportesAnonimos: 0, esVisiblePublicamente: true },
        create: {
            identificador,
            plataformaId: plataforma!.id,
            totalReportes: 1,
            reportesAutenticados: 1,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
        },
    });
    return crearApelacion({
        identificador,
        plataformaId: plataforma!.id,
        motivoSolicitud: "Motivo de prueba suficientemente largo para listar.",
        tipoVerificacion: "NICK",
    });
}

describe("GET /api/admin/apeaciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp");
        mockToken = undefined;
    });

    it("lista apelaciones para un admin autenticado", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await crearApelacionDePrueba("+57300LIST01");

        const req = new Request("http://localhost:5005/api/admin/apeaciones", {
            headers: { cookie: `token=${mockToken}` },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.items.length).toBe(1);
        expect(body.items[0].identificador).toBe("+57300LIST01");
    });

    it("rechaza a usuarios no autenticados", async () => {
        const req = new Request("http://localhost:5005/api/admin/apeaciones");
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("rechaza a usuarios sin rol admin", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");

        const req = new Request("http://localhost:5005/api/admin/apeaciones", {
            headers: { cookie: `token=${mockToken}` },
        });
        const res = await GET(req);
        expect(res.status).toBe(403);
    });
});
