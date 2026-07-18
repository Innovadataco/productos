import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
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

describe("GET /api/admin/spam/pendientes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    async function setupReporteSpam(asignadoA?: string) {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300SPAMPEND",
                plataformaId: plataforma!.id,
                texto: "Compra relojes baratos viagra cripto dinero fácil 100% gratis",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-SPAM-PEND",
                estado: "POSIBLE_SPAM",
                operadorId: asignadoA,
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "SPAM" as CategoriaConducta,
                confianza: 0.92,
                contienePii: false,
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
        return reporte;
    }

    function crearRequestPendientes(token?: string) {
        return new Request("http://localhost:5005/api/admin/spam/pendientes", {
            headers: { Cookie: token ? `token=${token}` : "" },
        });
    }

    it("lista reportes POSIBLE_SPAM para admin", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await setupReporteSpam();

        const req = crearRequestPendientes(mockToken);
        const res = await GET(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.reportes).toHaveLength(1);
        expect(body.reportes[0].estado).toBe("POSIBLE_SPAM");
        expect(body.reportes[0].confianzaSpam).toBe(0.92);
    });

    it("rechaza usuarios sin rol operador/admin/comite", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");

        const req = crearRequestPendientes(mockToken);
        const res = await GET(req);
        expect(res.status).toBe(403);
    });

    it("operador solo ve reportes asignados a él", async () => {
        const operador1 = await crearUsuario("OPERADOR", "op1@test.com");
        const operador2 = await crearUsuario("OPERADOR", "op2@test.com");
        await setupReporteSpam(operador1.id);

        mockToken = await crearTokenUsuario(operador2.id, "OPERADOR");
        const req = crearRequestPendientes(mockToken);
        const res = await GET(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.reportes).toHaveLength(0);
    });
});
