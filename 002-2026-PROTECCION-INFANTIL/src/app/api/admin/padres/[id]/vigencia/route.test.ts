import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { normalizarFechaServicio } from "@/lib/colegio/vigencia";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function llamar(padreId: string, body: unknown) {
    return PATCH(
        new Request(`http://localhost:5005/api/admin/padres/${padreId}/vigencia`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...(mockToken ? { cookie: `token=${mockToken}` } : {}),
            },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: padreId }) }
    );
}

function diasDesdeHoy(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return normalizarFechaServicio(d);
}

describe("PATCH /api/admin/padres/[id]/vigencia (SPEC-119)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve 401 sin token", async () => {
        const padre = await crearUsuario("PARENT");
        const res = await llamar(padre.id, { finServicio: diasDesdeHoy(30).toISOString() });
        expect(res.status).toBe(401);
    });

    it("devuelve 403 para un token PARENT", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await llamar(padre.id, { finServicio: diasDesdeHoy(30).toISOString() });
        expect(res.status).toBe(403);
    });

    it("devuelve 404 si el id no corresponde a un PARENT", async () => {
        const admin = await crearUsuario("ADMIN", "admin@example.com");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await llamar(operador.id, { finServicio: diasDesdeHoy(30).toISOString() });
        expect(res.status).toBe(404);
    });

    it("fija la ventana de servicio del padre y registra AuditLog", async () => {
        const admin = await crearUsuario("ADMIN", "admin@example.com");
        const padre = await crearUsuario("PARENT", "padre@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const inicio = diasDesdeHoy(-5);
        const fin = diasDesdeHoy(60);
        const res = await llamar(padre.id, {
            inicioServicio: inicio.toISOString(),
            finServicio: fin.toISOString(),
        });
        expect(res.status).toBe(200);

        const actualizado = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(normalizarFechaServicio(actualizado!.inicioServicio!).getTime()).toBe(inicio.getTime());
        expect(normalizarFechaServicio(actualizado!.finServicio!).getTime()).toBe(fin.getTime());

        const audit = await prisma.auditLog.findFirst({
            where: { recursoId: padre.id, tipoRecurso: "Usuario", accion: "USER_UPDATE" },
        });
        expect(audit).not.toBeNull();
        expect(audit!.valorNuevo).toContain("finServicio");
    });

    it("extiende solo el fin (ventana parcial) y limpia la vigencia con nulls", async () => {
        const admin = await crearUsuario("ADMIN", "admin@example.com");
        const padre = await crearUsuario("PARENT", "padre@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const fin = diasDesdeHoy(90);
        const res = await llamar(padre.id, { finServicio: fin.toISOString() });
        expect(res.status).toBe(200);
        let actualizado = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(actualizado!.inicioServicio).toBeNull();
        expect(normalizarFechaServicio(actualizado!.finServicio!).getTime()).toBe(fin.getTime());

        const limpiar = await llamar(padre.id, { inicioServicio: null, finServicio: null });
        expect(limpiar.status).toBe(200);
        actualizado = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(actualizado!.inicioServicio).toBeNull();
        expect(actualizado!.finServicio).toBeNull();
    });

    it("rechaza fin anterior o igual al inicio (400)", async () => {
        const admin = await crearUsuario("ADMIN", "admin@example.com");
        const padre = await crearUsuario("PARENT", "padre@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar(padre.id, {
            inicioServicio: diasDesdeHoy(10).toISOString(),
            finServicio: diasDesdeHoy(-10).toISOString(),
        });
        expect(res.status).toBe(400);
    });

    it("rechaza body inválido (400), no 500", async () => {
        const admin = await crearUsuario("ADMIN", "admin@example.com");
        const padre = await crearUsuario("PARENT", "padre@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar(padre.id, { finServicio: "no-es-fecha" });
        expect(res.status).toBe(400);
    });
});
