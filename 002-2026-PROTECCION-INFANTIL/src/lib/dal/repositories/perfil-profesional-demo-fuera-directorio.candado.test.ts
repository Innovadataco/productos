/**
 * CANDADO · SPEC-655 (I-387) · un profesional SEMBRADO (demo) NUNCA le aparece a un
 * padre real — ni en el directorio ni para AGENDAR.
 *
 * El hallazgo: `demo_marcado` (SPEC-160) es un marcador de PURGA, no oculta nada, y
 * el directorio del padre no lo consulta. Un demo APROBADO y VIGENTE pasa el filtro
 * legal (estado ACTIVO + verificación APROBADO no vencida, SPEC-449) y queda visible
 * y AGENDABLE. Un padre real podría pagar una primera cita a alguien que no existe —
 * irreversible, y el costo cae sobre el padre.
 *
 * Conducta, no palabras (radicado): se siembran DOS profesionales que pasan el filtro
 * legal IDÉNTICO (ACTIVO + APROBADO vigente); la ÚNICA diferencia es la marca en
 * `demo_marcado`. Si el candado ve al real y no al demo, es por la EXCLUSIÓN, no por
 * el filtro legal — si el demo no pasara la vigencia, el candado pasaría por la razón
 * equivocada. El «control positivo» de abajo lo prueba: al quitarle SOLO la marca, el
 * mismo perfil reaparece.
 *
 * El daño «agendar» se cubre en `obtenerPublicoPorId` (lo usa `cita.service` al crear
 * la cita), no solo en el listado: esconder del listado pero dejar agendable por id
 * directo sería un candado que pasa y un daño que queda.
 *
 * Muere con el defecto: quitar la exclusión de `idsSembrados` → el demo reaparece en
 * lista, conteo, detalle y facetas → rojo. Integración (BD de test, truncada).
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

describe("SPEC-655 (I-387) · un profesional demo nunca le aparece a un padre real", () => {
    const repo = new PerfilProfesionalRepository();
    let ciudadRealId: string;
    let ciudadDemoId: string;
    let realId: string;
    let demoId: string;

    beforeEach(async () => {
        await resetDatabase();
        const pais = await prisma.pais.upsert({
            where: { codigo: "CO" },
            update: {},
            create: { codigo: "CO", nombre: "Colombia" },
        });
        // Nombres únicos por corrida: resetDatabase preserva Ciudad (dato de referencia).
        const suf = Math.random().toString(36).slice(2, 9);
        ciudadRealId = (await ciudad(`CiudadReal655-${suf}`, pais.id)).id;
        ciudadDemoId = (await ciudad(`CiudadDemo655-${suf}`, pais.id)).id;
        // Ambos pasan el filtro legal; la ÚNICA diferencia es la marca demo.
        realId = (await sembrarProfesionalVigente(ciudadRealId, { especialidad: "ESPECIAL_REAL", demo: false, nombreVisible: "Dra. Real" })).id;
        demoId = (await sembrarProfesionalVigente(ciudadDemoId, { especialidad: "ESPECIAL_DEMO", demo: true, nombreVisible: "Dra. Demo" })).id;
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("listarActivos trae al REAL y NO al demo", async () => {
        const ids = (await repo.listarActivos({})).map((p) => p.id);
        expect(ids, "el real aparece").toContain(realId);
        expect(ids, "el demo NO aparece").not.toContain(demoId);
    });

    it("contarActivos cuenta solo al real (el conteo de SPEC-656 no puede discrepar de la lista)", async () => {
        expect(await repo.contarActivos()).toBe(1);
    });

    it("obtenerPublicoPorId: el real se obtiene; el demo devuelve null → no se puede AGENDAR", async () => {
        expect(await repo.obtenerPublicoPorId(realId)).not.toBeNull();
        expect(
            await repo.obtenerPublicoPorId(demoId),
            "cita.service usa obtenerPublicoPorId: el demo no puede resolverse por id directo",
        ).toBeNull();
    });

    it("facetas no derivan del demo (su ciudad/especialidad no pueblan los filtros)", async () => {
        const f = await repo.facetas();
        expect(f.especialidades).toContain("ESPECIAL_REAL");
        expect(f.especialidades, "la especialidad del demo no aparece").not.toContain("ESPECIAL_DEMO");
        const ciudadIds = f.ciudades.map((c) => c.id);
        expect(ciudadIds).toContain(ciudadRealId);
        expect(ciudadIds, "la ciudad del demo no aparece").not.toContain(ciudadDemoId);
    });

    it("control positivo: al quitarle SOLO la marca, el mismo perfil REAPARECE (excluía la marca, no el filtro legal)", async () => {
        await prisma.demoMarcado.deleteMany({ where: { entidad: "PerfilProfesional", entidadId: demoId } });
        const ids = (await repo.listarActivos({})).map((p) => p.id);
        expect(ids, "sin la marca, el ex-demo aparece → pasaba el filtro legal; lo excluía la marca").toContain(demoId);
    });
});
