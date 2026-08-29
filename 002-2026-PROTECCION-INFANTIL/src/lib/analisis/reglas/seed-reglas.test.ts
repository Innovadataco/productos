/**
 * SPEC-221 (002-PI-122): tests de integración del seed del motor de reglas.
 * - Idempotencia: dos corridas → exactamente 7 reglas, mismo conteo; el upsert
 *   NO pisa `modo`/`activa`/`sqlQuery` tuneados manualmente.
 * - Parámetros `analisis.recomendaciones.expiracion_dias` y `statement_timeout_ms`.
 * - Las 7 queries semilla pasan la validación estática y se ejecutan sin error
 *   contra la PostgreSQL de tests (sandbox read-only del DAL).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { seedReglasRecomendacion } from "../../../../prisma/seed";
import { REGLAS_SEMILLA } from "./seed-reglas";
import { validarSqlRegla } from "./ejecutor-sql";
import { ReglasRecomendacionRepository } from "@/lib/dal/repositories/reglas-recomendacion";

const ADMIN_EMAIL = "admin-semilla-221@test.local";

const CLAVES_ESPERADAS = [
    "vencimiento.T_menos_7",
    "mora.T_mas_30",
    "padres_de_colegio_no_renovado",
    "crecimiento_ciudad_anomalo",
    "cliente_puntual_ahora_atrasado",
    "alta_freemium_expira_manana",
    "nuevo_referido_registrado_sin_pagar_7d",
];

describe("seedReglasRecomendacion (SPEC-221)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearUsuario("ADMIN", ADMIN_EMAIL);
    });

    it("siembra las 7 reglas en modo RECOMIENDA y los 2 parámetros; idempotente", async () => {
        await seedReglasRecomendacion(ADMIN_EMAIL);

        const reglas = await prisma.reglaRecomendacion.findMany();
        expect(reglas).toHaveLength(7);
        expect(reglas.map((r) => r.clave).sort()).toEqual([...CLAVES_ESPERADAS].sort());
        for (const r of reglas) {
            expect(r.modo).toBe("RECOMIENDA");
            expect(r.activa).toBe(true);
            expect(r.plantillaRecomendacion).toContain("{{");
        }

        for (const clave of [
            "analisis.recomendaciones.expiracion_dias",
            "analisis.recomendaciones.statement_timeout_ms",
        ]) {
            const param = await prisma.parametroSistema.findUnique({ where: { clave } });
            expect(param).not.toBeNull();
            expect(param?.categoria).toBe("SYSTEM");
        }

        // Segunda corrida: mismos conteos (idempotencia SC-005).
        await seedReglasRecomendacion(ADMIN_EMAIL);
        expect(await prisma.reglaRecomendacion.count()).toBe(7);
    });

    it("el upsert no pisa modo, activa ni sqlQuery tuneados manualmente", async () => {
        await seedReglasRecomendacion(ADMIN_EMAIL);
        await prisma.reglaRecomendacion.update({
            where: { clave: "mora.T_mas_30" },
            data: { modo: "EJECUTA", activa: false, sqlQuery: "SELECT 1 AS tuneado" },
        });

        await seedReglasRecomendacion(ADMIN_EMAIL);

        const tuneada = await prisma.reglaRecomendacion.findUnique({ where: { clave: "mora.T_mas_30" } });
        expect(tuneada?.modo).toBe("EJECUTA");
        expect(tuneada?.activa).toBe(false);
        expect(tuneada?.sqlQuery).toBe("SELECT 1 AS tuneado");
        expect(await prisma.reglaRecomendacion.count()).toBe(7);
    });

    it("sin admin inicial: no crea reglas pero sí los parámetros (con warning)", async () => {
        await prisma.usuario.deleteMany({ where: { email: ADMIN_EMAIL } });
        await seedReglasRecomendacion(ADMIN_EMAIL);
        expect(await prisma.reglaRecomendacion.count()).toBe(0);
        expect(
            await prisma.parametroSistema.findUnique({
                where: { clave: "analisis.recomendaciones.expiracion_dias" },
            })
        ).not.toBeNull();
    });
});

describe("queries semilla contra la BD de tests", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("las 7 pasan la validación estática del sandbox", () => {
        for (const regla of REGLAS_SEMILLA) {
            expect(validarSqlRegla(regla.sqlQuery), `regla ${regla.clave}`).toEqual({ ok: true });
        }
    });

    it("las 7 se ejecutan sin error en transacción READ ONLY", async () => {
        const repo = new ReglasRecomendacionRepository();
        for (const regla of REGLAS_SEMILLA) {
            const filas = await repo.ejecutarQuerySoloLectura(regla.sqlQuery, 5000);
            expect(Array.isArray(filas), `regla ${regla.clave}`).toBe(true);
        }
    });

    it("el sandbox ejecuta una SELECT válida y devuelve filas", async () => {
        const repo = new ReglasRecomendacionRepository();
        const filas = await repo.ejecutarQuerySoloLectura("SELECT 1::int AS valor, 'x' AS sujeto_tipo", 5000);
        expect(filas).toHaveLength(1);
        expect(filas[0]).toMatchObject({ valor: 1, sujeto_tipo: "x" });
    });
});
