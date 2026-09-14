/**
 * SPEC-690 · CANDADO DE INTEGRACIÓN (con base) — la siembra de profesionales por estado:
 *   (cond. 4) es idempotente y no destructiva — correrla dos veces no duplica ni re-hashea;
 *   (cond. 3) NO dispara notificaciones — el guardia transaccional deja el delta en 0;
 *   (cond. 5) la exclusión SPEC-655 del ACTIVO se cumple EN LAS DOS DIRECCIONES (un padre demo
 *             SÍ lo ve, un padre real y el anónimo NO), con CONTROL POSITIVO por remoción del
 *             discriminador: al quitar la marca de `PerfilProfesional`, el padre real SÍ lo ve
 *             → prueba que lo ocultaba la marca, no un filtro ajeno.
 *   (autoría) las verificaciones las firma un VERIFICADOR DEMO marcado — nunca un usuario real.
 *
 * Vive en `src/**` a propósito: la suite de integración (que sí levanta base) corre
 * `src/**​/*.test.ts`. El sembrado vive en `scripts/seed-e2e-profesionales-por-estado.ts`; acá se
 * EJERCITA corriéndolo contra base, no declarándolo. Usa el repositorio REAL (no una
 * reimplementación del predicado): si el WHERE del directorio cambia, este candado lo siente.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { createToken, getUserFromToken, verifyPassword } from "@/lib/auth";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import {
    sembrarProfesionalesPorEstado,
    emailPorEstado,
    emailRevisorDemo,
    CORRIDA_SPEC690,
    PLAN,
} from "../../scripts/seed-e2e-profesionales-por-estado";
import type { CredencialCuenta } from "../../scripts/lib/credenciales-e2e-calidad";

// Credencial DUMMY del entorno (el candado no lee `process.env`): el correo base del que se
// derivan los `+<etiqueta>`; la clave es de prueba, no una credencial real (SPEC-107).
const PROF: CredencialCuenta = {
    clave: "PROFESIONAL",
    rol: "PROFESIONAL",
    nombre: "Profesional Calidad (E2E)",
    esProfesional: true,
    email: "profesional.e2e.calidad@example.com",
    secreto: "DummyCalidadTres-2026",
};

const EMAILS_FIXTURE = PLAN.map((p) => emailPorEstado(PROF.email, p.estado));
const EMAIL_REVISOR = emailRevisorDemo(PROF.email);

async function ciudadDePrueba(): Promise<string> {
    // `resetDatabase` preserva los datos de referencia (Pais/Ciudad): reusar la ciudad existente,
    // no crear una — un `pais.create({codigo:"ZZ"})` choca con el UNIQUE tras el primer test.
    const existente = await prisma.ciudad.findFirst({ select: { id: true } });
    if (existente) return existente.id;
    const pais = await prisma.pais.create({ data: { codigo: "ZZ", nombre: "País E2E" } });
    const ciudad = await prisma.ciudad.create({ data: { nombre: "Ciudad E2E", paisId: pais.id } });
    return ciudad.id;
}

/** Padre de prueba. `demo=true` lo marca en `demo_marcado` (entidad "Usuario") = visor sembrado. */
async function crearPadre(demo: boolean): Promise<string> {
    const u = await prisma.usuario.create({
        data: {
            email: demo ? "padre.demo.e2e@example.com" : "padre.real.e2e@example.com",
            nombre: demo ? "Padre Demo E2E" : "Padre Real E2E",
            passwordHash: "fixture-no-login",
            rol: "PARENT",
            estado: "activo",
            estadoActivacion: "ACTIVO",
            debeCambiarPassword: false,
        },
        select: { id: true },
    });
    if (demo) {
        await prisma.demoMarcado.create({
            data: { entidad: "Usuario", entidadId: u.id, metadata: { corrida: CORRIDA_SPEC690, script: "candado" } },
        });
    }
    return u.id;
}

function sembrar(ciudadId: string, ahora?: Date) {
    return prisma.$transaction((tx) => sembrarProfesionalesPorEstado(tx, PROF, ciudadId, ahora));
}

async function contarVerificacionesFixture(): Promise<number> {
    return prisma.verificacionProfesional.count({
        where: { perfilProfesional: { usuario: { email: { in: EMAILS_FIXTURE } } } },
    });
}

/** Petición autenticada como `usuarioId` (cookie con JWT), para ejercitar `getUserFromToken`. */
async function requestComo(usuarioId: string): Promise<Request> {
    const token = await createToken({ sub: usuarioId });
    return new Request("http://localhost/api/x", { headers: { cookie: `token=${token}` } });
}

describe("SPEC-690 · siembra de un profesional por estado", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("cond.4 — idempotente y no destructiva: dos corridas no duplican ni re-hashean", async () => {
        const ciudadId = await ciudadDePrueba();

        const r1 = await sembrar(ciudadId);
        const snap1 = await prisma.usuario.findMany({
            where: { email: { in: [...EMAILS_FIXTURE, EMAIL_REVISOR] } },
            select: { email: true, passwordHash: true },
            orderBy: { email: "asc" },
        });

        const r2 = await sembrar(ciudadId);
        const snap2 = await prisma.usuario.findMany({
            where: { email: { in: [...EMAILS_FIXTURE, EMAIL_REVISOR] } },
            select: { email: true, passwordHash: true },
            orderBy: { email: "asc" },
        });

        // Cinco fixtures; la primera corrida crea, la segunda actualiza. El revisor, igual.
        expect(r1.fixtures).toHaveLength(5);
        expect(r1.fixtures.every((x) => x.creado)).toBe(true);
        expect(r2.fixtures.every((x) => !x.creado)).toBe(true);
        expect(r1.revisor.creado).toBe(true);
        expect(r2.revisor.creado).toBe(false);

        // Sin duplicados: 5 profesionales + 1 revisor = 6 usuarios, 5 perfiles, 3 verificaciones.
        expect(await prisma.usuario.count({ where: { email: { in: [...EMAILS_FIXTURE, EMAIL_REVISOR] } } })).toBe(6);
        expect(await prisma.perfilProfesional.count({ where: { usuario: { email: { in: EMAILS_FIXTURE } } } })).toBe(5);
        expect(await contarVerificacionesFixture()).toBe(3);

        // No destructiva: la clave del entorno no cambió ⇒ el hash NO se reescribe.
        expect(snap2).toEqual(snap1);

        // La base `E2E_PROFESIONAL` (sin sufijo) NUNCA se crea acá.
        expect(await prisma.usuario.findUnique({ where: { email: PROF.email } })).toBeNull();
    });

    it("autoría — las verificaciones las firma un VERIFICADOR DEMO marcado, no un usuario real", async () => {
        const ciudadId = await ciudadDePrueba();
        const r = await sembrar(ciudadId);

        // El firmante es VERIFICADOR y está marcado demo (entidad "Usuario").
        const rev = await prisma.usuario.findUnique({ where: { id: r.revisor.id }, select: { rol: true } });
        expect(rev?.rol).toBe("VERIFICADOR");
        const marca = await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: r.revisor.id } });
        expect(marca).not.toBeNull();

        // TODAS las verificaciones sembradas apuntan a ese firmante demo (nunca a un real).
        const verifs = await prisma.verificacionProfesional.findMany({
            where: { perfilProfesional: { usuario: { email: { in: EMAILS_FIXTURE } } } },
            select: { revisadoPorId: true },
        });
        expect(verifs).toHaveLength(3);
        expect(verifs.every((v) => v.revisadoPorId === r.revisor.id)).toBe(true);
    });

    it("acceso — el VERIFICADOR demo NO puede autenticarse (clave inutilizable + inactivo); el ACTIVO sí", async () => {
        const ciudadId = await ciudadDePrueba();
        const r = await sembrar(ciudadId);
        const activo = r.fixtures.find((f) => f.estado === "ACTIVO")!;

        // El firmante está inactivo y su clave NO es la del entorno (sin credencial reutilizable).
        const rev = await prisma.usuario.findUnique({ where: { id: r.revisor.id }, select: { estado: true, passwordHash: true } });
        expect(rev?.estado).toBe("inactivo");
        expect(await verifyPassword(PROF.secreto, rev!.passwordHash)).toBe(false);

        const auth = new AutenticacionService();
        // 1) el login del firmante FALLA (ni con la clave del entorno).
        expect((await auth.login(EMAIL_REVISOR, PROF.secreto)).ok).toBe(false);
        // 2) una llamada autenticada COMO el firmante se rechaza (estado inactivo → null).
        expect(await getUserFromToken(await requestComo(r.revisor.id))).toBeNull();

        // CONTROL POSITIVO: el profesional ACTIVO, con la clave del entorno, SÍ entra y SÍ resuelve
        // su sesión — así un login/authn roto por otra causa no dejaría pasar el candado en verde.
        expect((await auth.login(activo.email, PROF.secreto)).ok).toBe(true);
        expect(await getUserFromToken(await requestComo(activo.usuarioId))).not.toBeNull();
    });

    it("cond.3 — no dispara notificaciones (guardia transaccional: delta = 0)", async () => {
        const ciudadId = await ciudadDePrueba();

        const antes = await prisma.notificacion.count();
        const r = await sembrar(ciudadId); // si hubiera encolado algo, el guardia habría lanzado y deshecho la tx
        const despues = await prisma.notificacion.count();

        expect(r.notifDespues - r.notifAntes).toBe(0);
        expect(despues - antes).toBe(0);
    });

    it("cond.5 — exclusión SPEC-655 del ACTIVO en las dos direcciones + control positivo", async () => {
        const ciudadId = await ciudadDePrueba();
        const r = await sembrar(ciudadId);
        const activo = r.fixtures.find((f) => f.estado === "ACTIVO");
        expect(activo).toBeDefined();
        const activoPerfilId = activo!.perfilId;

        const repo = new PerfilProfesionalRepository();
        const realParentId = await crearPadre(false);
        const demoParentId = await crearPadre(true);
        const idsPara = async (viewer: string | null) => (await repo.listarActivos({}, viewer)).map((p) => p.id);

        // El ACTIVO es el ÚNICO fixture elegible para el directorio (los otros 4 no son ACTIVO).
        // Dirección A — un padre demo SÍ lo ve.
        expect(await idsPara(demoParentId)).toContain(activoPerfilId);
        // Dirección B — un padre real NO lo ve; el anónimo (sesión null) tampoco (falla cerrado).
        expect(await idsPara(realParentId)).not.toContain(activoPerfilId);
        expect(await idsPara(null)).not.toContain(activoPerfilId);

        // CONTROL POSITIVO: quitar el discriminador (la marca de `PerfilProfesional`) hace que el
        // padre real SÍ lo vea. Prueba que lo ocultaba la marca —no un filtro ajeno— y que el
        // ACTIVO es realmente elegible. Sin este viraje, el «no aparece» no probaría nada.
        await prisma.demoMarcado.deleteMany({ where: { entidad: "PerfilProfesional", entidadId: activoPerfilId } });
        expect(await idsPara(realParentId)).toContain(activoPerfilId);
    });
});
