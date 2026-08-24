/**
 * SPEC-224 (002-PI-125, FR-007, SC-003): tests de integración de
 * POST /api/admin/analisis/reglas/test-sql — query válida devuelve muestra +
 * columnas + duración; mutación rechazada sin ejecutarse; error de PostgreSQL
 * legible; auditoría REGLA_SQL_TEST solo con metadatos. Incluye la verificación
 * de la barrera real: la transacción READ ONLY rechaza escrituras (25006).
 * NOTA: integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { ReglasRecomendacionRepository } from "@/lib/dal/repositories/reglas-recomendacion";

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

const URL_BASE = "http://localhost:5005/api/admin/analisis/reglas/test-sql";

function llamar(body: unknown) {
    return POST(crearRequestAutenticado("POST", URL_BASE, body, mockToken));
}

describe("POST /api/admin/analisis/reglas/test-sql", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    async function adminAutenticado() {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        return admin;
    }

    it("200: query válida devuelve columnas, muestra, duración y límites aplicados", async () => {
        await adminAutenticado();
        const res = await llamar({ sqlQuery: "SELECT 1 AS \"suscripcionId\", 'x' AS etiqueta" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.columnas).toEqual(["suscripcionId", "etiqueta"]);
        expect(body.filasMuestra).toBe(1);
        expect(body.filas[0]).toMatchObject({ suscripcionId: 1 });
        expect(typeof body.duracionMs).toBe("number");
        expect(body.limitAplicado).toBe(50); // default (sin ParametroSistema en test)
        expect(body.timeoutMs).toBe(5000);
    });

    it("200: audita REGLA_SQL_TEST solo con metadatos (sin filas ni SQL completo)", async () => {
        const admin = await adminAutenticado();
        await llamar({ sqlQuery: "SELECT 42 AS valor" });
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "REGLA_SQL_TEST", usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
        const metadatos = audit?.metadatos as Record<string, unknown>;
        expect(metadatos.huellaQuery).toMatch(/^[0-9a-f]{16}$/);
        expect(typeof metadatos.duracionMs).toBe("number");
        expect(metadatos.filasMuestra).toBe(1);
        expect(JSON.stringify(metadatos)).not.toContain("SELECT 42");
        expect(metadatos.filas).toBeUndefined();
    });

    it("400: mutación y multi-sentencia se rechazan sin ejecutarse", async () => {
        await adminAutenticado();
        for (const sqlQuery of [
            "DELETE FROM \"suscripciones\"",
            "SELECT 1; DROP TABLE \"suscripciones\"",
            "WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x",
        ]) {
            const res = await llamar({ sqlQuery });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe("VALIDATION_ERROR");
        }
        const audits = await prisma.auditLog.count({ where: { accion: "REGLA_SQL_TEST" } });
        expect(audits).toBe(0);
    });

    it("400: tabla inexistente devuelve mensaje legible sin stack trace", async () => {
        await adminAutenticado();
        const res = await llamar({ sqlQuery: "SELECT * FROM tabla_que_no_existe_224" });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("La consulta falló");
        expect(body.error.message.length).toBeLessThan(400);
    });

    it("400: timeout de statement_timeout con parámetro bajo (pg_sleep)", async () => {
        await adminAutenticado();
        await prisma.parametroSistema.upsert({
            where: { clave: "analisis.reglas.test_timeout_ms" },
            update: { valor: "1000" },
            create: {
                clave: "analisis.reglas.test_timeout_ms",
                valor: "1000",
                tipo: "INTEGER",
                categoria: "SYSTEM",
                esPublico: false,
                esSecreto: false,
                descripcion: "test",
            },
        });
        const res = await llamar({ sqlQuery: "SELECT pg_sleep(5)" });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toContain("tiempo máximo de prueba (1000 ms)");
    }, 20000);

    it("401: sin sesión / 403: rol distinto de ADMIN", async () => {
        mockToken = undefined;
        expect((await llamar({ sqlQuery: "SELECT 1" })).status).toBe(401);
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        expect((await llamar({ sqlQuery: "SELECT 1" })).status).toBe(403);
    });
});

describe("SC-003: la transacción READ ONLY es la barrera real", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("PostgreSQL rechaza una escritura dentro de la TX de solo lectura (25006)", async () => {
        const repo = new ReglasRecomendacionRepository();
        // Prisma envuelve el error crudo como P2010; el 25006 real va en meta.code.
        await expect(
            repo.ejecutarQuerySoloLectura(
                "INSERT INTO \"reglas_recomendacion\" (id, clave, nombre, descripcion, categoria, \"sqlQuery\", \"plantillaRecomendacion\", \"creadaPorAdminId\") VALUES ('x-25006', 'x', 'x', 'x', 'x', 'SELECT 1', 'x', 'x')",
                5000
            )
        ).rejects.toMatchObject({ code: "P2010", meta: { code: "25006" } });
        const coladas = await prisma.reglaRecomendacion.count({ where: { id: "x-25006" } });
        expect(coladas).toBe(0);
    });
});
