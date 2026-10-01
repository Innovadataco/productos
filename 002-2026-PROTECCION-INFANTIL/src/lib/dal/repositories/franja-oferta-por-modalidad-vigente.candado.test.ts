/**
 * CANDADO · SPEC-818 · la CONSULTA ofrece SOLO lo ofrecible: una franja cuya modalidad el perfil VIGENTE ya
 * no atiende NO se ofrece y NO se puede reservar. Y OCULTAR es REVERSIBLE: re-encender el flag DEVUELVE la
 * franja — el flag es puerta, la franja es dato (NO se borra). El control NEGATIVO es el que importa: si solo
 * probáramos que desaparece, un BORRADO pasaría por verde.
 *
 * Se afirma sobre la franja PLANTADA, nunca sobre conteos de la lista real (79% de los perfiles ya tiene cero
 * turnos → un «la lista bajó de N a M» daría ruido con N=0). Y contra el flag VIGENTE, no el de la creación:
 * la franja se crea con el flag ENCENDIDO y recién después se apaga — que es el defecto. Integración (BD).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { crearSolicitudCita } from "@/lib/profesional/cita/cita.service";

let n = 0;
/** Profesional OFRECIBLE (ACTIVO + verificación APROBADA vigente) con AMBAS modalidades encendidas. */
async function profesionalOfrecible(ciudadId: string): Promise<string> {
    const sufijo = `${Date.now()}.${n++}`;
    const u = await crearUsuario("PROFESIONAL", `pro.818.${sufijo}@ejemplo.local`);
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id,
            nombreVisible: "Dra. Oferta",
            tituloProfesional: "Psicología",
            especialidades: ["Ansiedad"],
            ciudadId,
            atiendeVirtual: true,
            atiendePresencial: true,
            aniosExperiencia: 5,
            presentacion: "Perfil de prueba.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 45,
            estado: "ACTIVO",
        },
    });
    const revisor = await crearUsuario("ADMIN", `adm.818.${sufijo}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: "archivo-de-prueba",
            venceEn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
    });
    return perfil.id;
}

async function crearFranja(profesionalId: string, modalidad: "VIRTUAL" | "PRESENCIAL", diasAdelante = 7): Promise<string> {
    const inicio = new Date(Date.now() + diasAdelante * 24 * 60 * 60 * 1000);
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId, inicio, fin: new Date(inicio.getTime() + 45 * 60 * 1000), modalidad, tomada: false },
    });
    return franja.id;
}

const ids = (fs: Array<{ id: string }>) => fs.map((f) => f.id);

const CASOS = [
    { modalidad: "VIRTUAL" as const, off: { atiendeVirtual: false }, on: { atiendeVirtual: true } },
    { modalidad: "PRESENCIAL" as const, off: { atiendePresencial: false }, on: { atiendePresencial: true } },
];

describe("SPEC-818 · la consulta oculta (no borra) la franja cuya modalidad el perfil ya no atiende", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    for (const { modalidad, off, on } of CASOS) {
        it(`${modalidad}: apagar el flag OCULTA la franja; la fila PERSISTE; re-encender la DEVUELVE (control negativo)`, async () => {
            const { ciudad } = await crearPaisCiudad();
            const profesionalId = await profesionalOfrecible(ciudad.id);
            const franjaId = await crearFranja(profesionalId, modalidad);
            const repo = new FranjaDisponibleRepository();
            const desde = new Date();

            // Con el flag ENCENDIDO (como en la creación), la franja se ofrece.
            expect(ids(await repo.listarLibresDeProfesional(profesionalId, desde))).toContain(franjaId);

            // APAGAR la modalidad (lo que hace el PUT del perfil) — el flag VIGENTE cambia DESPUÉS de publicar.
            await prisma.perfilProfesional.update({ where: { id: profesionalId }, data: off });
            expect(ids(await repo.listarLibresDeProfesional(profesionalId, desde)), "apagado → oculta").not.toContain(franjaId);
            // La fila SIGUE existiendo: ocultar ≠ borrar.
            expect(await prisma.franjaDisponible.findUnique({ where: { id: franjaId } }), "ocultar no borra la fila").not.toBeNull();

            // CONTROL NEGATIVO: re-encender DEVUELVE la franja — prueba de que se ocultó y no se borró.
            await prisma.perfilProfesional.update({ where: { id: profesionalId }, data: on });
            expect(ids(await repo.listarLibresDeProfesional(profesionalId, desde)), "re-encendido → reaparece").toContain(franjaId);
        });
    }

    it("cinturón: reservar una franja cuya modalidad el perfil ya no atiende FALLA (carrera listar↔reservar)", async () => {
        const { ciudad } = await crearPaisCiudad();
        const profesionalId = await profesionalOfrecible(ciudad.id);
        const franjaId = await crearFranja(profesionalId, "VIRTUAL");
        await prisma.perfilProfesional.update({ where: { id: profesionalId }, data: { atiendeVirtual: false } });
        const padre = await crearUsuario("PARENT", `padre.818.${Date.now()}.${n++}@ejemplo.local`);

        await expect(
            crearSolicitudCita({
                padreUsuarioId: padre.id,
                profesionalId,
                franjaId,
                presentacion: "Hola, necesito acompañamiento para mi hijo adolescente.",
                urgencia: "SIN_APURO",
                porcentajeServicio: 20,
            }),
        ).rejects.toThrow(/ya no está disponible/i);

        // El rechazo fue ANTES de marcar la franja: queda libre (no se consumió en una reserva que falló).
        expect((await prisma.franjaDisponible.findUnique({ where: { id: franjaId } }))!.tomada).toBe(false);
    });
});
