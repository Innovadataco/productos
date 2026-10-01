/**
 * CANDADO · SPEC-790 · el MOTOR puro de elegibilidad REPS. Sin base: todo es la derivación.
 *
 *  · C-1 (falso amigo): `EstadoReps` y `EstadoPerfilProfesional` son DISJUNTOS — el «habilitado»
 *    interno de onboarding y el resultado del REPS no pueden confundirse por un valor compartido.
 *  · C-2 (DOS relojes, D-4): un VIGENTE cae si vence CUALQUIERA — el de la AUTORIDAD (`vigenteHasta`)
 *    o el NUESTRO (`verificadoEn` + ventana). Sin fecha de autoridad NO es «vigente para siempre».
 *  · D-5 (modalidad): «al día» incluye que el REPS cubra la modalidad del servicio, no solo la vigencia.
 *  · D-7 (cutover): VENCIDA/NO_ENCONTRADA cierran SIEMPRE; SIN_VERIFICAR lo rige el flag; y un
 *    SIN_VERIFICAR abierto NUNCA se confunde con VIGENTE (lleva su propio estado y motivo).
 *
 * Control positivo por MUTACIÓN: cada «NO elegible» se acompaña de la fila gemela que SÍ pasa al
 * mover UN solo campo — prueba que cierra por esa razón y no de rebote.
 */
import { describe, it, expect } from "vitest";
import { repsElegible, ESTADOS_REPS, type HechoReps, type ConfigReps } from "./reps-elegibilidad";
import { EstadoPerfilProfesional } from "@prisma/client";

const DIA = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-15T12:00:00Z");
const EXIGE: ConfigReps = { ventanaVerificacionDias: 365, exigirRepsVerificado: true };
const CUTOVER: ConfigReps = { ventanaVerificacionDias: 365, exigirRepsVerificado: false };

/** Un VIGENTE al día: verificado hace poco, autoridad vigente, cubre ambas modalidades. */
const VIGENTE_AL_DIA: HechoReps = {
    resultado: "VIGENTE",
    verificadoEn: new Date(NOW.getTime() - 10 * DIA),
    vigenteHasta: new Date(NOW.getTime() + 200 * DIA),
    modalidades: ["VIRTUAL", "PRESENCIAL"],
};

describe("SPEC-790 · repsElegible (motor puro)", () => {
    it("C-1 · EstadoReps y EstadoPerfilProfesional son DISJUNTOS (no confundir el estado interno con el REPS)", () => {
        const internos = new Set(Object.values(EstadoPerfilProfesional) as string[]);
        const solapan = ESTADOS_REPS.filter((r) => internos.has(r));
        expect(
            solapan,
            `un valor compartido deja que el 'habilitado' interno pase por REPS (o al revés): ${solapan.join(", ")}`,
        ).toEqual([]);
    });

    it("VIGENTE dentro de los dos relojes y con la modalidad requerida → elegible", () => {
        const r = repsElegible(VIGENTE_AL_DIA, "VIRTUAL", EXIGE, NOW);
        expect(r.elegible).toBe(true);
        expect(r.estado).toBe("VIGENTE");
    });

    it("C-2 · reloj de la AUTORIDAD: vigenteHasta pasado → NO; mover la fecha al futuro rehabilita", () => {
        const vencido: HechoReps = { ...VIGENTE_AL_DIA, vigenteHasta: new Date(NOW.getTime() - 1 * DIA) };
        expect(repsElegible(vencido, "VIRTUAL", EXIGE, NOW).elegible).toBe(false);
        expect(repsElegible({ ...vencido, vigenteHasta: new Date(NOW.getTime() + 1 * DIA) }, "VIRTUAL", EXIGE, NOW).elegible).toBe(true);
    });

    it("C-2 · NUESTRO reloj: verificado más allá de la ventana → NO aunque la autoridad siga vigente; ensanchar la ventana rehabilita", () => {
        const viejo: HechoReps = { ...VIGENTE_AL_DIA, verificadoEn: new Date(NOW.getTime() - 400 * DIA) };
        expect(repsElegible(viejo, "VIRTUAL", EXIGE, NOW).elegible).toBe(false);
        expect(repsElegible(viejo, "VIRTUAL", { ...EXIGE, ventanaVerificacionDias: 401 }, NOW).elegible).toBe(true);
    });

    it("C-2 · VIGENTE sin fecha de vigencia (null) → NO elegible (nunca «vigente para siempre»)", () => {
        expect(repsElegible({ ...VIGENTE_AL_DIA, vigenteHasta: null }, "VIRTUAL", EXIGE, NOW).elegible).toBe(false);
    });

    it("D-5 · modalidad: VIGENTE al día pero el REPS no cubre la requerida → NO; agregarla rehabilita", () => {
        const soloPresencial: HechoReps = { ...VIGENTE_AL_DIA, modalidades: ["PRESENCIAL"] };
        expect(repsElegible(soloPresencial, "VIRTUAL", EXIGE, NOW).elegible).toBe(false);
        expect(repsElegible({ ...soloPresencial, modalidades: ["PRESENCIAL", "VIRTUAL"] }, "VIRTUAL", EXIGE, NOW).elegible).toBe(true);
    });

    it("D-7 · VENCIDA y NO_ENCONTRADA cierran SIEMPRE — incluso con el cutover abierto", () => {
        for (const resultado of ["VENCIDA", "NO_ENCONTRADA"] as const) {
            const h: HechoReps = { ...VIGENTE_AL_DIA, resultado };
            expect(repsElegible(h, "VIRTUAL", CUTOVER, NOW).elegible, `${resultado} no puede abrir ni con exigir=false`).toBe(false);
            expect(repsElegible(h, "VIRTUAL", EXIGE, NOW).elegible).toBe(false);
        }
    });

    it("D-7 · SIN_VERIFICAR lo rige exigirRepsVerificado (abre con false, cierra con true); `null` se comporta igual", () => {
        const sinVerif: HechoReps = { ...VIGENTE_AL_DIA, resultado: "SIN_VERIFICAR" };
        expect(repsElegible(sinVerif, "VIRTUAL", CUTOVER, NOW).elegible).toBe(true);
        expect(repsElegible(sinVerif, "VIRTUAL", EXIGE, NOW).elegible).toBe(false);
        expect(repsElegible(null, "VIRTUAL", CUTOVER, NOW).elegible).toBe(true);
        expect(repsElegible(null, "VIRTUAL", EXIGE, NOW).elegible).toBe(false);
    });

    it("D-7 · un SIN_VERIFICAR abierto NO se confunde con VIGENTE: distinto estado y motivo (la alarma queda legible)", () => {
        const abierto = repsElegible(null, "VIRTUAL", CUTOVER, NOW);
        const alDia = repsElegible(VIGENTE_AL_DIA, "VIRTUAL", CUTOVER, NOW);
        expect(abierto.elegible).toBe(true);
        expect(alDia.elegible).toBe(true);
        expect(abierto.estado).toBe("SIN_VERIFICAR");
        expect(alDia.estado).toBe("VIGENTE");
        expect(abierto.motivo).not.toBe(alDia.motivo);
    });

    it("fail-closed · now inválido → NO elegible (no abrir ante la duda)", () => {
        expect(repsElegible(VIGENTE_AL_DIA, "VIRTUAL", CUTOVER, new Date(NaN)).elegible).toBe(false);
    });
});
