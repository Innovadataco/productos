/**
 * SPEC-245 (002-PI-148): tests de integración de
 * GET /api/admin/pagos/solicitudes-pendientes.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    OrigenSuscripcion,
} from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/admin/pagos/solicitudes-pendientes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    function authRequest(method: string, url: string) {
        const headers: Record<string, string> = {};
        if (mockToken) headers.cookie = `token=${mockToken}`;
        return new Request(url, { method, headers });
    }

    async function seedAdminYPlan() {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const plan = await new PagosRepository().crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_3,
            anio: new Date().getFullYear(),
            nombre: "Plan Padre 3 meses",
            precioBaseUSD: 10,
            precioBaseCOP: 100_000,
            precio: 0,
            creadoPorAdminId: admin.id,
        });
        return { admin, plan };
    }

    async function crearSolicitud(padreId: string, planId: string) {
        return prisma.suscripcion.create({
            data: {
                tipoTitular: TipoTitular.PADRE,
                usuarioId: padreId,
                planActualId: planId,
                estado: EstadoSuscripcion.PENDIENTE_AUTORIZACION,
                origen: OrigenSuscripcion.SOLICITADA_CLIENTE,
                esFreemium: false,
                fechaInicio: new Date(),
                fechaFin: new Date(Date.now() + 24 * 60 * 60 * 1000),
                monedaLocal: "COP",
                paisCliente: "CO",
                codigoReferidoPropio: `ref-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            },
        });
    }

    it("GET requiere autenticación", async () => {
        const res = await GET(new Request("http://localhost/api/admin/pagos/solicitudes-pendientes"));
        expect(res.status).toBe(401);
    });

    it("GET rechaza usuarios no ADMIN", async () => {
        const parent = await crearUsuario(RolUsuario.PARENT, `parent-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(parent.id, RolUsuario.PARENT);
        const res = await GET(authRequest("GET", "http://localhost/api/admin/pagos/solicitudes-pendientes"));
        expect(res.status).toBe(403);
    });

    it("GET lista suscripciones PENDIENTE_AUTORIZACION", async () => {
        const { admin, plan } = await seedAdminYPlan();
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const solicitud = await crearSolicitud(padre.id, plan.id);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(authRequest("GET", "http://localhost/api/admin/pagos/solicitudes-pendientes"));
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].id).toBe(solicitud.id);
        expect(json.items[0].estado).toBe(EstadoSuscripcion.PENDIENTE_AUTORIZACION);
        expect(json.items[0].planActual.id).toBe(plan.id);
        expect(json.pagination.total).toBe(1);
    });

    it("GET filtra por email del titular", async () => {
        const { admin, plan } = await seedAdminYPlan();
        const padreA = await crearUsuario(RolUsuario.PARENT, `alfa-${Date.now()}@test.co`);
        const padreB = await crearUsuario(RolUsuario.PARENT, `beta-${Date.now()}@test.co`);
        const solicitudA = await crearSolicitud(padreA.id, plan.id);
        await crearSolicitud(padreB.id, plan.id);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(
            authRequest("GET", `http://localhost/api/admin/pagos/solicitudes-pendientes?q=${padreA.email}`)
        );
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].id).toBe(solicitudA.id);
    });
});
