/**
 * SPEC-395 (L4) · candado del contacto profesional — ESCRITO EN EL CÓDIGO
 * y AFIRMADO EN EL TEST. Los tres estados clave, más las excepciones.
 */
import { describe, it, expect } from "vitest";
import { debeExponerContacto, toCitaParaPadre } from "./dto";

const AHORA = new Date("2026-09-10T12:00:00Z");
const HACE_49H = new Date("2026-09-08T11:00:00Z");
const HACE_47H = new Date("2026-09-08T13:00:00Z");

describe("debeExponerContacto · candado del contacto profesional", () => {
    // SPEC-449: el estado del PERFIL pasó a ser REQUERIDO. Los casos de abajo
    // eran los de un profesional vigente, así que ahora lo dicen: "ACTIVO".
    // No es un ajuste cosmético — hacerlo obligatorio es lo que impide que el
    // próximo llamador se olvide y vuelva a exponer el teléfono de un vencido.
    it("SIN_CONFIRMAR → false (el padre aún no pagó)", () => {
        expect(debeExponerContacto({ estado: "SIN_CONFIRMAR", pagoAprobadoEn: null }, AHORA, "ACTIVO")).toBe(false);
    });

    it("PAGADA_PENDIENTE → false (el reloj arrancó pero el profesional aún no confirma)", () => {
        expect(debeExponerContacto({ estado: "PAGADA_PENDIENTE", pagoAprobadoEn: AHORA }, AHORA, "ACTIVO")).toBe(false);
    });

    it("CONFIRMADA → true (la cita arrancó su vida, el padre coordina)", () => {
        expect(debeExponerContacto({ estado: "CONFIRMADA", pagoAprobadoEn: AHORA }, AHORA, "ACTIVO")).toBe(true);
    });

    it("VENCIDA_SIN_RESPUESTA con menos de 48h desde el pago → false", () => {
        expect(
            debeExponerContacto({ estado: "VENCIDA_SIN_RESPUESTA", pagoAprobadoEn: HACE_47H }, AHORA, "ACTIVO")
        ).toBe(false);
    });

    it("VENCIDA_SIN_RESPUESTA con >=48h desde el pago → true (excepción del brief §3)", () => {
        expect(
            debeExponerContacto({ estado: "VENCIDA_SIN_RESPUESTA", pagoAprobadoEn: HACE_49H }, AHORA, "ACTIVO")
        ).toBe(true);
    });

    it("VENCIDA_SIN_RESPUESTA sin pagoAprobadoEn (venció el pago) → false", () => {
        expect(
            debeExponerContacto({ estado: "VENCIDA_SIN_RESPUESTA", pagoAprobadoEn: null }, AHORA, "ACTIVO")
        ).toBe(false);
    });

    it("REEMBOLSADA / CUMPLIDA / etc. → false por default", () => {
        for (const estado of ["REEMBOLSADA", "CUMPLIDA", "NO_ASISTIO_PADRE", "REPROGRAMADA"] as const) {
            expect(
                debeExponerContacto({ estado, pagoAprobadoEn: AHORA }, AHORA, "ACTIVO"),
                `estado ${estado} debería NO exponer contacto`
            ).toBe(false);
        }
    });
});

// El DTO SOLO adjunta el contacto cuando el candado lo permite. El test
// garantiza que la excepción del brief §3 llega al JSON.
describe("toCitaParaPadre · el contacto viaja SÓLO en la excepción", () => {
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
            ciudad: { id: "ciudad-1", nombre: "Bogotá" },
            usuario: { email: "pro@test.local", telefono: "+573000000000" },
        },
        franja: { inicio: new Date("2026-09-11T15:00:00Z"), fin: new Date("2026-09-11T16:00:00Z"), modalidad: "VIRTUAL" },
    };

    it("SIN_CONFIRMAR: no adjunta contactoProfesional", () => {
        const dto = toCitaParaPadre(
            { ...solicitudBase, estado: "SIN_CONFIRMAR", pagoAprobadoEn: null } as never,
            AHORA
        );
        expect(dto.contactoProfesional).toBeUndefined();
    });

    it("CONFIRMADA: adjunta contactoProfesional (email + teléfono)", () => {
        const dto = toCitaParaPadre(
            { ...solicitudBase, estado: "CONFIRMADA", pagoAprobadoEn: AHORA } as never,
            AHORA
        );
        expect(dto.contactoProfesional).toEqual({
            email: "pro@test.local",
            telefono: "+573000000000",
        });
    });

    it("VENCIDA_SIN_RESPUESTA + 48h pasadas: adjunta contactoProfesional (excepción brief §3)", () => {
        const dto = toCitaParaPadre(
            { ...solicitudBase, estado: "VENCIDA_SIN_RESPUESTA", pagoAprobadoEn: HACE_49H } as never,
            AHORA
        );
        expect(dto.contactoProfesional).toBeDefined();
        expect(dto.contactoProfesional?.email).toBe("pro@test.local");
    });

    /**
     * SPEC-449 (I-313) · el perfil VENCIDO manda sobre cualquier excepción.
     *
     * PI no puede seguir sirviendo el teléfono de alguien de quien **ya escribió
     * en su propia auditoría** que la verificación venció. Esa contradicción
     * —saberlo y seguir entregándolo— es lo que no se defiende ante un tercero.
     */
    it("SPEC-449 · perfil VENCIDO → false AUNQUE la cita esté CONFIRMADA", () => {
        expect(
            debeExponerContacto({ estado: "CONFIRMADA", pagoAprobadoEn: AHORA }, AHORA, "VENCIDO"),
        ).toBe(false);
    });

    it("SPEC-449 · perfil VENCIDO → false aunque se cumpla la excepción de las 48h", () => {
        expect(
            debeExponerContacto({ estado: "VENCIDA_SIN_RESPUESTA", pagoAprobadoEn: HACE_49H }, AHORA, "VENCIDO"),
        ).toBe(false);
    });

    it("CONTRAPRUEBA · con el perfil ACTIVO las dos excepciones siguen abriendo el contacto", () => {
        expect(debeExponerContacto({ estado: "CONFIRMADA", pagoAprobadoEn: AHORA }, AHORA, "ACTIVO")).toBe(true);
        expect(
            debeExponerContacto({ estado: "VENCIDA_SIN_RESPUESTA", pagoAprobadoEn: HACE_49H }, AHORA, "ACTIVO"),
        ).toBe(true);
    });

    /**
     * HUECO CONOCIDO, documentado en vez de tapado.
     *
     * SPEC-449 cierra el contacto para `VENCIDO`, que es lo aprobado. Un perfil
     * `SUSPENDIDO` —decisión humana de IDC, más grave que un plazo cumplido—
     * **hoy SIGUE exponiendo el contacto** si la cita está confirmada.
     *
     * Este test afirma la conducta REAL, no la deseable, y deja el hueco
     * nombrado: escribí primero el assert contrario y descubrí que estaba
     * afirmando algo que no había implementado. Ensanchar reserva legal por mi
     * cuenta no corresponde — queda reportado al CEO para que lo decida.
     */
    it("HUECO · SUSPENDIDO todavía expone contacto (conducta real, reportada al CEO)", () => {
        expect(
            debeExponerContacto({ estado: "CONFIRMADA", pagoAprobadoEn: AHORA }, AHORA, "SUSPENDIDO"),
        ).toBe(true);
    });
});
