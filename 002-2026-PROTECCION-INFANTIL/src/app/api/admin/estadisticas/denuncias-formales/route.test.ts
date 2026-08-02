import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { logAuditNuevaAccion, ACCION_DENUNCIA_FORMAL_GENERADA } from "@/lib/audit-nuevas-acciones";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

function getMetrica(): Promise<Response> {
    const headers: Record<string, string> = {};
    if (activeToken) headers.cookie = `token=${activeToken}`;
    return GET(new Request("http://localhost:5005/api/admin/estadisticas/denuncias-formales", { headers }));
}

describe("GET /api/admin/estadisticas/denuncias-formales (SPEC-140, FR-008, US3)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin token / 403 para rol no ADMIN", async () => {
        expect((await getMetrica()).status).toBe(401);
        const operador = await crearUsuario("OPERADOR");
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");
        expect((await getMetrica()).status).toBe(403);
    });

    it("cero eventos → total 0 (no error)", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getMetrica();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({ total: 0, porPeriodo: [] });
    });

    it("N eventos → total N y desglose por período, SIN identificadores (SC-005)", async () => {
        const admin = await crearUsuario("ADMIN");
        const ahora = new Date().toISOString();
        for (let i = 0; i < 3; i++) {
            await logAuditNuevaAccion({
                accion: ACCION_DENUNCIA_FORMAL_GENERADA,
                tipoRecurso: "Reporte",
                recursoId: `rep-${i}`,
                usuarioId: admin.id,
                metadatos: { reporteId: `rep-${i}`, canalDestino: "Línea 141 ICBF", usuarioId: admin.id, fecha: ahora },
            });
        }
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getMetrica();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(3);
        expect(body.porPeriodo).toHaveLength(1);
        expect(body.porPeriodo[0].total).toBe(3);
        expect(body.porPeriodo[0].periodo).toMatch(/^\d{4}-\d{2}$/);

        // Solo números: sin reporte_id ni usuario_id en la respuesta.
        const json = JSON.stringify(body);
        expect(json).not.toContain("rep-0");
        expect(json).not.toContain(admin.id);
    });
});
