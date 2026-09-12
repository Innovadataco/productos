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
 *  4. SEGURIDAD ANTE LOS BARRIDOS: los estados VIVOS (no terminales) se siembran
 *     con reloj reciente y cita futura, FUERA de la ventana de los dos barridos de
 *     `worker.ts` (vencimiento recoge PAGADA_PENDIENTE con pago >48h; plazo recoge
 *     SIN_CONFIRMAR con venceEn pasado). Sembrarlos históricos los volcaría a
 *     VENCIDA en la próxima corrida (15 min) y suspendería profesionales → rompe
 *     el candado #1 en runtime. (El worker es el único que escanea citas y NO
 *     notifica — I-385; el peligro es mutación de estado, no correo.)
 *
 * Muere por mutación: bajar el estado del perfil, dejar un estado en 0, cambiar
 * qué estados liberan la franja, o ensanchar la ventana viva por encima de 48h → rojo.
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
    ESTADOS_VIVOS,
    esEstadoVivo,
    HORAS_CITA_VIVA_MAX,
    HORAS_PAGO_APROBADO,
    HORAS_PLAZO_PADRE,
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

describe("SPEC-676 · candado 4 · los estados VIVOS se siembran fuera de la ventana de los barridos", () => {
    const H = 60 * 60 * 1000;
    const ahora = Date.now();
    // El barrido de vencimiento recoge PAGADA_PENDIENTE con pagoAprobadoEn ≤ ahora−48h.
    const BARRIDO_VENCIMIENTO_H = 48;

    // Espejo EXACTO de los predicados del ÚNICO worker que escanea SolicitudCita
    // (src/lib/dal/repositories/solicitud-cita.ts:114-137, ejercitados de verdad por
    // src/lib/profesional/cita/worker.test.ts). El worker no notifica (I-385): el
    // riesgo es que MUTE la fila sembrada.
    const recogeVencimiento = (pagoAprobadoEn: Date | null) =>
        pagoAprobadoEn !== null && pagoAprobadoEn.getTime() <= ahora - BARRIDO_VENCIMIENTO_H * H;
    const recogePlazo = (pagoAprobadoEn: Date | null, venceEn: Date) =>
        pagoAprobadoEn === null && venceEn.getTime() < ahora;

    // Reloj que el seeder da a una cita viva en su antigüedad MÁXIMA (peor caso).
    const creadoEnPeor = new Date(ahora - HORAS_CITA_VIVA_MAX * H);
    const pagoVivo = new Date(creadoEnPeor.getTime() + HORAS_PAGO_APROBADO * H);
    const venceVivo = new Date(creadoEnPeor.getTime() + HORAS_PLAZO_PADRE * H);

    it("PAGADA_PENDIENTE viva: el pago queda < 48h → el barrido de vencimiento NO la recoge", () => {
        expect(recogeVencimiento(pagoVivo)).toBe(false);
        // La holgura es estructural: MAX + pago < 48.
        expect(HORAS_CITA_VIVA_MAX + HORAS_PAGO_APROBADO).toBeLessThan(BARRIDO_VENCIMIENTO_H);
    });

    it("SIN_CONFIRMAR viva: venceEn queda a futuro → el barrido de plazo NO la recoge", () => {
        expect(recogePlazo(null, venceVivo)).toBe(false);
        expect(HORAS_PLAZO_PADRE).toBeGreaterThan(HORAS_CITA_VIVA_MAX);
    });

    it("control positivo: sembradas históricas (el defecto), los barridos SÍ las recogen", () => {
        const historico = new Date(ahora - 200 * 24 * H);
        expect(recogeVencimiento(new Date(historico.getTime() + HORAS_PAGO_APROBADO * H))).toBe(true);
        expect(recogePlazo(null, new Date(historico.getTime() + HORAS_PLAZO_PADRE * H))).toBe(true);
    });

    it("los dos estados que el worker barre son VIVOS (el seeder les da reloj reciente)", () => {
        expect(esEstadoVivo("PAGADA_PENDIENTE")).toBe(true);
        expect(esEstadoVivo("SIN_CONFIRMAR")).toBe(true);
        expect(new Set(ESTADOS_VIVOS)).toEqual(new Set(["CONFIRMADA", "PAGADA_PENDIENTE", "SIN_CONFIRMAR"]));
        // Los terminales NO son vivos → se siembran históricos, inertes al worker.
        expect(esEstadoVivo("CUMPLIDA")).toBe(false);
        expect(esEstadoVivo("VENCIDA_SIN_RESPUESTA")).toBe(false);
    });
});
