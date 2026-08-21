import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/operadores/reasignar";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    mockToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

async function crearOperador(suffix: string) {
    const user = await crearUsuario("OPERADOR", `op-${suffix}-${Date.now()}@test.local`);
    await prisma.perfilOperador.create({
        data: {
            usuarioId: user.id,
            cupoMaximo: 10,
            creadoPorId: user.id,
        },
    });
    return user;
}

async function crearReporteRevisionManual(operadorId?: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: `+57300${Date.now()}`,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba anonimizado",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL",
            esAnonimo: true,
            operadorId: operadorId ?? null,
        },
    });
}

function requestReasignar(body: unknown): Request {
    return new Request(URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/admin/operadores/reasignar (SPEC-193 Fase 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("reasigna un reporte y crea TransicionReporte y AuditLog", async () => {
        const admin = await autenticarAdmin();
        const origen = await crearOperador("origen");
        const destino = await crearOperador("destino");
        const reporte = await crearReporteRevisionManual(origen.id);

        const res = await PATCH(
            requestReasignar({
                reporteId: reporte.id,
                operadorDestinoId: destino.id,
                motivo: "Reasignación por carga de trabajo del operador original",
            })
        );
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.operadorId).toBe(destino.id);
        expect(body.estado).toBe("REVISION_MANUAL");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.operadorId).toBe(destino.id);

        const transicion = await prisma.transicionReporte.findFirst({
            where: { reporteId: reporte.id },
        });
        expect(transicion).not.toBeNull();
        expect(transicion?.responsableTipo).toBe("ADMIN");
        expect(transicion?.responsableId).toBe(admin.id);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "REPORTE_REASIGNADO_MANUAL", recursoId: reporte.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(admin.id);
    });

    it("rechaza reasignar un reporte en estado PENDIENTE", async () => {
        await autenticarAdmin();
        const origen = await crearOperador("origen");
        const destino = await crearOperador("destino");
        const reporte = await prisma.reporte.create({
            data: {
                identificador: `+57300${Date.now()}`,
                plataformaId: (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!.id,
                texto: "Texto de prueba",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                estado: "PENDIENTE",
                esAnonimo: true,
                operadorId: origen.id,
            },
        });

        const res = await PATCH(
            requestReasignar({
                reporteId: reporte.id,
                operadorDestinoId: destino.id,
                motivo: "Reasignación por carga de trabajo del operador original",
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("rechaza reasignar un reporte sin operador asignado", async () => {
        await autenticarAdmin();
        const destino = await crearOperador("destino");
        const reporte = await crearReporteRevisionManual();

        const res = await PATCH(
            requestReasignar({
                reporteId: reporte.id,
                operadorDestinoId: destino.id,
                motivo: "Reasignación por carga de trabajo del operador original",
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("rechaza reasignar a un operador inactivo", async () => {
        await autenticarAdmin();
        const origen = await crearOperador("origen");
        const destino = await crearOperador("destino");
        await prisma.usuario.update({ where: { id: destino.id }, data: { estado: "inactivo" } });
        const reporte = await crearReporteRevisionManual(origen.id);

        const res = await PATCH(
            requestReasignar({
                reporteId: reporte.id,
                operadorDestinoId: destino.id,
                motivo: "Reasignación por carga de trabajo del operador original",
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("rechaza reasignar a un usuario que no es OPERADOR", async () => {
        await autenticarAdmin();
        const origen = await crearOperador("origen");
        const noOperador = await crearUsuario("PARENT", `parent-${Date.now()}@test.local`);
        const reporte = await crearReporteRevisionManual(origen.id);

        const res = await PATCH(
            requestReasignar({
                reporteId: reporte.id,
                operadorDestinoId: noOperador.id,
                motivo: "Reasignación por carga de trabajo del operador original",
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("rechaza reasignar al mismo operador actual", async () => {
        await autenticarAdmin();
        const origen = await crearOperador("origen");
        const reporte = await crearReporteRevisionManual(origen.id);

        const res = await PATCH(
            requestReasignar({
                reporteId: reporte.id,
                operadorDestinoId: origen.id,
                motivo: "Reasignación por carga de trabajo del operador original",
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("rechaza motivo corto", async () => {
        await autenticarAdmin();
        const origen = await crearOperador("origen");
        const destino = await crearOperador("destino");
        const reporte = await crearReporteRevisionManual(origen.id);

        const res = await PATCH(
            requestReasignar({
                reporteId: reporte.id,
                operadorDestinoId: destino.id,
                motivo: "Corto",
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("devuelve 403 para un usuario no admin", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(
            new AppError("No autorizado", ERROR_CODES.FORBIDDEN, 403)
        );
        const res = await PATCH(
            new Request(URL, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reporteId: "cuid", operadorDestinoId: "cuid", motivo: "x".repeat(25) }),
            })
        );
        expect(res.status).toBe(403);
    });
});
