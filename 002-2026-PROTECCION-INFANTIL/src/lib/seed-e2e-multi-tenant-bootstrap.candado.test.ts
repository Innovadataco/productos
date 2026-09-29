/**
 * CANDADO · SPEC-288 · `sembrarColegioE2E` BOOTSTRAPEA una BD FRESCA sin reventar.
 *
 * OJO: esto NO es el 401 de Calidad (su re-siembra corre contra una BD ESTABLECIDA, donde estos
 * `create` se saltan por `findFirst`). Es lo que hace falta para levantar un ENTORNO NUEVO o una
 * corrida limpia. Por eso el candado corre contra BD FRESCA (`resetDatabase`): en base establecida
 * los defectos no se ven — los `create` no se ejecutan.
 *
 * Cubre dos latentes que arrastraba `sembrarColegioE2E` y que sólo afloran en BD fresca:
 *  1. los 2 alumnos compartían `documentoNumero` (`E2E-EST-${letra}`) → chocaban con el único
 *     (colegioId, documentoTipo, documentoNumero) de SPEC-320 y reventaba la tx entera. Ahora el
 *     número se deriva del `idx` → único por alumno, escala solo a N.
 *  2. `crearReporteFixture(tx, …)` tomaba la rama `PrismaClient` porque el cliente ITX de Prisma 5
 *     ES `instanceof PrismaClient` (pero no expone `$transaction`) → «db.$transaction is not a
 *     function». La guarda del fixture ahora detecta por el MÉTODO, no por `instanceof`.
 *
 * Control positivo: revertir cualquiera de los dos arreglos hace que la 1ª corrida (BD fresca)
 * reviente → este candado se pone rojo. Verificado por mutación.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { sembrarColegioE2E } from "../../scripts/seed-e2e-multi-tenant";

const PASSWORD = "ClaveColegioBootstrap-2026!";

interface Base {
    paisId: string;
    ciudadId: string;
    plataformaId: string;
}

async function sembrarBase(): Promise<Base> {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    let bogota = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá", paisId: pais.id }, select: { id: true } });
    bogota ??= await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id }, select: { id: true } });
    const plataforma = await prisma.plataforma.upsert({ where: { clave: "whatsapp" }, update: {}, create: { clave: "whatsapp", nombre: "WhatsApp" } });
    return { paisId: pais.id, ciudadId: bogota.id, plataformaId: plataforma.id };
}

describe("SPEC-288 · seed multi-tenant bootstrapea una BD fresca (alumnos con documento único + reporte con tx)", () => {
    let base: Base;
    beforeEach(async () => {
        await resetDatabase();
        base = await sembrarBase();
    });

    const correr = (letra: "A" | "B") =>
        prisma.$transaction((tx) => sembrarColegioE2E(tx, letra, PASSWORD, base.plataformaId, base.paisId, base.ciudadId));

    it("BD FRESCA: la 1ª corrida no revienta — 2 alumnos con documentoNumero ÚNICO y 1 reporte creado (fixture con tx)", async () => {
        const r = await correr("A");
        const alumnos = await prisma.estudiante.findMany({ where: { colegioId: r.colegioId }, select: { documentoNumero: true } });
        expect(alumnos, "los 2 alumnos se crean (antes el 2º chocaba con el único)").toHaveLength(2);
        expect(new Set(alumnos.map((a) => a.documentoNumero)).size, "documentoNumero único por alumno").toBe(2);
        // El reporte prueba que crearReporteFixture aceptó el TransactionClient (guarda por método).
        expect(await prisma.reporte.count({ where: { identificador: "@e2e-A-target" } }), "el reporte se crea con el fixture dentro de la tx").toBe(1);
    });

    it("idempotente en BD fresca: la 2ª corrida no duplica alumnos ni reporte y no revienta", async () => {
        const r = await correr("A");
        await correr("A");
        expect(await prisma.estudiante.count({ where: { colegioId: r.colegioId } }), "no duplica alumnos").toBe(2);
        expect(await prisma.reporte.count({ where: { identificador: "@e2e-A-target" } }), "no duplica reporte").toBe(1);
    });
});
