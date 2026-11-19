/**
 * SPEC-923 · CANDADO de COBERTURA del barrido de correos (capa de BASE, integración).
 *
 * Corre el SEED REAL sobre la base de prueba limpia y exige que TODA plantilla sembrada esté en el registro
 * único o en PENDIENTES, y que ninguna pendiente esté muerta. Es la verdad que la capa estática no ve
 * (claves armadas con template literal, eventos por constante). Corre en `test-integration` (lo exige
 * `pi-gate`), no en e2e: e2e en PR es condicional y no bloquea.
 */
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { CORREOS_CANONICOS } from "../../../prisma/correos-canonicos.seed-data";
import { COPYS_HUERFANOS, COPYS_PENDIENTES, violacionesCobertura } from "../../../prisma/correos-canonicos.pendientes";

const RAIZ = path.resolve(__dirname, "../../..");

describe("SPEC-923 · cobertura del barrido de correos (capa BD: seed real)", { timeout: 180_000 }, () => {
    let vivas: string[] = [];

    beforeAll(async () => {
        await resetDatabase();
        // El seed corre como en el deploy: su propio proceso, contra ESTA base (DATABASE_URL heredada del arnés).
        // La siembra no corre como «test» (mismo criterio que el job e2e).
        const env = { ...process.env, NODE_ENV: "development" as const };
        execFileSync(process.execPath, ["--env-file=.env.test", "--import", "tsx", "prisma/seed.ts"], {
            cwd: RAIZ,
            env,
            stdio: "pipe",
        });
        vivas = (await prisma.notificacionPlantilla.findMany({ select: { clave: true } })).map((p) => p.clave);
    }, 180_000);

    it("el seed sembró plantillas (si da 0, la sonda está rota)", () => {
        expect(vivas.length).toBeGreaterThan(50);
    });

    it("toda plantilla sembrada está en el registro, en PENDIENTES o en HUERFANAS", () => {
        expect(
            violacionesCobertura(
                { vivas },
                CORREOS_CANONICOS.map((c) => c.clave),
                COPYS_PENDIENTES.map((p) => p.clave),
                COPYS_HUERFANOS.map((h) => h.clave)
            )
        ).toEqual([]);
    });
});
