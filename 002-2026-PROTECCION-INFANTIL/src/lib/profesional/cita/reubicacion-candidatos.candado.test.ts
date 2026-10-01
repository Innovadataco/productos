/**
 * SPEC-814 · CANDADO del matcher de reubicación — el gate que NO puede fallar abierto.
 *
 * Si este matcher dejara pasar a un profesional inhabilitado, el sistema le estaría dando la
 * cita de un menor a OTRO inactivo (lo que el art. 8.5 prohíbe). Por eso el candado es de CONTROL
 * POSITIVO: siembra profesionales que NO deben aparecer (inactivo, verificación vencida, ocupado
 * en la franja, de otra modalidad, de otra ciudad, sin área compartida, y el propio actual) y
 * exige que NINGUNO aparezca, con un caso que SÍ aparece como control de que la ausencia
 * significa algo.
 *
 * El gate es la FUENTE ÚNICA, no un `estado:ACTIVO` a mano: el matcher pasa por `obtenerPublicoPorId`
 * (el término `estaHabilitado` = ACTIVO ∧ verificación interna vigente). El caso «verificación vencida» lo
 * prueba: ese profesional ES ACTIVO y aun así queda fuera, porque el gate mira la FUENTE, no el estado.
 * (SPEC-852 eliminó REPS: la habilitación es solo la verificación interna.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { EstadoPerfilProfesional, ModalidadCita } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import {
    candidatosDeReubicacion,
    candidatosParaCita,
    type RequisitosReubicacion,
} from "./reubicacion-candidatos";

// Ventana de la cita que se reubica (W). Las franjas candidatas se miden contra ella.
const W_INICIO = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const W_FIN = new Date(W_INICIO.getTime() + 50 * 60 * 1000);

let bogotaId: string;
let medellinId: string;

async function seedPro(opts: {
    especialidades: string[];
    ciudadId?: string;
    estado?: EstadoPerfilProfesional;
    vigente?: boolean; // false = verificación interna vencida (ayer)
    nombre?: string;
}) {
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: opts.nombre ?? "Prof. Candidato",
            tituloProfesional: "Psicólogo clínico",
            especialidades: opts.especialidades,
            ciudadId: opts.ciudadId ?? bogotaId,
            atiendeVirtual: true,
            atiendePresencial: true,
            aniosExperiencia: 5,
            presentacion: "Acompaña procesos con niñas, niños y adolescentes.",
            tarifaConsultaCOP: 100_000,
            duracionMinutos: 50,
            estado: opts.estado ?? "ACTIVO",
        },
    });
    // Vigencia: estado ACTIVO sin verificación aprobada vigente NO existe en prod — la fuente
    // única lo exige. `vigente:false` siembra una APROBADA pero VENCIDA (el caso que prueba que
    // el gate mira la fuente, no el estado).
    const revisor = await crearUsuario("ADMIN");
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: "archivo-de-prueba", // XOR con aceptacion: exactamente una
            venceEn:
                opts.vigente === false
                    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
                    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
    });
    return perfil;
}

async function seedFranja(
    profesionalId: string,
    opts: { inicio?: Date; fin?: Date; modalidad?: ModalidadCita; tomada?: boolean } = {},
) {
    return prisma.franjaDisponible.create({
        data: {
            profesionalId,
            inicio: opts.inicio ?? W_INICIO,
            fin: opts.fin ?? W_FIN,
            modalidad: opts.modalidad ?? "VIRTUAL",
            tomada: opts.tomada ?? false,
        },
    });
}

function reqBase(overrides: Partial<RequisitosReubicacion> = {}): RequisitosReubicacion {
    return {
        inicio: W_INICIO,
        fin: W_FIN,
        modalidad: "VIRTUAL",
        areasDelProfesionalActual: ["TRAUMA"],
        ciudadIdDelProfesionalActual: bogotaId,
        excluirProfesionalId: "profesional-A-inexistente",
        ...overrides,
    };
}

const ids = (c: { profesionalId: string }[]) => c.map((x) => x.profesionalId);

describe("SPEC-814 · matcher de reubicación · el gate no falla abierto", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        const { pais, ciudad } = await crearPaisCiudad();
        bogotaId = ciudad.id;
        // Ciudad es catálogo PRESERVADO (resetDatabase no la trunca): upsert, no create, o la 2ª
        // corrida del beforeEach choca con la única (nombre, paisId).
        medellinId = (
            await prisma.ciudad.upsert({
                where: { nombre_paisId: { nombre: "Medellín", paisId: pais.id } },
                update: {},
                create: { nombre: "Medellín", paisId: pais.id },
            })
        ).id;
    });

    it("CONTROL POSITIVO: habilitado que calza y tiene franja libre que solapa → APARECE", async () => {
        const b = await seedPro({ especialidades: ["TRAUMA"] });
        await seedFranja(b.id);
        const c = await candidatosDeReubicacion(reqBase());
        expect(ids(c)).toContain(b.id);
    });

    it("INACTIVO (SUSPENDIDO) con franja libre que solapa → NO aparece", async () => {
        const b = await seedPro({ especialidades: ["TRAUMA"], estado: "SUSPENDIDO" });
        await seedFranja(b.id);
        const c = await candidatosDeReubicacion(reqBase());
        expect(ids(c)).not.toContain(b.id);
    });

    it("COTA DE FUTURO (SPEC-832): cita en el PASADO con franja que solapa en el pasado → SIN candidatos", async () => {
        // El hallazgo de Datos: el `where` propio omitía `inicio >= ahora`. Ahora pasa por
        // `whereFranjaOfrecible`, que la incluye → una franja pasada no se ofrece como destino.
        const b = await seedPro({ especialidades: ["TRAUMA"] });
        const pasadoInicio = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const pasadoFin = new Date(pasadoInicio.getTime() + 50 * 60 * 1000);
        await seedFranja(b.id, { inicio: pasadoInicio, fin: pasadoFin });
        const c = await candidatosDeReubicacion(reqBase({ inicio: pasadoInicio, fin: pasadoFin }));
        expect(ids(c)).not.toContain(b.id);
    });

    it("VERIFICACIÓN VENCIDA (ACTIVO, pero sin vigencia) → NO aparece — el gate es la FUENTE, no el estado", async () => {
        const b = await seedPro({ especialidades: ["TRAUMA"], estado: "ACTIVO", vigente: false });
        await seedFranja(b.id);
        const c = await candidatosDeReubicacion(reqBase());
        expect(ids(c)).not.toContain(b.id);
    });

    it("OCUPADO en la franja (tomada=true) → NO aparece", async () => {
        const b = await seedPro({ especialidades: ["TRAUMA"] });
        await seedFranja(b.id, { tomada: true });
        const c = await candidatosDeReubicacion(reqBase());
        expect(ids(c)).not.toContain(b.id);
    });

    it("MODALIDAD distinta de la cita → NO aparece", async () => {
        const b = await seedPro({ especialidades: ["TRAUMA"] });
        await seedFranja(b.id, { modalidad: "PRESENCIAL" }); // la cita es VIRTUAL
        const c = await candidatosDeReubicacion(reqBase({ modalidad: "VIRTUAL" }));
        expect(ids(c)).not.toContain(b.id);
    });

    it("SIN franja que SOLAPE → ausente; publicar un turno libre que solapa → re-calza (APARECE)", async () => {
        const b = await seedPro({ especialidades: ["TRAUMA"] });
        // Turno libre pero FUERA de la ventana.
        await seedFranja(b.id, {
            inicio: new Date(W_FIN.getTime() + 60 * 60 * 1000),
            fin: new Date(W_FIN.getTime() + 2 * 60 * 60 * 1000),
        });
        expect(ids(await candidatosDeReubicacion(reqBase()))).not.toContain(b.id);

        // Se publica DESPUÉS un turno que sí solapa: la cola no queda congelada.
        await seedFranja(b.id);
        expect(ids(await candidatosDeReubicacion(reqBase()))).toContain(b.id);
    });

    it("ÁREA: sin especialidad compartida → NO aparece; parcial → APARECE con el hueco A LA VISTA", async () => {
        const sinArea = await seedPro({ especialidades: ["OTRA"], nombre: "Sin área" });
        await seedFranja(sinArea.id);
        const parcial = await seedPro({ especialidades: ["COMPARTIDA", "PROPIA_B"], nombre: "Parcial" });
        await seedFranja(parcial.id);

        // A cubría {COMPARTIDA, SOLO_A}; parcial comparte COMPARTIDA y NO cubre SOLO_A.
        const c = await candidatosDeReubicacion(
            reqBase({ areasDelProfesionalActual: ["COMPARTIDA", "SOLO_A"] }),
        );
        expect(ids(c)).not.toContain(sinArea.id);

        const p = c.find((x) => x.profesionalId === parcial.id);
        expect(p).toBeDefined();
        expect(p!.especialidadesCompartidas).toEqual(["COMPARTIDA"]);
        expect(p!.especialidadesNoCubiertas).toEqual(["SOLO_A"]); // el calce parcial NO se esconde
    });

    it("A sin especialidades → no se exige área (todos los demás filtros siguen)", async () => {
        const b = await seedPro({ especialidades: ["LO_QUE_SEA"] });
        await seedFranja(b.id);
        const c = await candidatosDeReubicacion(reqBase({ areasDelProfesionalActual: [] }));
        const encontrado = c.find((x) => x.profesionalId === b.id);
        expect(encontrado).toBeDefined();
        expect(encontrado!.especialidadesNoCubiertas).toEqual([]);
    });

    it("PRESENCIAL: ciudad distinta → NO aparece; misma ciudad → APARECE", async () => {
        const otraCiudad = await seedPro({ especialidades: ["TRAUMA"], ciudadId: medellinId, nombre: "Medellín" });
        await seedFranja(otraCiudad.id, { modalidad: "PRESENCIAL" });
        const mismaCiudad = await seedPro({ especialidades: ["TRAUMA"], ciudadId: bogotaId, nombre: "Bogotá" });
        await seedFranja(mismaCiudad.id, { modalidad: "PRESENCIAL" });

        const c = await candidatosDeReubicacion(
            reqBase({ modalidad: "PRESENCIAL", ciudadIdDelProfesionalActual: bogotaId }),
        );
        expect(ids(c)).not.toContain(otraCiudad.id);
        expect(ids(c)).toContain(mismaCiudad.id);
    });

    it("EXCLUYE al profesional actual (A) aunque tenga una franja libre que solapa", async () => {
        const a = await seedPro({ especialidades: ["TRAUMA"], nombre: "Actual" });
        await seedFranja(a.id);
        const c = await candidatosDeReubicacion(reqBase({ excluirProfesionalId: a.id }));
        expect(ids(c)).not.toContain(a.id);
    });

    it("loader candidatosParaCita: deriva la ventana y el área de la CITA (franja + especialidades de A)", async () => {
        const padre = await crearUsuario("PARENT");
        const a = await seedPro({ especialidades: ["TRAUMA", "DUELO"], nombre: "Actual" });
        const franjaA = await seedFranja(a.id, { tomada: true });
        const cita = await prisma.solicitudCita.create({
            data: {
                padreUsuarioId: padre.id,
                profesionalId: a.id,
                franjaId: franjaA.id,
                presentacion: "Relato de la familia que NO debe salir del matcher.",
                urgencia: "SIN_APURO",
                estado: "CONFIRMADA",
                venceEn: new Date(Date.now() + 72 * 60 * 60 * 1000),
                montoConsulta: 100_000,
                montoServicio: 15_000,
                montoTotal: 115_000,
                porcentajeServicio: 15,
            },
        });
        // Un B que comparte un área con A y tiene turno libre que solapa la franja de A.
        const b = await seedPro({ especialidades: ["DUELO"], nombre: "Candidato" });
        await seedFranja(b.id, { inicio: franjaA.inicio, fin: franjaA.fin });

        const c = await candidatosParaCita(cita.id);
        const encontrado = c.find((x) => x.profesionalId === b.id);
        expect(encontrado).toBeDefined();
        expect(encontrado!.especialidadesCompartidas).toEqual(["DUELO"]);
        expect(encontrado!.especialidadesNoCubiertas).toEqual(["TRAUMA"]); // A cubría TRAUMA, B no
        // El matcher nunca devuelve el relato de la familia (minimización).
        expect(JSON.stringify(c)).not.toContain("Relato de la familia");
    });
});
