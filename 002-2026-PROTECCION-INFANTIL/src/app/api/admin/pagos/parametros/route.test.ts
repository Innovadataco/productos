/**
 * SPEC-243 (002-PI-146): tests de integración de /api/admin/pagos/parametros.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { RolUsuario, AccionAudit } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const PARAMETROS_VALIDOS = {
    "pagos.iva.porcentaje": 19,
    "pagos.iva.aplica_a": "todos",
    "pagos.freemium.activo": true,
    "pagos.freemium.duracion_dias": 30,
    "pagos.recompensa.activa": true,
    "pagos.recompensa.meses_gratis": 1,
    "pagos.recompensa.max_por_año": 5,
};

describe("PATCH /api/admin/pagos/parametros", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    function authRequest(body: unknown) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (mockToken) headers.cookie = `token=${mockToken}`;
        return new Request("http://localhost/api/admin/pagos/parametros", {
            method: "PATCH",
            headers,
            body: JSON.stringify(body),
        });
    }

    it("rechaza usuarios no autenticados", async () => {
        const res = await PATCH(authRequest(PARAMETROS_VALIDOS));
        expect(res.status).toBe(401);
    });

    it("rechaza usuarios no ADMIN", async () => {
        const parent = await crearUsuario(RolUsuario.PARENT, `parent-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(parent.id, RolUsuario.PARENT);
        const res = await PATCH(authRequest(PARAMETROS_VALIDOS));
        expect(res.status).toBe(403);
    });

    it("actualiza el batch de parámetros y registra un único AuditLog", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-params-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await PATCH(authRequest(PARAMETROS_VALIDOS));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.parametros["pagos.iva.porcentaje"]).toBe("19");
        expect(json.parametros["pagos.freemium.duracion_dias"]).toBe("30");

        const iva = await prisma.parametroSistema.findUnique({
            where: { clave: "pagos.iva.porcentaje" },
        });
        expect(iva?.valor).toBe("19");
        expect(iva?.tipo).toBe("FLOAT");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: AccionAudit.PARAM_UPDATE, tipoRecurso: "ParametroSistema" },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorNuevo).toContain("pagos.iva.porcentaje");
    });

    it("rechaza valores fuera de rango", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-params-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await PATCH(
            authRequest({
                ...PARAMETROS_VALIDOS,
                "pagos.iva.porcentaje": 101,
            })
        );
        expect(res.status).toBe(400);

        const iva = await prisma.parametroSistema.findUnique({
            where: { clave: "pagos.iva.porcentaje" },
        });
        expect(iva).toBeNull();
    });

    it("rechaza duración de freemium menor a 1 día", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-params-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await PATCH(
            authRequest({
                ...PARAMETROS_VALIDOS,
                "pagos.freemium.duracion_dias": 0,
            })
        );
        expect(res.status).toBe(400);
    });
});
