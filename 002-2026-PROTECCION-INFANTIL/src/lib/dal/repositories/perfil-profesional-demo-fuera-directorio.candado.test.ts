/**
 * CANDADO · SPEC-655 (I-387, corregido) · un profesional SEMBRADO (demo) es visible
 * SOLO para un usuario SEMBRADO. La invariante NO es «un sembrado no es alcanzable por
 * un padre» —eso vaciaba el directorio del demo (contarActivos=0)— sino:
 *   · padre REAL (o sin sesión) → NO ve al demo (un padre real no le paga a un fantasma);
 *   · padre SEMBRADO            → SÍ lo ve (un padre demo viendo profesionales demo ES el demo).
 *
 * El visor SIEMPRE viene de la sesión del servidor, nunca de un parámetro del cliente
 * (un muro cuya condición pone el cliente falla ABIERTO). Se pasa como `viewerUsuarioId`.
 *
 * Conducta, no palabras: demo y real IDÉNTICOS salvo la marca (ambos ACTIVO + APROBADO
 * vigente). El candado se DUPLICA a propósito — si solo custodiara el caso «padre real»,
 * mañana alguien vuelve a excluir para TODOS (y rompe el demo) con el candado en verde.
 * El control positivo prueba que excluye POR la marca, no de rebote por el filtro legal.
 *
 * Cubre los cuatro caminos (lista, conteo, detalle/agendar, facetas): el daño «agendar»
 * entra por `obtenerPublicoPorId` (lo usa cita.service), no solo por la lista.
 * Integración (BD de test, truncada).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";

async function ciudad(nombre: string, paisId: string) {
    return prisma.ciudad.create({
        data: { nombre, nombreNormalizado: nombre.toLowerCase(), paisId },
    });
}

/** Profesional que PASA el filtro legal: ACTIVO + verificación APROBADO vigente.
 *  `demo=true` le agrega la marca en `demo_marcado` (única diferencia con el real). */
async function sembrarProfesionalVigente(
    ciudadId: string,
    opts: { especialidad: string; demo: boolean; nombreVisible: string },
) {
    const rnd = `${Date.now()}.${Math.random()}`;
    const usuario = await crearUsuario("PROFESIONAL", `psi.655.${rnd}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: opts.nombreVisible,
            tituloProfesional: "Psicóloga clínica",
            especialidades: [opts.especialidad],
            ciudadId,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 8,
            presentacion: "Perfil de prueba SPEC-655.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    const revisor = await crearUsuario("ADMIN", `admin.655.${rnd}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: "archivo-de-prueba",
            venceEn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // vigente
        },
    });
    if (opts.demo) {
        await prisma.demoMarcado.create({
            data: {
                entidad: "PerfilProfesional",
                entidadId: perfil.id,
                metadata: { corrida: "candado-655", script: "test" },
            },
        });
    }
    return perfil;
}

/** Un padre. `demo=true` lo marca en `demo_marcado` (entidad "Usuario"), como el poblador. */
async function sembrarPadre(demo: boolean): Promise<string> {
    const usuario = await crearUsuario("PARENT", `padre.655.${Date.now()}.${Math.random()}@ejemplo.local`);
    if (demo) {
        await prisma.demoMarcado.create({
            data: { entidad: "Usuario", entidadId: usuario.id, metadata: { corrida: "candado-655", script: "test" } },
        });
    }
    return usuario.id;
}

describe("SPEC-655 (I-387) · un profesional sembrado es visible solo para un usuario sembrado", () => {
    const repo = new PerfilProfesionalRepository();
    let ciudadRealId: string;
    let ciudadDemoId: string;
    let realId: string;
    let demoId: string;
    let viewerReal: string;
    let viewerDemo: string;

    beforeEach(async () => {
        await resetDatabase();
        const pais = await prisma.pais.upsert({
            where: { codigo: "CO" },
            update: {},
            create: { codigo: "CO", nombre: "Colombia" },
        });
        const suf = Math.random().toString(36).slice(2, 9);
        ciudadRealId = (await ciudad(`CiudadReal655-${suf}`, pais.id)).id;
        ciudadDemoId = (await ciudad(`CiudadDemo655-${suf}`, pais.id)).id;
        realId = (await sembrarProfesionalVigente(ciudadRealId, { especialidad: "ESPECIAL_REAL", demo: false, nombreVisible: "Dra. Real" })).id;
        demoId = (await sembrarProfesionalVigente(ciudadDemoId, { especialidad: "ESPECIAL_DEMO", demo: true, nombreVisible: "Dra. Demo" })).id;
        viewerReal = await sembrarPadre(false);
        viewerDemo = await sembrarPadre(true);
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe("visor REAL (padre no sembrado) → NO ve al demo", () => {
        it("listarActivos: trae al real, NO al demo", async () => {
            const ids = (await repo.listarActivos({}, viewerReal)).map((p) => p.id);
            expect(ids).toContain(realId);
            expect(ids, "el demo NO aparece para un padre real").not.toContain(demoId);
        });
        it("contarActivos = 1 (solo el real; conteo y lista no discrepan — SPEC-656)", async () => {
            expect(await repo.contarActivos(viewerReal)).toBe(1);
        });
        it("obtenerPublicoPorId: real ok, demo null → un padre real no lo puede AGENDAR", async () => {
            expect(await repo.obtenerPublicoPorId(realId, viewerReal)).not.toBeNull();
            expect(await repo.obtenerPublicoPorId(demoId, viewerReal), "demo no resoluble por id directo").toBeNull();
        });
        it("facetas: la ciudad/especialidad del demo no pueblan los filtros", async () => {
            const f = await repo.facetas(viewerReal);
            expect(f.especialidades).toContain("ESPECIAL_REAL");
            expect(f.especialidades).not.toContain("ESPECIAL_DEMO");
            expect(f.ciudades.map((c) => c.id)).not.toContain(ciudadDemoId);
        });
    });

    describe("visor SEMBRADO (padre demo) → SÍ ve al demo (eso es el demo)", () => {
        it("listarActivos: trae AMBOS (real y demo)", async () => {
            const ids = (await repo.listarActivos({}, viewerDemo)).map((p) => p.id);
            expect(ids).toContain(realId);
            expect(ids, "el demo SÍ aparece para un padre sembrado").toContain(demoId);
        });
        it("contarActivos = 2 (el padre demo cuenta al demo)", async () => {
            expect(await repo.contarActivos(viewerDemo)).toBe(2);
        });
        it("obtenerPublicoPorId(demo, viewerDemo) ≠ null → el padre demo SÍ puede agendar con el demo", async () => {
            expect(await repo.obtenerPublicoPorId(demoId, viewerDemo)).not.toBeNull();
        });
        it("facetas: aparecen las dos especialidades", async () => {
            const f = await repo.facetas(viewerDemo);
            expect(f.especialidades).toContain("ESPECIAL_REAL");
            expect(f.especialidades).toContain("ESPECIAL_DEMO");
        });
    });

    it("visor null (público sin sesión) → excluye al demo (visitante real no ve fantasmas)", async () => {
        const ids = (await repo.listarActivos({}, null)).map((p) => p.id);
        expect(ids).toContain(realId);
        expect(ids).not.toContain(demoId);
    });

    it("control positivo: con visor real, al quitar SOLO la marca del pro, el ex-demo REAPARECE", async () => {
        await prisma.demoMarcado.deleteMany({ where: { entidad: "PerfilProfesional", entidadId: demoId } });
        const ids = (await repo.listarActivos({}, viewerReal)).map((p) => p.id);
        expect(ids, "sin la marca aparece hasta para el padre real → lo excluía la marca, no el filtro legal").toContain(demoId);
    });
});
