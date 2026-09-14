/**
 * SPEC-693 (I-416) · CENTINELA de los índices únicos PARCIALES de DocumentoProfesional.
 *
 * La unicidad «≤1 VIGENTE y ≤1 EN_REVISION por (perfil,requisito)» NO se expresa en el
 * DSL de Prisma: son dos índices únicos PARCIALES escritos a mano en la migración. Como
 * Prisma no los conoce, un `migrate dev` podría proponer borrarlos (D-121, Datos). Este
 * candado es su guardián: mira el catálogo REAL (`pg_indexes.indexdef`, no una lista de
 * nombres) y además INTENTA la doble inserción — si alguien borra los índices, la 2ª
 * VIGENTE deja de dar 23505 (P2002) y el candado cae. Integración: los índices solo
 * existen tras `migrate deploy` (vive en `src/**` para que CI lo corra).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";

async function sembrarPerfil() {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }));
    const usuario = await crearUsuario("PROFESIONAL", `profe.${Date.now()}.${Math.random()}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "P",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 5,
            presentacion: "x",
            tarifaConsultaCOP: 100000,
            duracionMinutos: 45,
            atiendeVirtual: true,
            estado: "ACTIVO",
        },
    });
    return perfil.id;
}

function crearDoc(perfilId: string, estado: "VIGENTE" | "EN_REVISION" | "SUPERSEDIDA" | "DEVUELTA", sha: string) {
    return prisma.documentoProfesional.create({
        data: {
            perfilProfesionalId: perfilId,
            requisitoClave: "tarjeta",
            archivoId: `a-${sha}`,
            extension: "pdf",
            sha256: sha,
            estado,
        },
    });
}

describe("SPEC-693 · los índices únicos parciales existen en el catálogo", () => {
    afterAll(async () => prisma.$disconnect());

    it("pg_indexes tiene el parcial de VIGENTE y el de EN_REVISION, cada uno con su WHERE", async () => {
        const filas = await prisma.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
            `SELECT indexname, indexdef FROM pg_indexes
              WHERE tablename = 'DocumentoProfesional' AND indexdef ILIKE '%WHERE%'`,
        );
        const defs = filas.map((f) => f.indexdef);
        const vigente = defs.find((d) => /UNIQUE/i.test(d) && /estado = 'VIGENTE'/.test(d));
        const enRevision = defs.find((d) => /UNIQUE/i.test(d) && /estado = 'EN_REVISION'/.test(d));
        expect(vigente, "falta el índice único parcial WHERE estado='VIGENTE'").toBeTruthy();
        expect(enRevision, "falta el índice único parcial WHERE estado='EN_REVISION'").toBeTruthy();
        // Ambos sobre (perfil, requisito): la unicidad es por par, no global.
        expect(vigente).toMatch(/perfilProfesionalId/);
        expect(vigente).toMatch(/requisitoClave/);
    });
});

describe("SPEC-693 · la unicidad parcial se ENFORCEA en inserciones reales", () => {
    let perfilId: string;
    beforeEach(async () => {
        await resetDatabase();
        perfilId = await sembrarPerfil();
    });
    afterAll(async () => prisma.$disconnect());

    it("una 2ª VIGENTE para el mismo (perfil,requisito) → 23505 (P2002)", async () => {
        await crearDoc(perfilId, "VIGENTE", "sha-1");
        await expect(crearDoc(perfilId, "VIGENTE", "sha-2")).rejects.toMatchObject({ code: "P2002" });
    });

    it("una 2ª EN_REVISION para el mismo (perfil,requisito) → 23505 (P2002)", async () => {
        await crearDoc(perfilId, "EN_REVISION", "sha-1");
        await expect(crearDoc(perfilId, "EN_REVISION", "sha-2")).rejects.toMatchObject({ code: "P2002" });
    });

    it("control positivo: VIGENTE y EN_REVISION COEXISTEN, y el historial admite múltiples", async () => {
        // Es el corazón de la spec: seguir atendiendo con la vigente mientras se revisa la nueva.
        await crearDoc(perfilId, "VIGENTE", "sha-v");
        await expect(crearDoc(perfilId, "EN_REVISION", "sha-r")).resolves.toBeTruthy();
        // El historial (SUPERSEDIDA/DEVUELTA) no está bajo el índice parcial: varios permitidos.
        await expect(crearDoc(perfilId, "SUPERSEDIDA", "sha-s1")).resolves.toBeTruthy();
        await expect(crearDoc(perfilId, "SUPERSEDIDA", "sha-s2")).resolves.toBeTruthy();
    });
});
