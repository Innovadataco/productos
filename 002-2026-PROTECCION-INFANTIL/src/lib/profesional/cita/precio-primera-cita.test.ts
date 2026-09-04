/**
 * SPEC-428 · `leerPrecioEstandarPrimeraCita` es el helper que la ruta usa
 * antes de crear una cita para forzar el precio ESTÁNDAR. Si el parámetro
 * no existe o su valor no es un entero positivo, el helper TIENE que
 * explotar ruidoso — el candado que evita que un despliegue sin seed cobre
 * la tarifa del profesional por accidente (CEO 22:5x).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { leerPrecioEstandarPrimeraCita } from "./precio-primera-cita";

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

describe("SPEC-428 · leerPrecioEstandarPrimeraCita", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.parametroSistema.deleteMany({ where: { clave: CLAVE } });
    });
    afterAll(async () => {
        await prisma.parametroSistema.deleteMany({ where: { clave: CLAVE } });
    });

    it("devuelve el entero cuando el parámetro está sembrado y es válido", async () => {
        await upsertParametro("50000");
        await expect(leerPrecioEstandarPrimeraCita()).resolves.toBe(50000);
    });

    it("EXPLOTA con AppError si el parámetro no existe (candado deploy sin seed)", async () => {
        // No sembramos nada. Sin parámetro, la ruta NO puede cobrar por accidente
        // la tarifa del profesional; el AppError sube al errorToResponse y termina
        // en 500 con mensaje claro sobre qué parámetro falta.
        await expect(leerPrecioEstandarPrimeraCita()).rejects.toBeInstanceOf(AppError);
        await expect(leerPrecioEstandarPrimeraCita()).rejects.toMatchObject({
            code: ERROR_CODES.INTERNAL_ERROR,
            statusCode: 500,
        });
    });

    it("EXPLOTA con AppError si el valor no es un entero positivo", async () => {
        const casos = ["0", "-100", "abc", ""];
        for (const valor of casos) {
            await upsertParametro(valor);
            await expect(leerPrecioEstandarPrimeraCita(), `valor=${JSON.stringify(valor)}`)
                .rejects.toBeInstanceOf(AppError);
            await expect(leerPrecioEstandarPrimeraCita(), `valor=${JSON.stringify(valor)}`)
                .rejects.toMatchObject({ code: ERROR_CODES.INTERNAL_ERROR });
        }
    });

    it("redondea un decimal positivo (compatibilidad con seeds mal serializados)", async () => {
        await upsertParametro("50000.4");
        await expect(leerPrecioEstandarPrimeraCita()).resolves.toBe(50000);
    });
});
