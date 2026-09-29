/**
 * CANDADO · SPEC-781 (D-121 · Decreto 1377 art. 12) — la BD, no la app, garantiza el contrato de
 * `AudienciaMenor`. Prisma es ciego al UNIQUE/CHECK crudo; estos candados prueban la CONDUCTA contra
 * Postgres por INSERCIÓN real.
 *
 *  (1) UNICIDAD (menor, versión de consentimiento) en las DOS direcciones: el segundo intento sobre
 *      el mismo par → 23505; control positivo → con versión distinta, entra. Declarar dos veces lo
 *      mismo NO crea dos hechos.
 *  (2) RETENCIÓN DERIVADA: borrar al MENOR arrastra su audiencia (Cascade; retención atada a la
 *      madre), sin 23503. Control positivo: existía antes.
 *  (3) declaradoPor SetNull: borrar al REPRESENTANTE vacía la FK, NO borra la audiencia — porque el
 *      rastro durable NO vive acá (vive en AuditLog).
 *  (4) El COMENTARIO del schema ES el mecanismo del rastro durable (no un candado de conducta):
 *      meta-aserción de que sigue presente, para que no se borre en silencio.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";

let contador = 0;

async function seedHijo(): Promise<{ hijoId: string; padreId: string }> {
    const padre = await crearUsuario("PARENT");
    const hijo = await prisma.hijo.create({ data: { usuarioId: padre.id, nombre: "Menor Prueba" } });
    return { hijoId: hijo.id, padreId: padre.id };
}

/** INSERT crudo (Prisma es ciego al UNIQUE); parametriza los valores. `declaradoPor` puede ser null. */
function insertarAudiencia(hijoId: string, version: string, declaradoPor: string | null) {
    const id = `aud-test-${Date.now()}-${contador++}`;
    return prisma.$executeRaw`
        INSERT INTO "AudienciaMenor" (id, "hijoId", "consentimientoVersion", "declaradoPor", "ocurridoEn")
        VALUES (${id}, ${hijoId}, ${version}, ${declaradoPor}, now())
    `;
}

function detalleError(err: unknown): string {
    return `${(err as Error)?.message ?? ""} ${JSON.stringify((err as { meta?: unknown })?.meta ?? {})}`;
}

describe("SPEC-781 · AudienciaMenor · unicidad (menor, versión) por inserción real", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("segundo intento sobre el MISMO (menor, versión) → rechazo (23505)", async () => {
        const { hijoId, padreId } = await seedHijo();
        await insertarAudiencia(hijoId, "conv-v1", padreId);
        let err: unknown;
        try {
            await insertarAudiencia(hijoId, "conv-v1", padreId);
        } catch (e) {
            err = e;
        }
        expect(err, "declarar dos veces el mismo (menor, versión) DEBE fallar: dos veces no es dos hechos").toBeDefined();
        expect(detalleError(err)).toMatch(/23505|AudienciaMenor_hijoId_consentimientoVersion_key/);
    });

    it("control positivo · con una versión DISTINTA entra (la unicidad no rechaza todo)", async () => {
        const { hijoId, padreId } = await seedHijo();
        await insertarAudiencia(hijoId, "conv-v1", padreId);
        await insertarAudiencia(hijoId, "conv-v2", padreId);
        expect(await prisma.audienciaMenor.count({ where: { hijoId } })).toBe(2);
    });
});

describe("SPEC-781 · AudienciaMenor · retención derivada (Cascade del menor) + declaradoPor SetNull", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("borrar al MENOR arrastra su audiencia (retención atada a la madre), sin 23503", async () => {
        const { hijoId, padreId } = await seedHijo();
        await insertarAudiencia(hijoId, "conv-v1", padreId);
        expect(await prisma.audienciaMenor.count({ where: { hijoId } }), "control positivo: existía").toBe(1);
        await prisma.hijo.delete({ where: { id: hijoId } });
        expect(await prisma.audienciaMenor.count({ where: { hijoId } })).toBe(0);
    });

    it("borrar al REPRESENTANTE vacía declaradoPor, NO borra la audiencia (el rastro durable no vive acá)", async () => {
        const { hijoId } = await seedHijo();
        const otroRepresentante = await crearUsuario("PARENT"); // declara, pero no es dueño de la ficha
        await insertarAudiencia(hijoId, "conv-v1", otroRepresentante.id);
        await prisma.usuario.delete({ where: { id: otroRepresentante.id } });
        const fila = await prisma.audienciaMenor.findFirst({ where: { hijoId } });
        expect(fila, "la audiencia sobrevive").not.toBeNull();
        expect(fila!.declaradoPor, "declaradoPor se vació (SetNull): es conveniencia, no responsabilidad").toBeNull();
    });
});

describe("SPEC-781 · el COMENTARIO del schema es el mecanismo del rastro durable", () => {
    it("el schema declara que la responsabilidad durable vive en AuditLog (comentario presente)", () => {
        const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
        const desde = schema.indexOf("model AudienciaMenor");
        expect(desde, "el modelo AudienciaMenor debe existir").toBeGreaterThan(-1);
        const bloque = schema.slice(desde, schema.indexOf("\n}", desde));
        expect(bloque, "el comentario debe decir que el rastro durable vive en AuditLog").toMatch(/AuditLog/);
        expect(bloque, "y que declaradoPor NO es el registro de responsabilidad").toMatch(/NO es el registro de responsabilidad/i);
    });
});
