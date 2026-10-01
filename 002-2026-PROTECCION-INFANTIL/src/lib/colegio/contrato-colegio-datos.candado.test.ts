/**
 * SPEC-796 · Candado de la CAPA DE DATOS del contrato firmado del colegio (D-121).
 *
 * Prueba, con la base CORRIENDO, las cuatro invariantes que el CEO fijó — ninguna por
 * inspección de texto, todas ejercitando la BD (Prisma es ciego al trigger y al modo del FK):
 *
 *   1. El HECHO es append-only: cambiar archivoId/sha256/adjuntadoEn/adjuntadoPorSnapshot/
 *      colegioSnapshot/creadoEn de una fila existente → el trigger LANZA. (invariante 1 y 4)
 *   2. SOBREVIVE al borrado OPERATIVO del colegio: borrar el Colegio NULEA el enlace (SET NULL) y
 *      la fila-prueba sigue viva con el HECHO intacto — el trigger de inmutabilidad NO bloquea ese
 *      SET NULL. Estructuralmente, los dos FK son SET NULL ('n'). (invariante 2)
 *   3. SÍ lo borra la purga DEMO: una fila MARCADA se va al correr `purgar({corrida})`; una NO
 *      marcada sobrevive (control positivo). Prueba que está en ORDEN_BORRADO. (invariante 3)
 *   4. El parámetro de retención se siembra MARCADO y SIN número (ningún default — I-434). (inv. 5)
 *
 * Integración (vive en src/** a propósito: un test de integración fuera de src/ no corre en CI).
 * Usa la MISMA conexión Prisma que `purgar` para que la purga vea las filas que se plantan.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../../scripts/demo-prod/lib/prisma";
import { purgar } from "../../../scripts/demo-prod/purgar-demo";

const SHA_FALSO = "f".repeat(64);

function datosContrato(tag: string) {
    return {
        colegioSnapshot: `colegio-${tag} · NIT 796-${tag}`,
        archivoId: randomUUID(),
        sha256: SHA_FALSO,
        adjuntadoEn: new Date("2026-09-30T12:00:00.000Z"),
        adjuntadoPorSnapshot: `admin-${tag}@test.local · SCHOOL_ADMIN`,
    };
}

/** Ejecuta `fn` esperando que RECHACE; devuelve el mensaje de error para aseverar sobre él. */
async function mensajeDeRechazo(fn: () => Promise<unknown>): Promise<string> {
    try {
        await fn();
    } catch (e) {
        return e instanceof Error ? e.message : String(e);
    }
    throw new Error("Se esperaba un rechazo de la BD y la operación tuvo éxito");
}

afterAll(async () => {
    await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1 · APPEND-ONLY: el hecho es inmutable (trigger). Una corrección adjunta fila nueva.
// ─────────────────────────────────────────────────────────────────────────────
describe("SPEC-796 · ContratoColegio es append-only (trigger de inmutabilidad)", () => {
    let id: string;

    beforeAll(async () => {
        const row = await prisma.contratoColegio.create({ data: datosContrato("inmut") });
        id = row.id;
    });

    afterAll(async () => {
        await prisma.contratoColegio.deleteMany({ where: { id } });
    });

    it("cambiar un campo del HECHO lanza (archivoId)", async () => {
        const msg = await mensajeDeRechazo(() =>
            prisma.contratoColegio.update({ where: { id }, data: { archivoId: randomUUID() } }),
        );
        expect(msg).toMatch(/append-only|inmutable|SPEC-796/i);
    });

    it("cambiar sha256, adjuntadoEn, adjuntadoPorSnapshot o colegioSnapshot también lanza", async () => {
        const intentos: Array<Record<string, unknown>> = [
            { sha256: "0".repeat(64) },
            { adjuntadoEn: new Date("2020-01-01T00:00:00.000Z") },
            { adjuntadoPorSnapshot: "otro" },
            { colegioSnapshot: "otro colegio" },
        ];
        for (const data of intentos) {
            const msg = await mensajeDeRechazo(() => prisma.contratoColegio.update({ where: { id }, data }));
            expect(msg, `debió lanzar al tocar ${Object.keys(data)[0]}`).toMatch(/append-only|inmutable|SPEC-796/i);
        }
    });

    it("el HECHO sobrevive intacto tras los intentos de cambio", async () => {
        const row = await prisma.contratoColegio.findUniqueOrThrow({ where: { id } });
        expect(row.sha256).toBe(SHA_FALSO);
        expect(row.adjuntadoEn.toISOString()).toBe("2026-09-30T12:00:00.000Z");
    });

    it("tocar SOLO un enlace (no-fact) NO lo bloquea el trigger — necesario para el SET NULL del borrado", async () => {
        // suscripcionId ya es null; setearlo a null es un UPDATE que dispara el trigger BEFORE UPDATE.
        // Si la guarda estuviera mal (bloqueara todo UPDATE), esto lanzaría. Debe pasar.
        await expect(
            prisma.contratoColegio.update({ where: { id }, data: { suscripcionId: null } }),
        ).resolves.toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · SOBREVIVE al borrado OPERATIVO del colegio (SET NULL + el trigger lo permite).
// ─────────────────────────────────────────────────────────────────────────────
describe("SPEC-796 · el contrato sobrevive al borrado operativo del colegio (SET NULL)", () => {
    const creados = { paisId: "", ciudadId: "", tenantId: "", contratoId: "" };

    afterAll(async () => {
        await prisma.contratoColegio.deleteMany({ where: { id: creados.contratoId } });
        await prisma.tenant.deleteMany({ where: { id: creados.tenantId } });
        await prisma.ciudad.deleteMany({ where: { id: creados.ciudadId } });
        await prisma.pais.deleteMany({ where: { id: creados.paisId } });
    });

    it("borrar el Colegio nulea colegioId y la fila-prueba sigue viva con el HECHO intacto", async () => {
        const sufijo = `${Date.now()}`;
        const pais = await prisma.pais.create({ data: { codigo: `T796${sufijo.slice(-6)}`, nombre: "TestPais796" } });
        const ciudad = await prisma.ciudad.create({ data: { nombre: "TestCiudad796", paisId: pais.id } });
        const tenant = await prisma.tenant.create({ data: { nombre: "TestTenant796" } });
        const colegio = await prisma.colegio.create({
            data: {
                nombre: "Colegio Test 796",
                nit: `NIT-796-${sufijo}`,
                paisId: pais.id,
                ciudadId: ciudad.id,
                representanteLegalNombre: "Rep Legal",
                representanteLegalIdentificacion: "CC-796",
                representanteLegalEmail: "rep796@test.local",
                inicioServicio: new Date("2026-01-01T00:00:00.000Z"),
                tipoPeriodo: "ANUAL",
                tenantId: tenant.id,
            },
        });
        creados.paisId = pais.id;
        creados.ciudadId = ciudad.id;
        creados.tenantId = tenant.id;

        const datos = datosContrato("setnull");
        const contrato = await prisma.contratoColegio.create({
            data: { ...datos, colegioId: colegio.id, colegioSnapshot: `${colegio.id} · ${colegio.nombre} · NIT ${colegio.nit}` },
        });
        creados.contratoId = contrato.id;

        // Borrado OPERATIVO del colegio (como borrar-colegio.ts en su último paso).
        await prisma.colegio.delete({ where: { id: colegio.id } });

        const tras = await prisma.contratoColegio.findUnique({ where: { id: contrato.id } });
        expect(tras, "el contrato debe SOBREVIVIR al borrado del colegio").not.toBeNull();
        expect(tras?.colegioId, "colegioId quedó en NULL (SET NULL)").toBeNull();
        // El HECHO (incl. la identidad durable) intacto: el SET NULL no lo pudo tocar.
        expect(tras?.archivoId).toBe(datos.archivoId);
        expect(tras?.sha256).toBe(datos.sha256);
        expect(tras?.colegioSnapshot).toContain(colegio.nit);
    });

    it("los dos FK son SET NULL ('n') en el catálogo (estructural)", async () => {
        const fks = await prisma.$queryRawUnsafe<Array<{ conname: string; confdeltype: string }>>(
            `SELECT con.conname, con.confdeltype::text AS confdeltype
               FROM pg_constraint con
               JOIN pg_class c ON c.oid = con.conrelid
              WHERE c.relname = 'contrato_colegio' AND con.contype = 'f'`,
        );
        expect(fks.length, "deben existir los dos FK (colegioId, suscripcionId)").toBe(2);
        for (const fk of fks) {
            expect(fk.confdeltype, `${fk.conname} debe ser SET NULL ('n')`).toBe("n");
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · SÍ lo borra la purga DEMO (ORDEN_BORRADO). Control positivo: la no marcada sobrevive.
// ─────────────────────────────────────────────────────────────────────────────
describe("SPEC-796 · la purga demo borra el contrato MARCADO y respeta el no marcado", () => {
    const corrida = `test796-${Date.now()}`;
    let noMarcadoId = "";

    afterAll(async () => {
        await prisma.contratoColegio.deleteMany({ where: { id: noMarcadoId } });
        await prisma.demoMarcado.deleteMany({ where: { metadata: { path: ["corrida"], equals: corrida } } });
    });

    it("purgar({corrida}) borra el ContratoColegio marcado y deja vivo el no marcado", async () => {
        const marcado = await prisma.contratoColegio.create({ data: datosContrato("demo-marcado") });
        const noMarcado = await prisma.contratoColegio.create({ data: datosContrato("demo-control") });
        noMarcadoId = noMarcado.id;

        await prisma.demoMarcado.create({
            data: { entidad: "ContratoColegio", entidadId: marcado.id, metadata: { corrida, script: "test-796" } },
        });

        await purgar({ corrida });

        expect(
            await prisma.contratoColegio.findUnique({ where: { id: marcado.id } }),
            "el contrato MARCADO debe estar borrado (está en ORDEN_BORRADO)",
        ).toBeNull();
        expect(
            await prisma.contratoColegio.findUnique({ where: { id: noMarcado.id } }),
            "el contrato NO marcado debe sobrevivir (la purga es por marca)",
        ).not.toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · El parámetro de retención: MARCADO y SIN número (I-434). Lectura de la FUENTE del seed.
// ─────────────────────────────────────────────────────────────────────────────
describe("SPEC-796 · el plazo de retención se siembra marcado, sin un número por default", () => {
    const SEED = fs.readFileSync(path.join(process.cwd(), "prisma", "seed.ts"), "utf-8");
    const bloque = SEED.match(
        /clave:\s*"contrato\.colegio\.retencion_dias"[\s\S]{0,600}?valor:\s*"([^"]+)"/,
    );

    it("el seed siembra la clave contrato.colegio.retencion_dias", () => {
        expect(bloque, "el seed debe sembrar contrato.colegio.retencion_dias con un valor").not.toBeNull();
    });

    it("el valor está MARCADO para el abogado y NO es un número (sin default — I-434)", () => {
        const valor = bloque?.[1] ?? "";
        expect(valor, "debe llevar la marca [ABOGADO").toMatch(/\[ABOGADO/);
        expect(valor.trim(), "NO puede ser un número pelado: eso sería un plazo legal inventado").not.toMatch(/^\d+$/);
    });

    it("el tipo del parámetro es STRING (un INTEGER delataría un número sembrado)", () => {
        const conTipo = SEED.match(
            /clave:\s*"contrato\.colegio\.retencion_dias"[\s\S]{0,800}?tipo:\s*TipoParametro\.(\w+)/,
        );
        expect(conTipo?.[1]).toBe("STRING");
    });
});
