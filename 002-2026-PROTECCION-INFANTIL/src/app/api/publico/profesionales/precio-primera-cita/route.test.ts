/**
 * SPEC-428 · GET /api/publico/profesionales/precio-primera-cita
 * Endpoint PÚBLICO (sin JWT). Cubierto por `GUARDIAS_ACCESO.publicas` con la
 * entrada `"/api/publico"` (matcheaRuta por segmento) — barrido arch:check en
 * `02-roles-capacidades.md` marca `ANONIMO → permitir`. Este test cierra el
 * contrato del handler: sin cookie de sesión, responde 200 con el número.
 * Ver: guardias.ts:54 y línea `ANONIMO` de precio-primera-cita en el barrido.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { GET } from "./route";

const CLAVE = "profesional.cita.precio_estandar_primera_cita_cop";

async function upsertParametro(valor: string) {
    await prisma.parametroSistema.upsert({
        where: { clave: CLAVE },
        update: { valor },
        create: {
            clave: CLAVE,
            valor,
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            esSecreto: false,
            descripcion: "test",
        },
    });
}

describe("GET /api/publico/profesionales/precio-primera-cita (SPEC-428)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.parametroSistema.deleteMany({ where: { clave: CLAVE } });
    });
    afterAll(async () => {
        await prisma.parametroSistema.deleteMany({ where: { clave: CLAVE } });
    });

    it("responde 200 SIN sesión con el precio estándar sembrado (endpoint público)", async () => {
        await upsertParametro("50000");
        // No hay cookie de sesión: el handler no llama verifyAuth y el proxy
        // deja pasar por `/api/publico` (guardias.ts:54).
        const res = await GET();
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { precioCOP: number } };
        expect(body.data.precioCOP).toBe(50000);
    });

    it("responde 500 con AppError sin parámetro sembrado (candado deploy sin seed)", async () => {
        // Sin sembrar: el helper explota, y errorToResponse convierte a JSON
        // con statusCode del AppError (500).
        const res = await GET();
        expect(res.status).toBe(500);
    });
});
