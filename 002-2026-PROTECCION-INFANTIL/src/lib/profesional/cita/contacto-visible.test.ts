/**
 * SPEC-754 · unit del VALOR de la FUENTE ÚNICA `contactoVisiblePorSesion`.
 *
 * El candado `contacto-fuente-unica.candado.test.ts` prueba el MECANISMO (que la fuente manda:
 * force false→ausente / true→presente). Eso NO prueba que la fuente esté CERRADA. ESTE test fija
 * el VALOR: `contactoVisiblePorSesion` es `false` en TODO estado — el contacto mutuo está cerrado.
 *
 * Por qué (para que la próxima persona no reabra la línea sin contexto): el canal de la reunión es
 * el ENLACE de la cita (SPEC-750) y el recurso de plata va por la PQR (SPEC-752, motivo 2), no por
 * el correo. Si alguien vuelve a poner `true`, este test cae — que es justo lo que el candado de
 * mecanismo NO cazaría.
 */
import { describe, it, expect } from "vitest";
import type { EstadoSolicitudCita } from "@prisma/client";
import { contactoVisiblePorSesion } from "./contacto-visible";

// El enum COMPLETO (prisma/schema.prisma). Si mañana entra un estado nuevo, este arreglo crece con
// él: ningún estado —ni siquiera CONFIRMADA— puede reabrir el contacto sin decisión.
const TODOS_LOS_ESTADOS: EstadoSolicitudCita[] = [
    "PAGADA_PENDIENTE",
    "CONFIRMADA",
    "CUMPLIDA",
    "NO_ASISTIO_PADRE",
    "NO_ASISTIO_PROFESIONAL",
    "VENCIDA_SIN_RESPUESTA",
    "REEMBOLSADA",
    "SIN_CONFIRMAR",
    "REPROGRAMADA",
];

describe("contactoVisiblePorSesion · VALOR cerrado (SPEC-754)", () => {
    it("es `false` en TODO estado, incluida CONFIRMADA (el contacto mutuo está cerrado)", () => {
        for (const estado of TODOS_LOS_ESTADOS) {
            expect(
                contactoVisiblePorSesion(estado),
                `${estado}: el contacto está cerrado (canal = enlace de la cita; recurso = PQR). Reabrirlo es una decisión, no un default`,
            ).toBe(false);
        }
    });

    it("el arreglo cubre TODO el enum (si crece el enum, este test lo caza)", () => {
        expect(TODOS_LOS_ESTADOS).toContain("CONFIRMADA");
        expect(new Set(TODOS_LOS_ESTADOS).size).toBe(9);
    });
});
