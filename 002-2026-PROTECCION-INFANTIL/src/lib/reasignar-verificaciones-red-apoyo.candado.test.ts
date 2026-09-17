/**
 * I-418 · CANDADO DE INTEGRACIÓN — reasignar el firmante de las verificaciones sembradas por la
 * Red de Apoyo del admin real al VERIFICADOR demo sin acceso:
 *   - Solo toca las MARCADAS (`red-apoyo-676`); una verificación REAL (sin marca) queda INTACTA
 *     (control positivo: sin esto, «no toqué las reales» no probaría nada).
 *   - El firmante demo es SIN ACCESO: rol VERIFICADOR, `estado=inactivo`, clave no usable, marcado.
 *   - Idempotente: la segunda corrida reasigna 0.
 *
 * Vive en `src/**` a propósito (suite de integración con base). Ejercita el script corriéndolo.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { verifyPassword } from "@/lib/auth";
import { reasignarVerificacionesRedApoyo } from "../../scripts/demo-prod/reasignar-verificaciones-red-apoyo";
import { CORRIDA_RED } from "../../scripts/demo-prod/lib/red-apoyo-plan";

async function ciudadDePrueba(): Promise<string> {
    const existente = await prisma.ciudad.findFirst({ select: { id: true } });
    if (existente) return existente.id;
    const pais = await prisma.pais.create({ data: { codigo: "ZZ", nombre: "País E2E" } });
    const ciudad = await prisma.ciudad.create({ data: { nombre: "Ciudad E2E", paisId: pais.id } });
    return ciudad.id;
}

async function crearAdminReal(): Promise<string> {
    const u = await prisma.usuario.create({
        data: {
            email: "admin.real.i418@example.com",
            nombre: "Admin Real",
            passwordHash: "fixture-no-login",
            rol: "ADMIN",
            estado: "activo",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
        },
        select: { id: true },
    });
    return u.id;
}

async function crearPerfil(ciudadId: string): Promise<string> {
    const prof = await prisma.usuario.create({
        data: {
            email: `prof.i418.${Date.now()}@example.com`,
            nombre: "Prof I418",
            passwordHash: "fixture-no-login",
            rol: "PROFESIONAL",
            estado: "activo",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
        },
        select: { id: true },
    });
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: prof.id,
            nombreVisible: "Prof I418",
            tituloProfesional: "Psicólogo",
            ciudadId,
            aniosExperiencia: 5,
            presentacion: "x",
            tarifaConsultaCOP: 100000,
            duracionMinutos: 50,
        },
        select: { id: true },
    });
    return perfil.id;
}

async function crearVerif(perfilId: string, revisadoPorId: string, sha: string): Promise<string> {
    const v = await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfilId,
            revisadoPorId,
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: `auth-${sha}`,
            venceEn: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        },
        select: { id: true },
    });
    return v.id;
}

function reasignar(dryRun: boolean) {
    return prisma.$transaction((tx) => reasignarVerificacionesRedApoyo(tx, { dryRun }));
}

describe("I-418 · reasignar firmante de verificaciones de la Red de Apoyo", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("reasigna la MARCADA al verificador demo; la verificación REAL (sin marca) queda intacta", async () => {
        const ciudadId = await ciudadDePrueba();
        const adminId = await crearAdminReal();
        const perfilId = await crearPerfil(ciudadId);
        const marcada = await crearVerif(perfilId, adminId, "marcada");
        const real = await crearVerif(perfilId, adminId, "real");
        // Solo la primera lleva la marca de la corrida.
        await prisma.demoMarcado.create({
            data: { entidad: "VerificacionProfesional", entidadId: marcada, metadata: { corrida: CORRIDA_RED, script: "candado" } },
        });

        const r = await reasignar(false);

        expect(r.marcadas).toBe(1);
        expect(r.porReasignar).toBe(1);
        expect(r.despuesAlDemo).toBe(1);
        // La marcada ahora la firma el verificador demo.
        expect((await prisma.verificacionProfesional.findUniqueOrThrow({ where: { id: marcada } })).revisadoPorId).toBe(r.verificadorDemoId);
        // CONTROL POSITIVO: la REAL (sin marca) sigue firmada por el admin real — no se tocó.
        expect((await prisma.verificacionProfesional.findUniqueOrThrow({ where: { id: real } })).revisadoPorId).toBe(adminId);
    });

    it("el firmante demo es SIN ACCESO: VERIFICADOR, inactivo, clave no usable, marcado", async () => {
        const ciudadId = await ciudadDePrueba();
        const adminId = await crearAdminReal();
        const perfilId = await crearPerfil(ciudadId);
        const marcada = await crearVerif(perfilId, adminId, "m");
        await prisma.demoMarcado.create({
            data: { entidad: "VerificacionProfesional", entidadId: marcada, metadata: { corrida: CORRIDA_RED, script: "candado" } },
        });

        const r = await reasignar(false);

        const v = await prisma.usuario.findUniqueOrThrow({ where: { id: r.verificadorDemoId }, select: { rol: true, estado: true, passwordHash: true } });
        expect(v.rol).toBe("VERIFICADOR");
        expect(v.estado).toBe("inactivo");
        // Clave no usable: ninguna contraseña conocida valida contra su hash.
        expect(await verifyPassword("cualquier-clave-de-prueba", v.passwordHash)).toBe(false);
        // Marcado en demo_marcado (se purga con la corrida).
        expect(await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: r.verificadorDemoId } })).not.toBeNull();
    });

    it("idempotente: la segunda corrida reasigna 0", async () => {
        const ciudadId = await ciudadDePrueba();
        const adminId = await crearAdminReal();
        const perfilId = await crearPerfil(ciudadId);
        const marcada = await crearVerif(perfilId, adminId, "m");
        await prisma.demoMarcado.create({
            data: { entidad: "VerificacionProfesional", entidadId: marcada, metadata: { corrida: CORRIDA_RED, script: "candado" } },
        });

        const r1 = await reasignar(false);
        expect(r1.porReasignar).toBe(1);
        const r2 = await reasignar(false);
        expect(r2.porReasignar).toBe(0);
        expect(r2.yaAlDemo).toBe(1);
        expect(r2.despuesAlDemo).toBe(1);
    });

    it("dry-run no escribe: la marcada sigue con el admin real", async () => {
        const ciudadId = await ciudadDePrueba();
        const adminId = await crearAdminReal();
        const perfilId = await crearPerfil(ciudadId);
        const marcada = await crearVerif(perfilId, adminId, "m");
        await prisma.demoMarcado.create({
            data: { entidad: "VerificacionProfesional", entidadId: marcada, metadata: { corrida: CORRIDA_RED, script: "candado" } },
        });

        const r = await reasignar(true);
        expect(r.escrito).toBe(false);
        expect(r.porReasignar).toBe(1); // lo que se reasignaría
        expect((await prisma.verificacionProfesional.findUniqueOrThrow({ where: { id: marcada } })).revisadoPorId).toBe(adminId);
    });
});
