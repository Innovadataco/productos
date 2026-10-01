/**
 * CANDADO · SPEC-825 pieza 2 (cinturón de creación) · `materializarFranjas` NO publica una franja en una
 * modalidad que el REPS del profesional no cubre. Imposibilidad estructural: el estado malo NO nace.
 *
 * Complementa la pieza 1 (filtro de lectura), no la reemplaza: la validez REPS caduca por tiempo, así que la
 * lectura también filtra. Pero prevenir el nacimiento achica el problema en origen.
 *
 * El profesional se siembra con la vigencia interna en verde (ACTIVO + APROBADO vigente) para que el REPS sea
 * el discriminador. Control positivo por contraste: la modalidad que el REPS SÍ cubre se crea; la que no, se
 * omite con motivo `reps` (no se crea). Integración (BD de test).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { materializarFranjas } from "./franjas.service";
import type { ModalidadReps } from "@prisma/client";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.now();
const FUT = new Date(AHORA + 90 * DIA);
let ciudadId: string;
let n = 0;

async function profConReps(modalidades: ModalidadReps[] | null): Promise<string> {
    const u = await crearUsuario("PROFESIONAL", `pro.825p2.${Date.now()}.${n++}@ejemplo.local`);
    const p = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id, nombreVisible: "Dra. Cinturón", tituloProfesional: "Psicología", especialidades: ["infantil"],
            ciudadId, atiendeVirtual: true, atiendePresencial: true, aniosExperiencia: 5,
            presentacion: "Perfil de prueba — cinturón de creación REPS.", tarifaConsultaCOP: 120000, duracionMinutos: 45,
            estado: "ACTIVO",
        },
    });
    const rev = await crearUsuario("ADMIN", `adm.825p2.${Date.now()}.${n++}@ejemplo.local`);
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: p.id, revisadoPorId: rev.id, revisadoEn: new Date(AHORA - 10 * DIA),
            checklist: {}, resultado: "APROBADO", autorizacionArchivoId: `arch-${p.id}`, venceEn: FUT,
        },
    });
    // modalidades === null → NO se crea fila REPS: el profesional queda SIN_VERIFICAR (el universo de hoy,
    // antes de que el padrón se verifique). Con el cutover ABIERTO ese estado es elegible.
    if (modalidades !== null) {
        await prisma.verificacionReps.create({
            data: {
                profesionalId: p.id, verificadoEn: new Date(AHORA - 5 * DIA), fuente: "MANUAL_ADMIN",
                resultado: "VIGENTE", vigenteHasta: FUT, modalidades,
            },
        });
    }
    return p.id;
}

/** Una entrada dentro de la vigencia (fin < venceEn), sin solape. `dias` separa slots para que no se pisen. */
function entrada(modalidad: "VIRTUAL" | "PRESENCIAL", dias = 7) {
    const inicio = new Date(AHORA + dias * DIA);
    return { inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 45 * 60_000).toISOString(), modalidad };
}

describe("SPEC-825 pieza 2 · la creación no publica una modalidad sin REPS", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        ciudadId = (await crearPaisCiudad()).ciudad.id;
    });
    afterAll(async () => prisma.$disconnect());

    it("REPS solo PRESENCIAL + entrada VIRTUAL → NO se crea (motivo reps)", async () => {
        const id = await profConReps(["PRESENCIAL"]);
        const r = await materializarFranjas(id, [entrada("VIRTUAL")]);
        expect(r.creadas).toBe(0);
        expect(r.omitidas.map((o) => o.motivo)).toContain("reps");
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: id } }), "el estado malo no nace").toBe(0);
    });

    it("contraste: REPS presencial + entrada PRESENCIAL → SÍ se crea", async () => {
        const id = await profConReps(["PRESENCIAL"]);
        const r = await materializarFranjas(id, [entrada("PRESENCIAL")]);
        expect(r.creadas).toBe(1);
        expect(r.omitidas).toHaveLength(0);
    });

    it("contraste: REPS que cubre TELEMEDICINA + entrada VIRTUAL → SÍ se crea", async () => {
        const id = await profConReps(["PRESENCIAL", "TELEMEDICINA"]);
        const r = await materializarFranjas(id, [entrada("VIRTUAL")]);
        expect(r.creadas).toBe(1);
        expect(r.omitidas).toHaveLength(0);
    });

    // El cutover está ABIERTO (`reps.exigir_reps_verificado` = false por defecto): SIN_VERIFICAR —el universo de
    // hoy, sin fila REPS— es ELEGIBLE. El cinturón NO lo puede morder, o dejaría al padrón entero sin poder
    // publicar su agenda. Es el mismo comportamiento que la reserva (cita.service.ts) y la puerta unitaria (834).
    it("SIN_VERIFICAR (sin fila REPS, cutover abierto) → SÍ se crea (el cinturón no muerde al padrón)", async () => {
        const id = await profConReps(null);
        const r = await materializarFranjas(id, [entrada("VIRTUAL", 7), entrada("PRESENCIAL", 8)]);
        expect(r.creadas, "SIN_VERIFICAR es elegible mientras el cutover siga abierto").toBe(2);
        expect(r.omitidas.map((o) => o.motivo), "ningún motivo reps para SIN_VERIFICAR").not.toContain("reps");
    });
});
