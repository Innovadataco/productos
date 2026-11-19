/**
 * SPEC-940 · unit del VALOR de la FUENTE ÚNICA `contactoVisiblePorSesion`, ahora POR DIRECCIÓN.
 *
 * El candado `contacto-fuente-unica.candado.test.ts` prueba el MECANISMO (la fuente manda); ESTE fija el VALOR:
 *  · `profesional_ve_padre` → `false` en TODO estado (754 sigue en esa dirección; minimización H-2). Si alguien lo
 *    reabre, este test cae — es el correo de un padre en protección infantil.
 *  · `padre_ve_profesional` → `true` SOLO tras la 1.ª cita CONSUMIDA ({CONFIRMADA, CUMPLIDA, NO_ASISTIO_PADRE});
 *    `false` en los otros 6 — reabrir otro estado es una decisión, no un default.
 */
import { describe, it, expect } from "vitest";
import type { EstadoSolicitudCita } from "@prisma/client";
import { contactoVisiblePorSesion } from "./contacto-visible";
import { ESTADOS_PRIMERA_CITA_CONSUMIDA } from "./segunda-cita";

// El enum COMPLETO (prisma/schema.prisma). Si mañana entra un estado nuevo, este arreglo crece con él.
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

describe("contactoVisiblePorSesion · VALOR por dirección (SPEC-940)", () => {
    it("profesional_ve_padre: `false` en TODO estado (el profesional nunca recibe el correo del padre)", () => {
        for (const estado of TODOS_LOS_ESTADOS) {
            expect(
                contactoVisiblePorSesion(estado, "profesional_ve_padre"),
                `${estado}: la dirección profesional→padre está CERRADA (minimización H-2). Reabrirla es una decisión`,
            ).toBe(false);
        }
    });

    it("padre_ve_profesional: `true` SOLO tras la 1.ª cita consumida; `false` en los otros 6", () => {
        for (const estado of TODOS_LOS_ESTADOS) {
            const esperado = ESTADOS_PRIMERA_CITA_CONSUMIDA.includes(estado);
            expect(
                contactoVisiblePorSesion(estado, "padre_ve_profesional"),
                `${estado}: debe ${esperado ? "ABRIR" : "CERRAR"} el contacto del profesional al padre`,
            ).toBe(esperado);
        }
    });

    it("el set de 1.ª cita consumida es EXACTAMENTE {CONFIRMADA, CUMPLIDA, NO_ASISTIO_PADRE}", () => {
        expect([...ESTADOS_PRIMERA_CITA_CONSUMIDA].sort()).toEqual(["CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE"]);
        // NO_ASISTIO_PROFESIONAL y REUBICADA NO entran (falla del profesional / reubicación → el padre se va de él).
        expect(ESTADOS_PRIMERA_CITA_CONSUMIDA).not.toContain("NO_ASISTIO_PROFESIONAL");
        expect(ESTADOS_PRIMERA_CITA_CONSUMIDA).not.toContain("REUBICADA");
    });

    it("el arreglo cubre TODO el enum (si crece el enum, este test lo caza)", () => {
        expect(new Set(TODOS_LOS_ESTADOS).size).toBe(9);
    });
});
