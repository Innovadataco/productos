/**
 * SPEC-245 (002-PI-148): tests de integración de
 * GET /api/admin/pagos/sin-suscripcion.
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

describe("/api/admin/pagos/sin-suscripcion", () => {
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

    it("GET requiere autenticación", async () => {
        const res = await GET(new Request("http://localhost/api/admin/pagos/sin-suscripcion"));
        expect(res.status).toBe(401);
    });

    it("GET lista padres sin suscripción", async () => {
        const { admin } = await seedAdminYPlan();
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(authRequest("GET", "http://localhost/api/admin/pagos/sin-suscripcion?tipo=PADRE"));
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items.length).toBeGreaterThanOrEqual(1);
        expect(json.items.some((t: { id: string }) => t.id === padre.id)).toBe(true);
        expect(json.items.every((t: { tipo: string }) => t.tipo === "PADRE")).toBe(true);
    });

    it("GET excluye targets con suscripción vigente", async () => {
        const { admin, plan } = await seedAdminYPlan();
        const padreConSub = await crearUsuario(RolUsuario.PARENT, `padre-con-${Date.now()}@test.co`);
        const padreSinSub = await crearUsuario(RolUsuario.PARENT, `padre-sin-${Date.now()}@test.co`);

        await prisma.suscripcion.create({
            data: {
                tipoTitular: TipoTitular.PADRE,
                usuarioId: padreConSub.id,
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

        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);
        const res = await GET(authRequest("GET", "http://localhost/api/admin/pagos/sin-suscripcion?tipo=PADRE"));
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items.some((t: { id: string }) => t.id === padreSinSub.id)).toBe(true);
        expect(json.items.some((t: { id: string }) => t.id === padreConSub.id)).toBe(false);
    });

    it("GET filtra por búsqueda", async () => {
        const { admin } = await seedAdminYPlan();
        const padre = await crearUsuario(RolUsuario.PARENT, `unico-${Date.now()}@test.co`);
        await crearUsuario(RolUsuario.PARENT, `otro-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(
            authRequest("GET", `http://localhost/api/admin/pagos/sin-suscripcion?q=${padre.email}`)
        );
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].id).toBe(padre.id);
    });
});
