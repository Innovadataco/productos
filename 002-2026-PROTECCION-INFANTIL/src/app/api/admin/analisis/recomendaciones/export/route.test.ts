/**
 * SPEC-227 (002-PI-128): tests de integración de
 * GET /api/admin/analisis/recomendaciones/export (FR-006/007/008, SC-004):
 * columnas exactas, hash estable y sin PII, tope 413, AuditLog, fail-closed
 * sin sal, auth 401/403. NOTA: integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CategoriaParametro, TipoParametro } from "@prisma/client";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { pseudonimizarSujeto } from "@/lib/analisis/pseudonimizar";

const SAL_TEST = "sal-integracion-32-chars-minimo-000";
const ENCABEZADO =
    "recomendacion_id,regla_clave,regla_nombre,categoria,prioridad,estado,generada_en,resuelta_en,tiempo_resolucion_horas,ejecutada_automatica,sujeto_tipo,sujeto_hash";

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

const URL_BASE = "http://localhost:5005/api/admin/analisis/recomendaciones/export";

const TITULO_PII = "Llama a Colegio Ejemplo PII 3001112233";

async function sembrarRecomendacion(adminId: string, sujetoId: string) {
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.exp"),
            nombre: "Regla export",
            descripcion: "Regla",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            creadaPorAdminId: adminId,
        },
    });
    await prisma.recomendacion.create({
        data: {
            reglaId: regla.id,
            titulo: TITULO_PII,
            descripcion: "Descripción con datos del cliente 3001112233",
            categoria: "renovacion",
            prioridad: 80,
            sujetoTipo: "Suscripcion",
            sujetoId,
            datosContexto: { dedupKey: unico("k"), telefono: "3001112233" },
            estado: "APLICADA",
            generadaEn: new Date("2026-08-20T19:05:00.000Z"),
            resueltaEn: new Date("2026-08-21T14:30:00.000Z"),
            expiraEn: new Date("2026-08-27T19:05:00.000Z"),
        },
    });
    return regla;
}

function llamar(qs = "") {
    return GET(crearRequestAutenticado("GET", `${URL_BASE}${qs}`, undefined, mockToken));
}

describe("GET /api/admin/analisis/recomendaciones/export", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        process.env.ANALISIS_EXPORT_SALT = SAL_TEST;
    });

    afterEach(() => {
        delete process.env.ANALISIS_EXPORT_SALT;
    });

    it("200: CSV con encabezado exacto, hash estable, sin PII y AuditLog registrado", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const sujetoId = unico("suj");
        await sembrarRecomendacion(admin.id, sujetoId);

        const res = await llamar();
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/csv");
        expect(res.headers.get("Content-Disposition")).toContain("attachment");
        expect(res.headers.get("Content-Disposition")).toContain("recomendaciones-");

        const csv = await res.text();
        const lineas = csv.split("\n");
        expect(lineas[0]).toBe(ENCABEZADO);
        expect(lineas).toHaveLength(2);

        // Hash opaco estable, nunca el id crudo.
        const hashEsperado = pseudonimizarSujeto(sujetoId, SAL_TEST);
        expect(lineas[1]).toContain(hashEsperado);
        expect(lineas[1]).not.toContain(sujetoId);

        // Verificación de ausencia de PII: ni título, ni descripción, ni teléfono.
        expect(csv).not.toContain(TITULO_PII);
        expect(csv).not.toContain("3001112233");
        expect(csv).not.toContain("Descripción con datos");

        // Hash estable entre dos exports del mismo sujeto.
        const res2 = await llamar();
        const csv2 = await res2.text();
        expect(csv2.split("\n")[1]).toContain(hashEsperado);

        // AuditLog de la exportación (filtros + conteo, sin contenido).
        const logs = await prisma.auditLog.count({
            where: { accion: "RECOMENDACIONES_EXPORT_CSV", usuarioId: admin.id },
        });
        expect(logs).toBe(2);
    });

    it("200: export con 0 filas devuelve solo el encabezado (no es error)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar();
        expect(res.status).toBe(200);
        expect(await res.text()).toBe(ENCABEZADO);
    });

    it("413: el conjunto filtrado supera el tope parametrizado", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await sembrarRecomendacion(admin.id, unico("suj"));
        await sembrarRecomendacion(admin.id, unico("suj"));
        await prisma.parametroSistema.create({
            data: {
                clave: "analisis.recomendaciones.export_max_filas",
                valor: "1",
                tipo: TipoParametro.INTEGER,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                esSecreto: false,
                descripcion: "test",
            },
        });

        const res = await llamar();
        expect(res.status).toBe(413);
        const body = await res.json();
        expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("500: fail-closed sin ANALISIS_EXPORT_SALT (nunca exporta el id crudo)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await sembrarRecomendacion(admin.id, unico("suj"));
        delete process.env.ANALISIS_EXPORT_SALT;

        const res = await llamar();
        expect(res.status).toBe(500);
    });

    it("400: filtro inválido", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar("?ejecutadaAutomatica=quiza");
        expect(res.status).toBe(400);
    });

    it("401: sin sesión", async () => {
        mockToken = undefined;
        const res = await llamar();
        expect(res.status).toBe(401);
    });

    it("403: rol distinto de ADMIN", async () => {
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await llamar();
        expect(res.status).toBe(403);
    });
});
