/**
 * SPEC-224 (002-PI-125, FR-004/FR-005/FR-010/FR-011): tests de integración de
 * GET/PATCH /api/admin/analisis/reglas/[id] y GET .../[id]/historial —
 * detalle 404, versionado (snapshot + version+1 + motivo), activar/desactivar
 * con su acción de auditoría, clave inmutable y modo no editable (400).
 * NOTA: integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { GET as GET_HISTORIAL } from "./historial/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

const URL_BASE = "http://localhost:5005/api/admin/analisis/reglas";

async function crearReglaDirecta(adminId: string, overrides: Record<string, unknown> = {}) {
    return prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.id"),
            nombre: "Regla de prueba",
            descripcion: "Descripción",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Plantilla",
            prioridad: 80,
            umbralMinimo: 3,
            creadaPorAdminId: adminId,
            ...overrides,
        },
    });
}

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/analisis/reglas/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: detalle completo con sqlQuery y plantilla", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regla = await crearReglaDirecta(admin.id);

        const res = await GET(crearRequestAutenticado("GET", `${URL_BASE}/${regla.id}`, undefined, mockToken), ctx(regla.id));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ id: regla.id, sqlQuery: "SELECT 1", version: 1, recomendacionesGeneradas7d: 0 });
    });

    it("404: no existe", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(crearRequestAutenticado("GET", `${URL_BASE}/no-existe`, undefined, mockToken), ctx("no-existe"));
        expect(res.status).toBe(404);
    });

    it("401: sin sesión", async () => {
        const res = await GET(crearRequestAutenticado("GET", `${URL_BASE}/x`, undefined, undefined), ctx("x"));
        expect(res.status).toBe(401);
    });
});

describe("PATCH /api/admin/analisis/reglas/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    async function adminConRegla() {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regla = await crearReglaDirecta(admin.id);
        return { admin, regla };
    }

    it("200: edición incrementa version, guarda snapshot con motivo y audita REGLA_ACTUALIZADA", async () => {
        const { admin, regla } = await adminConRegla();

        const res = await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { umbralMinimo: 5, motivo: "subo umbral por ruido" }, mockToken),
            ctx(regla.id)
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.version).toBe(2);
        expect(body.umbralMinimo).toBe(5);

        const historial = await prisma.reglaRecomendacionHistorial.findUnique({
            where: { reglaId_version: { reglaId: regla.id, version: 1 } },
        });
        expect(historial).not.toBeNull();
        expect(historial?.motivo).toBe("subo umbral por ruido");
        expect(historial?.cambiadoPorAdminId).toBe(admin.id);
        const snapshot = historial?.snapshot as Record<string, unknown>;
        expect(snapshot.umbralMinimo).toBe(3);
        expect(snapshot.version).toBe(1);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "REGLA_ACTUALIZADA", recursoId: regla.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
    });

    it("200: desactivar registra REGLA_DESACTIVADA y reactivar REGLA_ACTIVADA", async () => {
        const { admin, regla } = await adminConRegla();

        const res1 = await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { activa: false, motivo: "pauso por ruido excesivo" }, mockToken),
            ctx(regla.id)
        );
        expect(res1.status).toBe(200);
        expect((await res1.json()).activa).toBe(false);
        expect(
            await prisma.auditLog.findFirst({ where: { accion: "REGLA_DESACTIVADA", recursoId: regla.id, usuarioId: admin.id } })
        ).not.toBeNull();

        const res2 = await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { activa: true, motivo: "reactivo tras ajuste fino" }, mockToken),
            ctx(regla.id)
        );
        expect(res2.status).toBe(200);
        expect(
            await prisma.auditLog.findFirst({ where: { accion: "REGLA_ACTIVADA", recursoId: regla.id, usuarioId: admin.id } })
        ).not.toBeNull();
    });

    it("400: cambio de clave y de modo se rechazan", async () => {
        const { regla } = await adminConRegla();

        const resClave = await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { clave: "otra.clave", motivo: "intento de renombrar" }, mockToken),
            ctx(regla.id)
        );
        expect(resClave.status).toBe(400);

        const resModo = await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { modo: "EJECUTA", motivo: "intento de promover de paso" }, mockToken),
            ctx(regla.id)
        );
        expect(resModo.status).toBe(400);

        const actual = await prisma.reglaRecomendacion.findUnique({ where: { id: regla.id } });
        expect(actual?.version).toBe(1);
        expect(actual?.modo).toBe("RECOMIENDA");
    });

    it("400: sqlQuery con mutación se valida en el servidor al guardar", async () => {
        const { regla } = await adminConRegla();
        const res = await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { sqlQuery: "SELECT 1; DROP TABLE t", motivo: "intento de colar drop" }, mockToken),
            ctx(regla.id)
        );
        expect(res.status).toBe(400);
    });

    it("400: motivo obligatorio de mínimo 10 caracteres", async () => {
        const { regla } = await adminConRegla();
        const res = await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { prioridad: 90 }, mockToken),
            ctx(regla.id)
        );
        expect(res.status).toBe(400);
    });

    it("404: no existe", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/no-existe`, { prioridad: 90, motivo: "motivo suficientemente largo" }, mockToken),
            ctx("no-existe")
        );
        expect(res.status).toBe(404);
    });
});

describe("GET /api/admin/analisis/reglas/[id]/historial", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: versiones descendentes con motivo, admin y camposCambiados", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regla = await crearReglaDirecta(admin.id);

        // Dos ediciones: v1→v2 (umbral) y v2→v3 (prioridad).
        await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { umbralMinimo: 5, motivo: "subo umbral por ruido" }, mockToken),
            ctx(regla.id)
        );
        await PATCH(
            crearRequestAutenticado("PATCH", `${URL_BASE}/${regla.id}`, { prioridad: 90, motivo: "subo prioridad por impacto" }, mockToken),
            ctx(regla.id)
        );

        const res = await GET_HISTORIAL(
            crearRequestAutenticado("GET", `${URL_BASE}/${regla.id}/historial`, undefined, mockToken),
            ctx(regla.id)
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.pagination.total).toBe(2);
        expect(body.items.map((i: { version: number }) => i.version)).toEqual([2, 1]);
        // v2 (snapshot con umbral ya en 5) diff contra el estado actual (prioridad 90).
        expect(body.items[0].camposCambiados).toEqual(["prioridad"]);
        expect(body.items[0].motivo).toBe("subo prioridad por impacto");
        expect(body.items[0].cambiadoPor.id).toBe(admin.id);
        // v1 diff contra el snapshot v2 (umbral 3 → 5).
        expect(body.items[1].camposCambiados).toEqual(["umbralMinimo"]);
    });

    it("200: historial vacío para regla sin ediciones", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regla = await crearReglaDirecta(admin.id);

        const res = await GET_HISTORIAL(
            crearRequestAutenticado("GET", `${URL_BASE}/${regla.id}/historial`, undefined, mockToken),
            ctx(regla.id)
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toEqual([]);
        expect(body.pagination.total).toBe(0);
    });
});
