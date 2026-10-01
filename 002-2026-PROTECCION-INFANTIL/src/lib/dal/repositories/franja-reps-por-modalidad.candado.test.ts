/**
 * CANDADO · SPEC-825 · el display del padre filtra la franja por REPS POR MODALIDAD, no solo por banderas.
 *
 * La costura que cerró Calibdad: la creación mira banderas, el display miraba banderas, la reserva mira REPS
 * por modalidad — más estricto. Un profesional REPS-VIGENTE SOLO para PRESENCIAL que declara
 * `atiendeVirtual=true` creaba/ofrecía franjas virtuales que la reserva rechaza. Callejón sin salida.
 *
 * La fila REAL plantada (sin ella, un candado de no-fuga pasa por vacío): REPS vigente SOLO PRESENCIAL +
 * `atiendeVirtual=true` + franja VIRTUAL libre futura. Se afirman las DOS caras del PADRE que 825 agrega:
 *   · NO aparece en el picker (`listarLibresDeProfesional`).
 *   · NO cuenta para el chip (`idsConHorariosDisponibles`).
 * La 3.ª cara —la RESERVA rechaza— es el contrato del servidor, ya cubierto por el candado de SPEC-828; NO se
 * duplica acá (orden del CEO: 825 agrega que el padre no lo ALCANCE, no que el servidor rechace).
 *
 * Control positivo por contraste (que el filtro no excluye de más): la franja PRESENCIAL del mismo profesional
 * SÍ se ofrece, y un profesional con REPS que cubre TELEMEDICINA SÍ ofrece su franja virtual. Si se quita la
 * condición REPS, la virtual del PRESENCIAL-solo aparece → ROJO.
 *
 * Integración (BD de test).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { FranjaDisponibleRepository } from "./franja-disponible";
import type { EstadoReps, ModalidadReps } from "@prisma/client";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date();
const FUT = new Date(AHORA.getTime() + 90 * DIA);

let ciudadId: string;
let n = 0;

/** ACTIVO + vigencia interna OK + ambas banderas en true → el REPS-por-modalidad queda como ÚNICO discriminador. */
async function profConBanderas(): Promise<string> {
    const u = await crearUsuario("PROFESIONAL", `pro.825.${Date.now()}.${n++}@ejemplo.local`);
    const p = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id,
            nombreVisible: "Dra. REPS",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId,
            atiendeVirtual: true,
            atiendePresencial: true,
            aniosExperiencia: 5,
            presentacion: "Perfil de prueba — REPS por modalidad.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 45,
            estado: "ACTIVO",
        },
    });
    const rev = await crearUsuario("ADMIN", `adm.825.${Date.now()}.${n++}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: p.id,
            revisadoPorId: rev.id,
            revisadoEn: new Date(AHORA.getTime() - 10 * DIA),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: `arch-${p.id}`,
            venceEn: FUT,
        },
    });
    return p.id;
}

async function reps(perfilId: string, modalidades: ModalidadReps[], resultado: EstadoReps = "VIGENTE") {
    await prisma.verificacionReps.create({
        data: {
            profesionalId: perfilId,
            verificadoEn: new Date(AHORA.getTime() - 5 * DIA),
            fuente: "MANUAL_ADMIN",
            resultado,
            vigenteHasta: resultado === "VIGENTE" ? FUT : null,
            modalidades,
        },
    });
}

async function crearFranja(perfilId: string, modalidad: "VIRTUAL" | "PRESENCIAL") {
    const inicio = new Date(AHORA.getTime() + 7 * DIA);
    return prisma.franjaDisponible.create({
        data: { profesionalId: perfilId, inicio, fin: new Date(inicio.getTime() + 45 * 60_000), modalidad, tomada: false },
    });
}

describe("SPEC-825 · la franja se ofrece solo si el REPS cubre SU modalidad", { timeout: 30_000 }, () => {
    const repo = new FranjaDisponibleRepository();
    beforeEach(async () => {
        await resetDatabase();
        const { ciudad } = await crearPaisCiudad();
        ciudadId = ciudad.id;
    });
    afterAll(async () => prisma.$disconnect());

    it("REPS solo PRESENCIAL + franja VIRTUAL: NO en el picker, NO cuenta para el chip", async () => {
        const id = await profConBanderas();
        await reps(id, ["PRESENCIAL"]); // el REPS NO cubre TELEMEDICINA (= VIRTUAL)
        await crearFranja(id, "VIRTUAL");

        const picker = await repo.listarLibresDeProfesional(id, AHORA);
        expect(picker.length, "la franja virtual no es reservable (REPS no cubre telemedicina) → no se muestra").toBe(0);

        const chip = await repo.idsConHorariosDisponibles([id], AHORA);
        expect(chip.has(id), "el chip no puede prometer una franja que la reserva rechaza").toBe(false);
    });

    it("contraste: la franja PRESENCIAL del MISMO profesional SÍ se ofrece (el filtro no excluye de más)", async () => {
        const id = await profConBanderas();
        await reps(id, ["PRESENCIAL"]);
        await crearFranja(id, "PRESENCIAL");

        const picker = await repo.listarLibresDeProfesional(id, AHORA);
        expect(picker.length, "presencial con REPS presencial vigente → se ofrece").toBe(1);
        expect((await repo.idsConHorariosDisponibles([id], AHORA)).has(id)).toBe(true);
    });

    it("contraste: REPS que cubre TELEMEDICINA → la franja VIRTUAL SÍ se ofrece", async () => {
        const id = await profConBanderas();
        await reps(id, ["PRESENCIAL", "TELEMEDICINA"]);
        await crearFranja(id, "VIRTUAL");

        const picker = await repo.listarLibresDeProfesional(id, AHORA);
        expect(picker.length, "virtual con REPS telemedicina vigente → se ofrece").toBe(1);
        expect((await repo.idsConHorariosDisponibles([id], AHORA)).has(id)).toBe(true);
    });
});
