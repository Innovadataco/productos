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
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

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
                operadorId: asignadoA ?? null,
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

    // SPEC-181: fixture parametrizada para los filtros de la barra (q/estado/orden).
    async function crearReporteColaSpam({
        identificador,
        numeroSeguimiento,
        estado = "POSIBLE_SPAM",
        creadoEn = new Date("2026-07-10T10:00:00Z"),
        prioridadAlta = false,
    }: {
        identificador: string;
        numeroSeguimiento: string;
        estado?: EstadoReporte;
        creadoEn?: Date;
        prioridadAlta?: boolean;
    }) {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma!.id,
                texto: "Texto de spam de prueba con ofertas y premios",
                fechaIncidente: creadoEn,
                creadoEn,
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento,
                estado,
                prioridadAlta,
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "SPAM" as CategoriaConducta,
                confianza: 0.9,
                contienePii: false,
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
        return reporte;
    }

    function crearRequestPendientes(token?: string, query = "") {
        return new Request(`http://localhost:5005/api/admin/spam/pendientes${query}`, {
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

    it("responde 400 ante parámetros inválidos", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        for (const query of ["?q=ab", "?orden=alfabetico", "?estado=CLASIFICADO", "?pageSize=0"]) {
            const res = await GET(crearRequestPendientes(mockToken, query));
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe("VALIDATION_ERROR");
        }
    });

    it("filtra por q (identificador o número de seguimiento)", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const buscado = await crearReporteColaSpam({
            identificador: "nick.fraudulento.123",
            numeroSeguimiento: "RPT-QBUSCAR1",
        });
        await crearReporteColaSpam({
            identificador: "+573009990000",
            numeroSeguimiento: "RPT-QOTRO001",
        });

        const res = await GET(crearRequestPendientes(mockToken, `?q=${encodeURIComponent("fraudulento")}`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reportes).toHaveLength(1);
        expect(body.reportes[0].id).toBe(buscado.id);
    });

    it("filtra por estado (POSIBLE_SPAM o REVISION_MANUAL clasificado SPAM)", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const posibleSpam = await crearReporteColaSpam({
            identificador: "+573001110001",
            numeroSeguimiento: "RPT-EST-POS1",
            estado: "POSIBLE_SPAM",
        });
        const revisionManual = await crearReporteColaSpam({
            identificador: "+573001110002",
            numeroSeguimiento: "RPT-EST-REV1",
            estado: "REVISION_MANUAL",
        });

        const resPosible = await GET(crearRequestPendientes(mockToken, "?estado=POSIBLE_SPAM"));
        const bodyPosible = await resPosible.json();
        expect(bodyPosible.reportes).toHaveLength(1);
        expect(bodyPosible.reportes[0].id).toBe(posibleSpam.id);

        const resManual = await GET(crearRequestPendientes(mockToken, "?estado=REVISION_MANUAL"));
        const bodyManual = await resManual.json();
        expect(bodyManual.reportes).toHaveLength(1);
        expect(bodyManual.reportes[0].id).toBe(revisionManual.id);
    });

    it("orden=recientes y orden=antiguos cambian el orden real; el default es prioridad", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const antiguo = await crearReporteColaSpam({
            identificador: "+573002220001",
            numeroSeguimiento: "RPT-ORD-ANT1",
            creadoEn: new Date("2026-07-01T10:00:00Z"),
        });
        const reciente = await crearReporteColaSpam({
            identificador: "+573002220002",
            numeroSeguimiento: "RPT-ORD-REC1",
            creadoEn: new Date("2026-07-10T10:00:00Z"),
        });
        const prioritario = await crearReporteColaSpam({
            identificador: "+573002220003",
            numeroSeguimiento: "RPT-ORD-PRI1",
            creadoEn: new Date("2026-07-05T10:00:00Z"),
            prioridadAlta: true,
        });

        const resRecientes = await GET(crearRequestPendientes(mockToken, "?orden=recientes"));
        const bodyRecientes = await resRecientes.json();
        expect(bodyRecientes.reportes.map((r: { id: string }) => r.id)).toEqual([
            reciente.id,
            prioritario.id,
            antiguo.id,
        ]);

        const resAntiguos = await GET(crearRequestPendientes(mockToken, "?orden=antiguos"));
        const bodyAntiguos = await resAntiguos.json();
        expect(bodyAntiguos.reportes.map((r: { id: string }) => r.id)).toEqual([
            antiguo.id,
            prioritario.id,
            reciente.id,
        ]);

        // Sin `orden`: prioridadAlta primero, luego fecha descendente.
        const resDefault = await GET(crearRequestPendientes(mockToken));
        const bodyDefault = await resDefault.json();
        expect(bodyDefault.reportes.map((r: { id: string }) => r.id)).toEqual([
            prioritario.id,
            reciente.id,
            antiguo.id,
        ]);
    });

    it("pagina con la convención estándar { reportes, pagination }", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        await crearReporteColaSpam({
            identificador: "+573003330001",
            numeroSeguimiento: "RPT-PAG-0001",
            creadoEn: new Date("2026-07-01T10:00:00Z"),
        });
        const segundo = await crearReporteColaSpam({
            identificador: "+573003330002",
            numeroSeguimiento: "RPT-PAG-0002",
            creadoEn: new Date("2026-07-02T10:00:00Z"),
        });

        const res = await GET(crearRequestPendientes(mockToken, "?pageSize=1&page=2&orden=antiguos"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.paginacion).toBeUndefined();
        expect(body.pagination).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
        expect(body.reportes).toHaveLength(1);
        expect(body.reportes[0].id).toBe(segundo.id);
    });
});
