/**
 * CANDADO · SPEC-676 · el plan del poblador de la Red de Apoyo, sin BD.
 *
 * Tres garantías (radicado):
 *  1. VISIBILIDAD (primero): cada profesional sembrado APARECE en el directorio
 *     del padre — perfil ACTIVO + verificación APROBADO vigente (SPEC-449) + ≥1
 *     modalidad (I-398). Diez invisibles serían peor que ninguno.
 *  2. LOS NUEVE ESTADOS representados (recorriendo el enum de Prisma, no una lista
 *     a mano: un estado nuevo que el plan no cubra → rojo). Con la asimetría de
 *     D-137 (padre-no-asistió ≫ profesional-no-asistió; REEMBOLSADA > 0).
 *  3. INVARIANTE franja↔estado: sólo REPROGRAMADA y VENCIDA_SIN_RESPUESTA liberan
 *     la franja (los únicos que llaman liberar() en el producto); el resto la ocupa.
 *
 * Muere por mutación: bajar el estado del perfil, dejar un estado en 0, o cambiar
 * qué estados liberan la franja → rojo.
 */
import { describe, it, expect } from "vitest";
import { EstadoSolicitudCita } from "@prisma/client";
import { puedeAparecerEnDirectorio } from "@/lib/profesionales/vigencia";
import {
    NUM_PROFESIONALES,
    PROF_ALTA,
    PROF_MEDIA,
    PROF_BAJA,
    PROF_VIRTUAL_ONLY,
    PROF_PRESENCIAL_ONLY,
    PROF_AMBAS,
    OBJETIVO_ESTADOS,
    ESTADO_PERFIL_DEMO,
    REVISADO_HACE_DIAS,
    construirPlanEstados,
    franjaTomadaPara,
    esEstadoLiberado,
    modalidadesDeProfesional,
    perfilVisibleDemo,
    ESTADOS_FRANJA_LIBERADA,
} from "./lib/red-apoyo-plan";
import { verificacionDemo } from "./lib/profesional-demo";

const AHORA = new Date();
const revisadoEn = new Date(AHORA.getTime() - REVISADO_HACE_DIAS * 24 * 60 * 60 * 1000);

describe("SPEC-676 · candado 1 · cada profesional sembrado APARECE en el directorio", () => {
    it("perfil ACTIVO + verificación APROBADA vigente → visible (los 50)", () => {
        // La forma que siembra el script es la misma que se alimenta al helper.
        const plan = perfilVisibleDemo(revisadoEn);
        expect(puedeAparecerEnDirectorio({ estado: plan.estado }, [plan.verificacion], AHORA)).toBe(true);
    });

    it("muere si el perfil sembrado no fuera ACTIVO (invisible = peor que nada)", () => {
        expect(puedeAparecerEnDirectorio({ estado: "BORRADOR" }, [verificacionDemo(revisadoEn)], AHORA)).toBe(false);
    });

    it("muere sin verificación vigente (ACTIVO no basta, SPEC-449)", () => {
        expect(puedeAparecerEnDirectorio({ estado: ESTADO_PERFIL_DEMO }, [], AHORA)).toBe(false);
    });

    it("I-398: cada uno de los 50 tiene ≥1 modalidad, y el reparto da conjuntos distintos", () => {
        for (let i = 0; i < NUM_PROFESIONALES; i++) {
            expect(modalidadesDeProfesional(i).length, `prof ${i} sin modalidad`).toBeGreaterThanOrEqual(1);
        }
        // El filtro del directorio ve conjuntos DISTINTOS (no todo-o-nada).
        const virtual = Array.from({ length: NUM_PROFESIONALES }, (_, i) => i).filter((i) => modalidadesDeProfesional(i).includes("VIRTUAL"));
        const presencial = Array.from({ length: NUM_PROFESIONALES }, (_, i) => i).filter((i) => modalidadesDeProfesional(i).includes("PRESENCIAL"));
        expect(virtual.length).toBe(PROF_VIRTUAL_ONLY + PROF_AMBAS);
        expect(presencial.length).toBe(PROF_PRESENCIAL_ONLY + PROF_AMBAS);
        expect(virtual.length).toBeLessThan(NUM_PROFESIONALES); // no todos
        expect(presencial.length).toBeLessThan(NUM_PROFESIONALES);
    });

    it("los buckets y el reparto de modalidad suman 50", () => {
        expect(PROF_ALTA + PROF_MEDIA + PROF_BAJA).toBe(NUM_PROFESIONALES);
        expect(PROF_VIRTUAL_ONLY + PROF_PRESENCIAL_ONLY + PROF_AMBAS).toBe(NUM_PROFESIONALES);
    });
});

describe("SPEC-676 · candado 2 · los NUEVE estados representados", () => {
    it("cada valor del enum EstadoSolicitudCita tiene objetivo > 0", () => {
        for (const estado of Object.values(EstadoSolicitudCita)) {
            expect(OBJETIVO_ESTADOS[estado], `estado ${estado} sin objetivo (>0)`).toBeGreaterThan(0);
        }
    });

    it("el plan concreto contiene los 9 estados", () => {
        const plan = construirPlanEstados();
        const presentes = new Set(plan);
        for (const estado of Object.values(EstadoSolicitudCita)) {
            expect(presentes.has(estado), `el plan no incluye ${estado}`).toBe(true);
        }
        // Suma coherente con los objetivos.
        expect(plan.length).toBe(Object.values(OBJETIVO_ESTADOS).reduce((a, b) => a + b, 0));
    });

    it("asimetría D-137: padre-no-asistió ≫ profesional-no-asistió, y REEMBOLSADA existe", () => {
        expect(OBJETIVO_ESTADOS.NO_ASISTIO_PADRE).toBeGreaterThan(OBJETIVO_ESTADOS.NO_ASISTIO_PROFESIONAL);
        expect(OBJETIVO_ESTADOS.REEMBOLSADA).toBeGreaterThan(0);
        // VENCIDA_SIN_RESPUESTA con volumen cómodo para ejercitar el barrido SPEC-657.
        expect(OBJETIVO_ESTADOS.VENCIDA_SIN_RESPUESTA).toBeGreaterThanOrEqual(40);
    });
});

describe("SPEC-676 · candado 3 · invariante franja↔estado (solo 2 estados liberan)", () => {
    it("REPROGRAMADA y VENCIDA_SIN_RESPUESTA liberan la franja; los otros 7 la ocupan", () => {
        const liberados = new Set<string>(ESTADOS_FRANJA_LIBERADA);
        expect(liberados).toEqual(new Set(["REPROGRAMADA", "VENCIDA_SIN_RESPUESTA"]));
        for (const estado of Object.values(EstadoSolicitudCita)) {
            const esperadoTomada = !liberados.has(estado);
            expect(franjaTomadaPara(estado), `franjaTomadaPara(${estado})`).toBe(esperadoTomada);
            expect(esEstadoLiberado(estado)).toBe(liberados.has(estado));
        }
    });
});
