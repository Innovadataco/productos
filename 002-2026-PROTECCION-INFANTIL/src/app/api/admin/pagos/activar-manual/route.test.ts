/**
 * SPEC-245 (002-PI-148): tests de integración de POST /api/admin/pagos/activar-manual.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion, OrigenSuscripcion } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/admin/pagos/activar-manual", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    function authRequest(method: string, url: string, body?: unknown) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (mockToken) headers.cookie = `token=${mockToken}`;
        return new Request(url, {
            method,
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
    }

    async function crearPlanPadre(adminId: string) {
        const repo = new PagosRepository();
        return repo.crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_3,
            anio: new Date().getFullYear(),
            nombre: "Plan Padre 3 meses",
            precioBaseUSD: 10,
            precioBaseCOP: 100_000,
            precio: 0,
            creadoPorAdminId: adminId,
        });
    }

    it("POST requiere autenticación", async () => {
        const res = await POST(new Request("http://localhost/api/admin/pagos/activar-manual"));
        expect(res.status).toBe(401);
    });

    it("POST rechaza usuarios no ADMIN", async () => {
        const parent = await crearUsuario(RolUsuario.PARENT, `parent-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(parent.id, RolUsuario.PARENT);
        const res = await POST(authRequest("POST", "http://localhost/api/admin/pagos/activar-manual", {}));
        expect(res.status).toBe(403);
    });

    it("POST activa manualmente a un padre y registra AuditLog", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await POST(
            authRequest("POST", "http://localhost/api/admin/pagos/activar-manual", {
                usuarioObjetivoId: padre.id,
                planId: plan.id,
                metodoPagoManual: "TRANSFERENCIA_BANCARIA",
                referenciaPagoManual: "REF-TEST",
                montoRealPagado: 119_000,
            })
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.suscripcion.estado).toBe(EstadoSuscripcion.ACTIVA);
        expect(json.suscripcion.origen).toBe(OrigenSuscripcion.ACTIVADA_MANUAL_ADMIN);
        expect(json.suscripcion.usuarioId).toBe(padre.id);

        const audit = await prisma.auditLog.findFirst({
            where: { tipoRecurso: "Suscripcion", recursoId: json.suscripcion.id },
        });
        expect(audit).not.toBeNull();
    });

    it("POST rechaza activar un plan freemium", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const plan = await new PagosRepository().crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_1,
            anio: new Date().getFullYear(),
            nombre: "Freemium",
            precioBaseUSD: 0,
            precioBaseCOP: 0,
            precio: 0,
            esFreemium: true,
            usosMaximosPorCliente: 1,
            creadoPorAdminId: admin.id,
        });

        const res = await POST(
            authRequest("POST", "http://localhost/api/admin/pagos/activar-manual", {
                usuarioObjetivoId: padre.id,
                planId: plan.id,
                metodoPagoManual: "OTRO",
                referenciaPagoManual: "X",
                montoRealPagado: 0,
            })
        );

        expect(res.status).toBe(400);
    });

    it("POST rechaza si el titular ya tiene suscripción vigente", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        await prisma.suscripcion.create({
            data: {
                tipoTitular: TipoTitular.PADRE,
                usuarioId: padre.id,
                planActualId: plan.id,
                estado: EstadoSuscripcion.ACTIVA,
                origen: OrigenSuscripcion.ACTIVADA_MANUAL_ADMIN,
                esFreemium: false,
                fechaInicio: new Date(),
                fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                monedaLocal: "COP",
                paisCliente: "CO",
                codigoReferidoPropio: `ref-${Date.now()}`,
            },
        });

        const res = await POST(
            authRequest("POST", "http://localhost/api/admin/pagos/activar-manual", {
                usuarioObjetivoId: padre.id,
                planId: plan.id,
                metodoPagoManual: "TRANSFERENCIA_BANCARIA",
                referenciaPagoManual: "REF",
                montoRealPagado: 100_000,
            })
        );

        expect(res.status).toBe(409);
    });
});
