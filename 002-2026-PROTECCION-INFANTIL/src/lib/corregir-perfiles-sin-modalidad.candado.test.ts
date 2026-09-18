/**
 * SPEC-717 (I-428) · CANDADO DE INTEGRACIÓN — corrector de filas INDULTADAS por el CHECK de modalidad.
 *
 *   - Encuentra SOLO las filas no-BORRADOR sin ninguna modalidad (las que el CHECK NOT VALID indultó).
 *   - DRY-RUN deja la base IDÉNTICA.
 *   - --confirm las devuelve a BORRADOR (la única transición que el CHECK permite sobre ellas).
 *   - CONTROL POSITIVO: un ACTIVO CON modalidad NO se toca; un BORRADOR sin modalidad (legal) tampoco.
 *   - Idempotente: la 2ª corrida no encuentra nada.
 *   - ABORTA ante un flag desconocido (usa `parseArgs(process.argv, ["confirm"])`).
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { corregirPerfilesSinModalidad } from "../../scripts/corregir-perfiles-sin-modalidad";

const CHECK_MODALIDAD = "PerfilProfesional_modalidad_estado_check";

async function ciudadDePrueba(): Promise<string> {
    const existente = await prisma.ciudad.findFirst({ select: { id: true } });
    if (existente) return existente.id;
    const pais = await prisma.pais.create({ data: { codigo: "ZZ", nombre: "País E2E" } });
    return (await prisma.ciudad.create({ data: { nombre: "Ciudad E2E", paisId: pais.id } })).id;
}

async function crearUsuarioProf(emailLocal: string): Promise<string> {
    const u = await prisma.usuario.create({
        data: {
            email: `${emailLocal}.${Date.now()}.${Math.random()}@ejemplo.local`,
            nombre: "Prueba",
            passwordHash: "fixture-no-login",
            rol: "PROFESIONAL",
            estado: "activo",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
        },
        select: { id: true },
    });
    return u.id;
}

function datosPerfil(usuarioId: string, ciudadId: string) {
    return {
        usuarioId,
        nombreVisible: "Prueba",
        tituloProfesional: "Título",
        especialidades: [],
        ciudadId,
        aniosExperiencia: 3,
        presentacion: "x",
        tarifaConsultaCOP: 100000,
        duracionMinutos: 45,
    };
}

/** Perfil LEGAL (respeta el CHECK) en el estado y modalidad dados. */
async function crearPerfilLegal(
    ciudadId: string,
    emailLocal: string,
    estado: "BORRADOR" | "ACTIVO",
    modalidad: { atiendeVirtual?: boolean; atiendePresencial?: boolean },
): Promise<string> {
    const usuarioId = await crearUsuarioProf(emailLocal);
    const p = await prisma.perfilProfesional.create({
        data: {
            ...datosPerfil(usuarioId, ciudadId),
            estado,
            atiendeVirtual: modalidad.atiendeVirtual ?? false,
            atiendePresencial: modalidad.atiendePresencial ?? false,
        },
        select: { id: true },
    });
    return p.id;
}

/**
 * Crea una fila INDULTADA (como la cuenta E2E en prod): no-BORRADOR SIN modalidad. Baja el CHECK,
 * inserta y lo re-agrega TAL CUAL (con `pg_get_constraintdef`, NOT VALID incluido) para que la fila
 * ilegal sobreviva igual que en producción. Si el CHECK no existe en la BD de test, inserta directo.
 */
async function crearPerfilIndultado(ciudadId: string, emailLocal: string): Promise<string> {
    const usuarioId = await crearUsuarioProf(emailLocal);
    const filas = await prisma.$queryRawUnsafe<{ def: string }[]>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = '${CHECK_MODALIDAD}'`,
    );
    const def = filas[0]?.def;
    if (def) await prisma.$executeRawUnsafe(`ALTER TABLE "PerfilProfesional" DROP CONSTRAINT "${CHECK_MODALIDAD}"`);
    try {
        const p = await prisma.perfilProfesional.create({
            data: { ...datosPerfil(usuarioId, ciudadId), estado: "EN_REVISION", atiendeVirtual: false, atiendePresencial: false },
            select: { id: true },
        });
        return p.id;
    } finally {
        if (def) await prisma.$executeRawUnsafe(`ALTER TABLE "PerfilProfesional" ADD CONSTRAINT "${CHECK_MODALIDAD}" ${def}`);
    }
}

const leerEstado = (id: string) =>
    prisma.perfilProfesional.findUniqueOrThrow({ where: { id }, select: { estado: true, atiendeVirtual: true, atiendePresencial: true } });

describe("SPEC-717 (I-428) · corregirPerfilesSinModalidad", () => {
    beforeEach(async () => resetDatabase());

    it("DRY-RUN: encuentra solo la fila indultada y deja la base IDÉNTICA", async () => {
        const c = await ciudadDePrueba();
        const indultado = await crearPerfilIndultado(c, "sinmod.indultado");
        const activoOk = await crearPerfilLegal(c, "sinmod.activo", "ACTIVO", { atiendeVirtual: true });
        const borradorOk = await crearPerfilLegal(c, "sinmod.borrador", "BORRADOR", {});

        const r = await corregirPerfilesSinModalidad(prisma, { dryRun: true });
        expect(r.escrito).toBe(false);
        expect(r.encontrados, "solo la no-BORRADOR sin modalidad").toBe(1);
        expect(r.filas[0]!.perfilId).toBe(indultado);
        // Nada cambió.
        expect((await leerEstado(indultado)).estado).toBe("EN_REVISION");
        expect((await leerEstado(activoOk)).estado).toBe("ACTIVO");
        expect((await leerEstado(borradorOk)).estado).toBe("BORRADOR");
    });

    it("--confirm: devuelve la indultada a BORRADOR; el ACTIVO con modalidad y el BORRADOR legal quedan intactos", async () => {
        const c = await ciudadDePrueba();
        const indultado = await crearPerfilIndultado(c, "sinmod.indultado");
        const activoOk = await crearPerfilLegal(c, "sinmod.activo", "ACTIVO", { atiendePresencial: true });
        const borradorOk = await crearPerfilLegal(c, "sinmod.borrador", "BORRADOR", {});

        const r = await corregirPerfilesSinModalidad(prisma, { dryRun: false });
        expect(r.corregidos).toBe(1);
        expect(r.fallidas).toHaveLength(0);

        // La indultada quedó en BORRADOR (su estado verdadero); no se le inventó modalidad.
        const tras = await leerEstado(indultado);
        expect(tras.estado).toBe("BORRADOR");
        expect(tras.atiendeVirtual || tras.atiendePresencial, "no se inventa modalidad").toBe(false);
        // CONTROL POSITIVO: el ACTIVO con modalidad NO se tocó; el BORRADOR legal tampoco.
        expect((await leerEstado(activoOk)).estado).toBe("ACTIVO");
        expect((await leerEstado(borradorOk)).estado).toBe("BORRADOR");
    });

    it("idempotente: la 2ª corrida no encuentra nada", async () => {
        const c = await ciudadDePrueba();
        await crearPerfilIndultado(c, "sinmod.indultado");
        await corregirPerfilesSinModalidad(prisma, { dryRun: false });
        const segunda = await corregirPerfilesSinModalidad(prisma, { dryRun: false });
        expect(segunda.encontrados).toBe(0);
        expect(segunda.corregidos).toBe(0);
    });

    it("aborta ante un flag desconocido: usa parseArgs(process.argv, [\"confirm\"])", () => {
        const src = fs.readFileSync(path.resolve(process.cwd(), "scripts/corregir-perfiles-sin-modalidad.ts"), "utf-8");
        expect(src).toContain('parseArgs(process.argv, ["confirm"])');
    });
});
