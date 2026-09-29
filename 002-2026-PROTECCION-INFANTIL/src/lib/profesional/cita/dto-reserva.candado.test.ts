/**
 * CANDADO de RESERVA · SPEC-758 (D-121) — el ENLACE de la reunión (y sus metadatos)
 * NUNCA salen por los DTOs que ve el padre o el profesional.
 *
 * Se endurece por NOMBRE desde YA, antes de que exista el lector (el consumidor va en
 * SPEC-750): así el PR del consumidor no puede colar el enlace a un DTO sin romper este
 * candado. Mismo patrón que `CAMPOS_INTERNOS_PROFESIONAL` / `direccionAtencion` (#665).
 *
 * CLAVE (lección de #665): el campo va PRESENTE en el escenario, para probar la EXCLUSIÓN
 * cuando el dato ESTÁ — no la ausencia de algo que nunca estuvo. El tercer test es el
 * control positivo de que la fixture realmente lo trae.
 *
 * ⚠️ ALCANCE (SPEC-778 · el significado de este verde CAMBIÓ sin cambiar el código): este
 * candado vigila NOMBRES (`CAMPOS_INTERNOS_CITA`), no valores. ANTES de 778 «ningún nombre
 * crudo» equivalía a «el valor del enlace nunca sale», porque no había otra puerta. DESDE
 * 778 el VALOR de `enlaceReunion` SÍ sale, gateado, bajo la clave derivada `enlace.url`; lo
 * que lo protege es `enlace-derivado.candado.test.ts` (verificado por mutación), NO éste.
 * `enlaceOperadorId`/`enlacePublicadoEn` siguen sin salir ni por nombre ni por valor. Si lees
 * este verde y concluyes «el valor está reservado», te equivocas: la protección se mudó a la
 * derivación gateada.
 *
 * Unit puro (construcción de objetos, sin BD).
 */
import { describe, it, expect } from "vitest";
import { toCitaParaPadre, toCitaParaProfesional, CAMPOS_INTERNOS_CITA } from "./dto";

const AHORA = new Date("2026-09-11T12:00:00Z");

// Los campos de enlace, PRESENTES en el escenario.
const CON_ENLACE = {
    enlaceReunion: "https://video.example/sala-xyz",
    enlaceOperadorId: "operador-1",
    enlacePublicadoEn: new Date("2026-09-11T14:00:00Z"),
};

const solicitudPadre = {
    id: "sol-1",
    ...CON_ENLACE,
    estado: "CONFIRMADA",
    urgencia: "SIN_APURO",
    pagoAprobadoEn: AHORA,
    creadoEn: AHORA,
    venceEn: AHORA,
    montoTotal: 110_000,
    solicitudPreviaId: null,
    pagoHeredadoDeId: null,
    expedienteCompartidoId: null,
    profesional: {
        id: "pro-1",
        nombreVisible: "Dra. Test",
        tituloProfesional: "Psicóloga",
        estado: "ACTIVO",
        ciudad: { id: "c1", nombre: "Bogotá" },
        usuario: { email: "pro@test.local", telefono: "+573000000000" },
    },
    franja: { inicio: AHORA, fin: AHORA, modalidad: "VIRTUAL" },
} as never;

const solicitudProf = {
    id: "sol-1",
    ...CON_ENLACE,
    estado: "CONFIRMADA",
    urgencia: "SIN_APURO",
    pagoAprobadoEn: AHORA,
    creadoEn: AHORA,
    presentacion: "Hola, necesito una cita.",
    expedienteCompartidoId: null,
    montoConsulta: 100_000,
    padreUsuario: { id: "padre-1", nombre: "Familia", email: "padre@test.local" },
    franja: { inicio: AHORA, fin: AHORA, modalidad: "VIRTUAL" },
} as never;

describe("SPEC-758 · reserva por nombre — el enlace NUNCA sale por los DTOs de la cita", () => {
    it("toCitaParaPadre excluye los campos internos de enlace (con el dato PRESENTE)", () => {
        const dto = toCitaParaPadre(solicitudPadre, AHORA) as unknown as Record<string, unknown>;
        for (const clave of CAMPOS_INTERNOS_CITA) {
            expect(dto, `el campo interno "${clave}" se coló al DTO del padre`).not.toHaveProperty(clave);
        }
    });

    it("toCitaParaProfesional excluye los campos internos de enlace (con el dato PRESENTE)", () => {
        const dto = toCitaParaProfesional(solicitudProf, AHORA) as unknown as Record<string, unknown>;
        for (const clave of CAMPOS_INTERNOS_CITA) {
            expect(dto, `el campo interno "${clave}" se coló al DTO del profesional`).not.toHaveProperty(clave);
        }
    });

    it("control positivo: el escenario SÍ trae el enlace (si no, la exclusión no probaría nada)", () => {
        for (const fixture of [solicitudPadre, solicitudProf]) {
            const bruto = fixture as unknown as Record<string, unknown>;
            expect(bruto).toHaveProperty("enlaceReunion", "https://video.example/sala-xyz");
            expect(bruto).toHaveProperty("enlaceOperadorId");
            expect(bruto).toHaveProperty("enlacePublicadoEn");
        }
    });
});
