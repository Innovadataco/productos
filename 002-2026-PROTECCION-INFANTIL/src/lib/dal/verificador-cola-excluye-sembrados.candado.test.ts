/**
 * CANDADO · I-419 · La cola del Verificador NO muestra profesionales SEMBRADOS (demo).
 *
 * Un profesional de prueba en revisión aparecía como solicitud real. Se excluye con el
 * predicado canónico de SPEC-655 (marca en `demo_marcado`, entidad "PerfilProfesional").
 *
 * CONTROL POSITIVO por remoción del discriminador ([[dev-candado-exclusion-control-positivo]]):
 * el mismo perfil, con la marca → NO está en la cola; sin la marca → SÍ está. Así el verde
 * prueba que la exclusión la causa la MARCA, no otra cosa. La cola de solicitudes es lo que
 * devuelve la API y de cuya LONGITUD sale el contador de la pestaña, así que excluir en la
 * lista excluye también en el contador (no pueden discrepar). Integración: `demo_marcado`
 * y las FKs existen tras `migrate deploy`.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { listarSolicitudesEnRevision, listarRenovaciones } from "@/lib/profesionales/verificador/service";

async function ciudad() {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    return (
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id } }))
    );
}

async function perfilEnRevision(nombre: string) {
    const c = await ciudad();
    const u = await crearUsuario("PROFESIONAL", `p.${nombre}.${Date.now()}.${Math.random()}@ejemplo.local`);
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id,
            nombreVisible: nombre,
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: c.id,
            aniosExperiencia: 3,
            presentacion: "x",
            tarifaConsultaCOP: 100000,
            duracionMinutos: 45,
            atiendeVirtual: true,
            estado: "EN_REVISION",
            autorizacionArchivoId: "/x.pdf",
            autorizacionSubidaEn: new Date(),
        },
    });
}

function marcarDemo(perfilId: string) {
    return prisma.demoMarcado.create({
        data: { entidad: "PerfilProfesional", entidadId: perfilId, metadata: { script: "test-i419" } },
    });
}

describe("I-419 · la cola de solicitudes excluye los sembrados (control positivo)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });
    afterAll(async () => prisma.$disconnect());

    it("con la marca demo NO aparece; el real SÍ; sacando la marca, el demo aparece", async () => {
        const real = await perfilEnRevision("Real");
        const demo = await perfilEnRevision("Demo");
        await marcarDemo(demo.id);

        const conMarca = await listarSolicitudesEnRevision();
        const ids = conMarca.map((f) => f.solicitudId);
        expect(ids, "el profesional real debe estar").toContain(real.id);
        expect(ids, "el sembrado NO debe estar en la cola real").not.toContain(demo.id);

        // Control positivo: sin la marca, el MISMO perfil aparece → la exclusión la causa la marca.
        await prisma.demoMarcado.deleteMany({ where: { entidad: "PerfilProfesional", entidadId: demo.id } });
        const sinMarca = await listarSolicitudesEnRevision();
        expect(sinMarca.map((f) => f.solicitudId), "sin marca, el perfil vuelve a la cola").toContain(demo.id);
    });
});

describe("I-419 · la cola «Documentos nuevos» tampoco lista sembrados", () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.parametroSistema.create({
            data: {
                clave: "verificacion.requisitos",
                valor: JSON.stringify([{ clave: "tarjeta", nombre: "Tarjeta profesional", descripcion: "" }]),
                tipo: "JSON",
                categoria: "SYSTEM",
                esPublico: false,
                descripcion: "req test",
            },
        });
    });
    afterAll(async () => prisma.$disconnect());

    it("un ACTIVO demo con documento nuevo no aparece; sin la marca, sí", async () => {
        const c = await ciudad();
        const u = await crearUsuario("PROFESIONAL", `pa.${Date.now()}.${Math.random()}@ejemplo.local`);
        const admin = await crearUsuario("ADMIN", `ad.${Date.now()}.${Math.random()}@ejemplo.local`);
        const perfil = await prisma.perfilProfesional.create({
            data: {
                usuarioId: u.id, nombreVisible: "Demo Activo", tituloProfesional: "Psicología",
                especialidades: ["infantil"], ciudadId: c.id, aniosExperiencia: 3, presentacion: "x",
                tarifaConsultaCOP: 100000, duracionMinutos: 45, atiendeVirtual: true, estado: "ACTIVO",
                autorizacionArchivoId: "/x.pdf", autorizacionSubidaEn: new Date(),
            },
        });
        await prisma.verificacionProfesional.create({
            data: {
                perfilProfesionalId: perfil.id, revisadoPorId: admin.id, revisadoEn: new Date(),
                checklist: {}, resultado: "APROBADO", autorizacionArchivoId: "/x.pdf",
                venceEn: new Date(Date.now() + 60 * 86_400_000),
            },
        });
        await prisma.documentoProfesional.create({
            data: {
                perfilProfesionalId: perfil.id, requisitoClave: "tarjeta", archivoId: "a",
                extension: "pdf", sha256: "s", estado: "VIGENTE",
            },
        });
        await prisma.documentoProfesional.create({
            data: {
                perfilProfesionalId: perfil.id, requisitoClave: "tarjeta", archivoId: "b",
                extension: "pdf", sha256: "s2", estado: "EN_REVISION",
            },
        });
        await marcarDemo(perfil.id);

        expect((await listarRenovaciones()).map((f) => f.profesionalId)).not.toContain(perfil.id);
        await prisma.demoMarcado.deleteMany({ where: { entidad: "PerfilProfesional", entidadId: perfil.id } });
        expect((await listarRenovaciones()).map((f) => f.profesionalId)).toContain(perfil.id);
    });
});
