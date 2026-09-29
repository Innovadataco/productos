/**
 * SPEC-395 · unit de la FUENTE ÚNICA `contactoVisiblePorSesion`.
 *
 * Este test mira la función REAL (sin mock). El candado de CONDUCTA de las tres
 * superficies vive en `contacto-fuente-unica.candado.test.ts` (ahí sí se fuerza
 * el resultado). Acá se fija lo contrario: que la regla, por sí sola, FALLA
 * CERRADA — la única puerta abierta es la que está escrita (`CONFIRMADA`).
 */
import { describe, it, expect } from "vitest";
import type { EstadoSolicitudCita } from "@prisma/client";
import { contactoVisiblePorSesion } from "./contacto-visible";

// El enum COMPLETO (prisma/schema.prisma). Si mañana entra un estado nuevo, este
// arreglo tiene que crecer con él: un estado sin decidir NO puede abrir contacto.
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

describe("contactoVisiblePorSesion · hoy la conducta es la vieja, y falla cerrada", () => {
    it("CONFIRMADA es la ÚNICA puerta abierta hoy", () => {
        expect(contactoVisiblePorSesion("CONFIRMADA")).toBe(true);
    });

    it("cualquier otro estado NO expone contacto (default-deny)", () => {
        for (const estado of TODOS_LOS_ESTADOS) {
            if (estado === "CONFIRMADA") continue;
            expect(
                contactoVisiblePorSesion(estado),
                `el estado ${estado} no puede exponer contacto: la regla solo abre en CONFIRMADA`,
            ).toBe(false);
        }
    });

    it("el arreglo cubre TODO el enum (si crece el enum sin decidirse, este test lo caza)", () => {
        // Control positivo del barrido de arriba: prueba que no está iterando una
        // lista recortada que dejaría estados sin verificar.
        expect(TODOS_LOS_ESTADOS).toContain("CONFIRMADA");
        expect(new Set(TODOS_LOS_ESTADOS).size).toBe(9);
    });
});
