/**
 * CANDADO · SPEC-872 (I-444) · «Nuevo en la red» por RECENCY, derivado en el repo.
 *
 * El badge era INCONDICIONAL (mentía: un profesional viejo seguía diciendo «Nuevo»). Ahora el DTO expone
 * `esNuevo`, DERIVADO de `creadoEn` (proxy del alta en el directorio — el perfil no tiene fecha de
 * aprobación) vs un umbral PARAMETRIZABLE (`directorio.profesional.dias_nuevo`, default 30).
 *
 * Conductas contra la BD (listarActivos + obtenerPublicoPorId, misma derivación):
 *  (1) alta hace MÁS de N días → esNuevo=false (control positivo); alta reciente → true.
 *  (2) el umbral es PARAMETRIZABLE: subir `dias_nuevo` vuelve «nuevo» a un perfil que no lo era.
 *  (3) sin el parámetro, el default 30 aplica (no rompe).
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { TipoParametro, CategoriaParametro } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";

const CLAVE = "directorio.profesional.dias_nuevo";
const DIA = 86_400_000;
let n = 0;

async function seedDiasNuevo(dias: string): Promise<void> {
    await prisma.parametroSistema.upsert({
        where: { clave: CLAVE },
        update: { valor: dias },
        create: { clave: CLAVE, valor: dias, tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "test SPEC-872" },
    });
}

/** Un profesional OFRECIBLE (ACTIVO + verificación aprobada vigente) con un `creadoEn` controlado. */
async function ofrecibleConCreadoEn(ciudadId: string, creadoEn: Date): Promise<string> {
    const sufijo = `${Date.now()}.${n++}`;
    const u = await crearUsuario("PROFESIONAL", `pro.872nuevo.${sufijo}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id, nombreVisible: "Dra. Nueva", tituloProfesional: "Psicología", especialidades: ["Ansiedad"],
            ciudadId, atiendeVirtual: true, atiendePresencial: false, aniosExperiencia: 5, presentacion: "x",
            tarifaConsultaCOP: 120000, duracionMinutos: 45, estado: "ACTIVO",
            creadoEn, // override del @default(now()) — el ancla de recency
        },
    });
    const revisor = await crearUsuario("ADMIN", `adm.872nuevo.${sufijo}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id, revisadoPorId: revisor.id, revisadoEn: new Date(Date.now() - DIA),
            checklist: {}, resultado: "APROBADO", autorizacionArchivoId: "x", venceEn: new Date(Date.now() + 90 * DIA),
        },
    });
    return perfil.id;
}

describe("SPEC-872 · «Nuevo en la red» por recency (creadoEn vs ParametroSistema)", { timeout: 30_000 }, () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("(1) alta > N días → esNuevo=false (control positivo); alta reciente → true (lista y detalle)", async () => {
        const { ciudad } = await crearPaisCiudad();
        await seedDiasNuevo("30");
        const viejo = await ofrecibleConCreadoEn(ciudad.id, new Date(Date.now() - 60 * DIA));
        const nuevo = await ofrecibleConCreadoEn(ciudad.id, new Date(Date.now() - 5 * DIA));
        const repo = new PerfilProfesionalRepository();

        expect((await repo.obtenerPublicoPorId(viejo, null))!.esNuevo, "60 días > 30 → NO nuevo").toBe(false);
        expect((await repo.obtenerPublicoPorId(nuevo, null))!.esNuevo, "5 días < 30 → nuevo").toBe(true);

        // La lista deriva igual (misma definición, no dos criterios).
        const porId = new Map((await repo.listarActivos({}, null)).map((p) => [p.id, p]));
        expect(porId.get(viejo)!.esNuevo, "lista: viejo NO nuevo").toBe(false);
        expect(porId.get(nuevo)!.esNuevo, "lista: reciente nuevo").toBe(true);
    });

    it("(2) el umbral es PARAMETRIZABLE: subir dias_nuevo vuelve «nuevo» a un perfil que no lo era", async () => {
        const { ciudad } = await crearPaisCiudad();
        await seedDiasNuevo("30");
        const perfil = await ofrecibleConCreadoEn(ciudad.id, new Date(Date.now() - 45 * DIA));
        const repo = new PerfilProfesionalRepository();
        expect((await repo.obtenerPublicoPorId(perfil, null))!.esNuevo, "45 > 30 → NO nuevo").toBe(false);
        await seedDiasNuevo("90"); // el admin amplía la ventana, sin desplegar
        expect((await repo.obtenerPublicoPorId(perfil, null))!.esNuevo, "45 < 90 → nuevo").toBe(true);
    });

    it("(3) sin el parámetro, el default 30 aplica (no rompe)", async () => {
        const { ciudad } = await crearPaisCiudad();
        // sin seedDiasNuevo: el repo cae al default 30.
        const nuevo = await ofrecibleConCreadoEn(ciudad.id, new Date(Date.now() - 5 * DIA));
        const viejo = await ofrecibleConCreadoEn(ciudad.id, new Date(Date.now() - 40 * DIA));
        const repo = new PerfilProfesionalRepository();
        expect((await repo.obtenerPublicoPorId(nuevo, null))!.esNuevo, "5 < 30 (default) → nuevo").toBe(true);
        expect((await repo.obtenerPublicoPorId(viejo, null))!.esNuevo, "40 > 30 (default) → NO nuevo").toBe(false);
    });
});
