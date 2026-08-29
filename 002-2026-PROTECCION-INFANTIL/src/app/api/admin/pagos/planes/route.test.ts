/**
 * SPEC-243 (002-PI-146): tests de integración de /api/admin/pagos/planes.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[id]/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion, AccionAudit } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/admin/pagos/planes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    async function seedAdmin() {
        return crearUsuario(RolUsuario.ADMIN, `admin-planes-${Date.now()}@test.co`);
    }

    function authRequest(method: string, url: string, body?: unknown) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (mockToken) headers.cookie = `token=${mockToken}`;
        return new Request(url, {
            method,
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
    }

    function contextConId(id: string) {
        return { params: Promise.resolve({ id }) };
    }

    it("GET requiere autenticación", async () => {
        const res = await GET(new Request("http://localhost/api/admin/pagos/planes"));
        expect(res.status).toBe(401);
    });

    it("GET rechaza usuarios no ADMIN", async () => {
        const parent = await crearUsuario(RolUsuario.PARENT, `parent-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(parent.id, RolUsuario.PARENT);
        const res = await GET(authRequest("GET", "http://localhost/api/admin/pagos/planes"));
        expect(res.status).toBe(403);
    });

    it("POST crea un plan pagado y registra AuditLog", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await POST(
            authRequest("POST", "http://localhost/api/admin/pagos/planes", {
                nombre: "Plan Padre 3 meses",
                precioBaseCOP: 39_900,
                precioBaseUSD: 10,
                duracion: "MES_3",
                tipoTitular: "PADRE",
                anio: 2026,
                descripcion: "Plan de prueba",
            })
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.plan.nombre).toBe("Plan Padre 3 meses");
        expect(json.plan.precioBaseCOP).toBe(39_900);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: AccionAudit.PLAN_CREATE, recursoId: json.plan.id },
        });
        expect(audit).not.toBeNull();
    });

    it("POST rechaza plan freemium inválido", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await POST(
            authRequest("POST", "http://localhost/api/admin/pagos/planes", {
                nombre: "Freemium malo",
                precioBaseCOP: 10_000,
                precioBaseUSD: 2,
                duracion: "MES_1",
                tipoTitular: "PADRE",
                esFreemium: true,
                usosMaximosPorCliente: 1,
            })
        );

        expect(res.status).toBe(400);
    });

    it("POST rechaza nombre duplicado para el mismo rol", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const body = {
            nombre: "Único",
            precioBaseCOP: 10_000,
            precioBaseUSD: 2,
            duracion: "MES_3",
            tipoTitular: "PADRE",
        };

        const primero = await POST(authRequest("POST", "http://localhost/api/admin/pagos/planes", body));
        expect(primero.status).toBe(201);

        const segundo = await POST(authRequest("POST", "http://localhost/api/admin/pagos/planes", { ...body, duracion: "MES_6" }));
        expect(segundo.status).toBe(409);
    });

    it("PATCH edita un plan y registra AuditLog con antes/después", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const createRes = await POST(
            authRequest("POST", "http://localhost/api/admin/pagos/planes", {
                nombre: "Editable",
                precioBaseCOP: 20_000,
                precioBaseUSD: 5,
                duracion: "MES_3",
                tipoTitular: "COLEGIO",
            })
        );
        const { plan } = await createRes.json();

        const patchRes = await PATCH(
            authRequest("PATCH", `http://localhost/api/admin/pagos/planes/${plan.id}`, {
                precioBaseCOP: 25_000,
                descripcion: "Actualizado",
            }),
            contextConId(plan.id)
        );

        expect(patchRes.status).toBe(200);
        const json = await patchRes.json();
        expect(json.plan.precioBaseCOP).toBe(25_000);
        expect(json.plan.descripcion).toBe("Actualizado");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: AccionAudit.PLAN_UPDATE, recursoId: plan.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorAnterior).toContain("20000");
        expect(audit?.valorNuevo).toContain("25000");
    });

    it("DELETE desactiva un plan sin suscripciones y registra AuditLog", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const createRes = await POST(
            authRequest("POST", "http://localhost/api/admin/pagos/planes", {
                nombre: "Desactivable",
                precioBaseCOP: 10_000,
                precioBaseUSD: 2,
                duracion: "MES_3",
                tipoTitular: "PADRE",
            })
        );
        const { plan } = await createRes.json();

        const deleteRes = await DELETE(authRequest("DELETE", `http://localhost/api/admin/pagos/planes/${plan.id}`), contextConId(plan.id));
        expect(deleteRes.status).toBe(200);
        const json = await deleteRes.json();
        expect(json.plan.activo).toBe(false);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: AccionAudit.PLAN_TOGGLE, recursoId: plan.id },
        });
        expect(audit).not.toBeNull();
    });

    it("DELETE retorna 409 si el plan tiene suscripciones activas", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const createRes = await POST(
            authRequest("POST", "http://localhost/api/admin/pagos/planes", {
                nombre: "Con suscripción",
                precioBaseCOP: 10_000,
                precioBaseUSD: 2,
                duracion: "MES_3",
                tipoTitular: "PADRE",
            })
        );
        const { plan } = await createRes.json();

        await prisma.suscripcion.create({
            data: {
                tipoTitular: TipoTitular.PADRE,
                estado: EstadoSuscripcion.ACTIVA,
                planActualId: plan.id,
                fechaInicio: new Date(),
                fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                codigoReferidoPropio: `ref-${Date.now()}`,
            },
        });

        const deleteRes = await DELETE(authRequest("DELETE", `http://localhost/api/admin/pagos/planes/${plan.id}`), contextConId(plan.id));
        expect(deleteRes.status).toBe(409);
    });

    it("GET lista planes paginados y filtra por rol", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        await prisma.plan.createMany({
            data: [
                {
                    nombre: "PADRE 1",
                    tipoTitular: TipoTitular.PADRE,
                    duracion: DuracionPlan.MES_3,
                    anio: 2026,
                    precioBaseUSD: 1,
                    precioBaseCOP: 10_000,
                    esFreemium: false,
                    precio: 0,
                    creadoPorAdminId: admin.id,
                },
                {
                    nombre: "COLEGIO 1",
                    tipoTitular: TipoTitular.COLEGIO,
                    duracion: DuracionPlan.MES_3,
                    anio: 2026,
                    precioBaseUSD: 1,
                    precioBaseCOP: 20_000,
                    esFreemium: false,
                    precio: 0,
                    creadoPorAdminId: admin.id,
                },
            ],
        });

        const res = await GET(authRequest("GET", "http://localhost/api/admin/pagos/planes?tipoTitular=PADRE"));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].tipoTitular).toBe("PADRE");
        expect(json.pagination.total).toBe(1);
    });
});

describe("PATCH /api/admin/pagos/planes/[id] · validación freemium/precio", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    async function seedAdmin() {
        return crearUsuario(RolUsuario.ADMIN, `admin-patch-fr-${Date.now()}@test.co`);
    }

    async function crearPlanFreemium(adminId: string) {
        return prisma.plan.create({
            data: {
                nombre: `Freemium-${Date.now()}`,
                precioBaseCOP: 0,
                precioBaseUSD: 0,
                precio: 0,
                duracion: DuracionPlan.MES_1,
                tipoTitular: TipoTitular.COLEGIO,
                anio: 2026,
                activo: true,
                esFreemium: true,
                usosMaximosPorCliente: 1,
                creadoPorAdminId: adminId,
            },
        });
    }

    async function crearPlanPago(adminId: string) {
        return prisma.plan.create({
            data: {
                nombre: `Pago-${Date.now()}`,
                precioBaseCOP: 39900,
                precioBaseUSD: 10,
                precio: 0,
                duracion: DuracionPlan.MES_3,
                tipoTitular: TipoTitular.COLEGIO,
                anio: 2026,
                activo: true,
                esFreemium: false,
                creadoPorAdminId: adminId,
            },
        });
    }

    function patchReq(id: string, body: unknown) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (mockToken) headers.cookie = `token=${mockToken}`;
        return new Request(`http://localhost/api/admin/pagos/planes/${id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(body),
        });
    }

    it("rechaza precio > 0 en plan freemium existente (bug Jelkin)", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);
        const plan = await crearPlanFreemium(admin.id);

        const res = await PATCH(
            patchReq(plan.id, { precioBaseCOP: 500_000 }),
            { params: Promise.resolve({ id: plan.id }) }
        );

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toMatch(/freemium requiere precio 0/i);
    });

    it("rechaza precio 0 en plan pago existente", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);
        const plan = await crearPlanPago(admin.id);

        const res = await PATCH(
            patchReq(plan.id, { precioBaseCOP: 0 }),
            { params: Promise.resolve({ id: plan.id }) }
        );

        expect(res.status).toBe(400);
    });

    it("acepta cambiar precio en plan pago", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);
        const plan = await crearPlanPago(admin.id);

        const res = await PATCH(
            patchReq(plan.id, { precioBaseCOP: 99_900 }),
            { params: Promise.resolve({ id: plan.id }) }
        );

        expect(res.status).toBe(200);
    });

    it("acepta cambiar de freemium a pago con precio > 0 en un solo PATCH", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);
        const plan = await crearPlanFreemium(admin.id);

        const res = await PATCH(
            patchReq(plan.id, { esFreemium: false, precioBaseCOP: 99_900 }),
            { params: Promise.resolve({ id: plan.id }) }
        );

        expect(res.status).toBe(200);
    });
});
