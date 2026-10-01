/**
 * CANDADO · SPEC-790 (T4) · el directorio aplica el gate REPS, derivado de la ÚLTIMA fila de
 * `VerificacionReps` (orden por `verificadoEn`). Con el cutover ABIERTO (default: `EXIGIR_REPS_VERIFICADO`
 * ausente = `false`):
 *  · SIN fila REPS (SIN_VERIFICAR) → PASA (hoy es el universo; cerrar vaciaría el directorio).
 *  · `VENCIDA` / `NO_ENCONTRADA` → CIERRAN siempre (aunque el cutover esté abierto).
 *  · `VIGENTE` al día → PASA; `VIGENTE` con `vigenteHasta` pasado → CIERRA.
 *
 * El profesional se siembra con la vigencia INTERNA en verde (ACTIVO + APROBADO vigente), para que el REPS
 * sea el DISCRIMINADOR y no un efecto de rebote del filtro viejo. Control positivo: la ÚLTIMA fila manda —
 * una `VENCIDA` seguida de una `VIGENTE` más reciente rehabilita. Integración (BD de test, truncada).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { PerfilProfesionalRepository } from "./perfil-profesional";
import type { EstadoReps, ModalidadReps } from "@prisma/client";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date();
const FUT = new Date(AHORA.getTime() + 90 * DIA);
const PAS = new Date(AHORA.getTime() - 1 * DIA);

describe("SPEC-790 (T4) · el directorio aplica el gate REPS (última fila + cutover)", () => {
    const repo = new PerfilProfesionalRepository();
    let ciudadId: string;

    beforeEach(async () => {
        await resetDatabase();
        const { ciudad } = await crearPaisCiudad();
        ciudadId = ciudad.id;
    });
    afterAll(async () => prisma.$disconnect());

    /** ACTIVO + vigencia interna OK (APROBADO vigente): el REPS queda como ÚNICO discriminador. */
    async function profHabilitadoInterno(nombre: string): Promise<string> {
        const u = await crearUsuario("PROFESIONAL");
        const p = await prisma.perfilProfesional.create({
            data: {
                usuarioId: u.id,
                nombreVisible: nombre,
                tituloProfesional: "Psicología",
                especialidades: ["infantil"],
                ciudadId,
                atiendeVirtual: true,
                aniosExperiencia: 5,
                presentacion: "Perfil de prueba — gate REPS.",
                tarifaConsultaCOP: 120000,
                duracionMinutos: 45,
                estado: "ACTIVO",
            },
        });
        const rev = await crearUsuario("ADMIN");
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

    async function reps(
        perfilId: string,
        resultado: EstadoReps,
        opts: { verificadoEn?: Date; vigenteHasta?: Date | null; modalidades?: ModalidadReps[] } = {},
    ): Promise<void> {
        await prisma.verificacionReps.create({
            data: {
                profesionalId: perfilId,
                verificadoEn: opts.verificadoEn ?? new Date(AHORA.getTime() - 5 * DIA),
                fuente: "MANUAL_ADMIN",
                resultado,
                vigenteHasta: opts.vigenteHasta !== undefined ? opts.vigenteHasta : resultado === "VIGENTE" ? FUT : null,
                modalidades: opts.modalidades ?? (resultado === "VIGENTE" ? ["PRESENCIAL", "TELEMEDICINA"] : []),
            },
        });
    }

    async function enDirectorio(perfilId: string): Promise<boolean> {
        const ids = new Set((await repo.listarActivos({}, null, AHORA)).map((p) => p.id));
        return ids.has(perfilId);
    }

    it("SIN fila REPS (SIN_VERIFICAR) + cutover abierto → PASA", async () => {
        const id = await profHabilitadoInterno("SinReps");
        expect(await enDirectorio(id)).toBe(true);
    });

    it("VIGENTE al día → PASA; VENCIDA y NO_ENCONTRADA → CIERRAN aun con el cutover abierto", async () => {
        const vig = await profHabilitadoInterno("Vigente");
        await reps(vig, "VIGENTE");
        const ven = await profHabilitadoInterno("Vencida");
        await reps(ven, "VENCIDA");
        const noe = await profHabilitadoInterno("NoEnc");
        await reps(noe, "NO_ENCONTRADA");
        expect(await enDirectorio(vig), "VIGENTE al día aparece").toBe(true);
        expect(await enDirectorio(ven), "VENCIDA cierra siempre").toBe(false);
        expect(await enDirectorio(noe), "NO_ENCONTRADA cierra siempre").toBe(false);
    });

    it("VIGENTE pero con vigencia vencida (vigenteHasta pasado) → CIERRA", async () => {
        const id = await profHabilitadoInterno("VigPeroVencida");
        await reps(id, "VIGENTE", { vigenteHasta: PAS });
        expect(await enDirectorio(id)).toBe(false);
    });

    it("control positivo: la ÚLTIMA fila manda — VENCIDA y luego una VIGENTE más reciente rehabilita", async () => {
        const id = await profHabilitadoInterno("ReVerificada");
        await reps(id, "VENCIDA", { verificadoEn: new Date(AHORA.getTime() - 20 * DIA) });
        expect(await enDirectorio(id), "con la VENCIDA como última, cerrado").toBe(false);
        await reps(id, "VIGENTE", { verificadoEn: new Date(AHORA.getTime() - 1 * DIA) });
        expect(await enDirectorio(id), "la VIGENTE nueva es la última → rehabilitado").toBe(true);
    });

    it("obtenerPublicoPorId también cierra sobre una VENCIDA (no solo la lista; cubre el agendar)", async () => {
        const id = await profHabilitadoInterno("DetalleVencida");
        await reps(id, "VENCIDA");
        expect(await repo.obtenerPublicoPorId(id, null, AHORA)).toBeNull();
    });

    it("repsAlDia (derivación NOMBRADA, queryable por profesional): VIGENTE al día→true · SIN_VERIFICAR(cutover)→true · VENCIDA→false", async () => {
        const vig = await profHabilitadoInterno("RA_Vig");
        await reps(vig, "VIGENTE");
        const sin = await profHabilitadoInterno("RA_Sin"); // sin fila REPS
        const ven = await profHabilitadoInterno("RA_Ven");
        await reps(ven, "VENCIDA");
        expect(await repo.repsAlDia(vig, AHORA)).toBe(true);
        expect(await repo.repsAlDia(sin, AHORA), "SIN_VERIFICAR pasa con el cutover abierto").toBe(true);
        expect(await repo.repsAlDia(ven, AHORA), "una VENCIDA no está al día (→ el aviso «fuera de la oferta»)").toBe(false);
    });

    it("T4b · esRepsElegibleParaModalidad: un VIGENTE presencial-only atiende PRESENCIAL, NO TELEMEDICINA", async () => {
        const id = await profHabilitadoInterno("SoloPresencial");
        await reps(id, "VIGENTE", { modalidades: ["PRESENCIAL"] });
        expect(await repo.esRepsElegibleParaModalidad(id, "PRESENCIAL", AHORA)).toBe(true);
        expect(
            await repo.esRepsElegibleParaModalidad(id, "TELEMEDICINA", AHORA),
            "una habilitación presencial no atiende una cita de telemedicina (T4b)",
        ).toBe(false);
        // y el directorio (vigencia-only) sí lo lista — la modalidad se exige al RESERVAR, no al listar.
        expect(await enDirectorio(id), "en el directorio aparece (vigencia manda; la modalidad es del booking)").toBe(true);
    });

    // SPEC-836 (4ª variante) · clasificarReps separa los dos estados de REVISION_ADMIN para el PANEL del
    // profesional: el 7 (re-chequeo nuestro) y el 5 (NO_ENCONTRADA) muestran banners DISTINTOS. Control
    // positivo por EXCLUSIÓN del discriminador: cada uno enciende SU signal y apaga el del otro.
    it("discriminador del panel: estado 5 (NO_ENCONTRADA) → esNoConfirmada, NO esReVerificacion", async () => {
        const id = await profHabilitadoInterno("NoEnc5");
        await reps(id, "NO_ENCONTRADA");
        const r = await repo.clasificarReps(id, AHORA);
        expect(r.clasificacion).toBe("REVISION_ADMIN");
        expect(r.esNoConfirmada, "el 5 enciende su propio banner").toBe(true);
        expect(r.esReVerificacion, "el 5 NO es el banner del 7 («sigue al día» mentiría)").toBe(false);
    });

    it("discriminador del panel: estado 7 (re-chequeo viejo, vigente) → esReVerificacion, NO esNoConfirmada", async () => {
        const id = await profHabilitadoInterno("ReVerif7");
        await reps(id, "VIGENTE", { verificadoEn: new Date(AHORA.getTime() - 400 * DIA) }); // ventana nuestra vencida
        const r = await repo.clasificarReps(id, AHORA);
        expect(r.clasificacion).toBe("REVISION_ADMIN");
        expect(r.esReVerificacion, "el 7 es el banner de re-verificación").toBe(true);
        expect(r.esNoConfirmada, "el 7 NO es el banner del 5 (su inscripción SÍ está en el registro)").toBe(false);
    });
});
