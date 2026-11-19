/**
 * SPEC-754 · el contacto mutuo está CERRADO. `debeExponerContacto` (padre→profesional) devuelve
 * `false` SIEMPRE: la fuente `contactoVisiblePorSesion` es `false` y la excepción de reembolso
 * (`VENCIDA_SIN_RESPUESTA`+48h) MIGRÓ a la PQR (SPEC-752, D-1). Antes (SPEC-395) CONFIRMADA y la
 * excepción de 48h abrían el contacto; ya no.
 *
 * El guard de perfil VENCIDO/SUSPENDIDO se conserva SUBSUMIDO y se EJERCITA con la fuente forzada a
 * `true` + perfil VENCIDO en `contacto-fuente-unica.candado.test.ts` (acá la fuente real es `false`,
 * así que el guard no sería el decisor y no probaría nada).
 */
import { describe, it, expect } from "vitest";
import { debeExponerContacto, toCitaParaPadre } from "./dto";

const AHORA = new Date("2026-09-10T12:00:00Z");
const HACE_49H = new Date("2026-09-08T11:00:00Z");

describe("debeExponerContacto · padre→profesional, reabierto tras la 1.ª cita consumida (SPEC-940)", () => {
    it.each(["CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE"] as const)(
        "%s → true (el padre ve al profesional tras consumir su 1.ª cita)",
        (estado) => {
            expect(debeExponerContacto({ estado, pagoAprobadoEn: AHORA }, AHORA, "ACTIVO")).toBe(true);
        },
    );

    it.each(["SIN_CONFIRMAR", "PAGADA_PENDIENTE", "VENCIDA_SIN_RESPUESTA", "REEMBOLSADA", "REPROGRAMADA", "NO_ASISTIO_PROFESIONAL"] as const)(
        "%s → false (no consumió la 1.ª cita con ese profesional)",
        (estado) => {
            expect(debeExponerContacto({ estado, pagoAprobadoEn: AHORA }, AHORA, "ACTIVO")).toBe(false);
        },
    );

    it("perfil VENCIDO/SUSPENDIDO → false AUNQUE esté CONFIRMADA (override legal H-2, por encima de la reapertura)", () => {
        expect(debeExponerContacto({ estado: "CONFIRMADA", pagoAprobadoEn: AHORA }, AHORA, "VENCIDO")).toBe(false);
        expect(debeExponerContacto({ estado: "CONFIRMADA", pagoAprobadoEn: AHORA }, AHORA, "SUSPENDIDO")).toBe(false);
    });
});

describe("toCitaParaPadre · adjunta el contacto del profesional tras la 1.ª cita consumida (SPEC-940)", () => {
    const solicitudBase = {
        id: "sol-1",
        padreUsuarioId: "padre-1",
        profesionalId: "pro-1",
        franjaId: "fr-1",
        presentacion: "Necesito ayuda con mi hijo.",
        urgencia: "SIN_APURO" as const,
        expedienteCompartidoId: null,
        solicitudPreviaId: null,
        pagoHeredadoDeId: null,
        montoConsulta: 100000,
        montoServicio: 10000,
        montoTotal: 110000,
        porcentajeServicio: 10,
        venceEn: new Date("2026-09-13T12:00:00Z"),
        creadoEn: new Date("2026-09-10T12:00:00Z"),
        actualizadoEn: new Date("2026-09-10T12:00:00Z"),
        profesional: {
            id: "pro-1",
            nombreVisible: "Dra. Test",
            tituloProfesional: "Psicóloga",
            estado: "ACTIVO",
            ciudad: { id: "ciudad-1", nombre: "Bogotá" },
            usuario: { email: "pro@test.local", telefono: "+573000000000" },
        },
        franja: { inicio: new Date("2026-09-11T15:00:00Z"), fin: new Date("2026-09-11T16:00:00Z"), modalidad: "VIRTUAL" },
    };

    it("CONFIRMADA: adjunta el contacto REAL del profesional (padre→profesional reabierto)", () => {
        const dto = toCitaParaPadre({ ...solicitudBase, estado: "CONFIRMADA", pagoAprobadoEn: AHORA } as never, AHORA);
        expect(dto.contactoProfesional?.email).toBe("pro@test.local");
    });

    it("VENCIDA_SIN_RESPUESTA + 48h: NO adjunta (no consumió la cita; el reembolso va por la PQR)", () => {
        const dto = toCitaParaPadre({ ...solicitudBase, estado: "VENCIDA_SIN_RESPUESTA", pagoAprobadoEn: HACE_49H } as never, AHORA);
        expect(dto.contactoProfesional).toBeUndefined();
    });

    it("perfil VENCIDO: NO adjunta aunque esté CONFIRMADA (override legal)", () => {
        const dto = toCitaParaPadre({ ...solicitudBase, estado: "CONFIRMADA", pagoAprobadoEn: AHORA, profesional: { ...solicitudBase.profesional, estado: "VENCIDO" } } as never, AHORA);
        expect(dto.contactoProfesional).toBeUndefined();
    });
});
