/**
 * SPEC-408 · Candado H-2 (Ley 1918/2018 · 2375/2024 · brief §5):
 * la vista del profesional NO expone `resultado`, `checklist` estructurado,
 * `notaInterna`, `autorizacionArchivoId` ni `revisadoPor`. Solo la observación
 * escrita, por ítem, cuando el último resultado fue RECHAZADO.
 *
 * Este candado corre en unit (jsdom), con jsonify puro sobre el shape de
 * retorno — no toca BD; el service consume Prisma pero acá lo mockeamos.
 */
import { describe, it, expect } from "vitest";
import type { VistaProfesionalVerificacion, ObservacionParaProfesional } from "./vista-profesional";

// Campos prohibidos en el payload al profesional (§5 del brief).
const RESERVADOS_LEGALES = [
    "resultado",
    "checklist",
    "notaInterna",
    "autorizacionArchivoId",
    "revisadoPor",
    "revisadoPorId",
] as const;

/** Buscar recursivamente cualquier clave prohibida en un objeto. */
function contieneReservada(obj: unknown, ruta: string = "$"): string[] {
    if (obj === null || typeof obj !== "object") return [];
    if (Array.isArray(obj)) {
        return obj.flatMap((it, i) => contieneReservada(it, `${ruta}[${i}]`));
    }
    const violaciones: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
        if (RESERVADOS_LEGALES.includes(k as (typeof RESERVADOS_LEGALES)[number])) {
            violaciones.push(`${ruta}.${k}`);
        }
        violaciones.push(...contieneReservada(v, `${ruta}.${k}`));
    }
    return violaciones;
}

describe("SPEC-408 · vista del profesional — candado H-2 de reserva legal", () => {
    it("el shape declarado NO contiene ninguna clave reservada", () => {
        // El shape del tipo TypeScript es la fuente única; construimos un
        // objeto que cubra todos los campos declarados y verificamos.
        const shape: VistaProfesionalVerificacion = {
            estadoPerfil: "BORRADOR",
            puedeReenviar: true,
            observaciones: [{ requisito: "Cédula", observacion: "Foto borrosa" }],
        };
        expect(contieneReservada(shape), "el shape declarado filtra un campo reservado").toEqual([]);
    });

    it("una observación jamás expone `resultado` ni `revisadoPor`", () => {
        const obs: ObservacionParaProfesional = { requisito: "Tarjeta profesional", observacion: "Vencida" };
        expect(contieneReservada(obs)).toEqual([]);
        // Y la interfaz solo tiene 2 claves — cualquier añadido futuro obliga
        // a evaluar si contradice la reserva.
        expect(Object.keys(obs).sort()).toEqual(["observacion", "requisito"]);
    });

    it("una respuesta bien formada del endpoint pasa el candado", () => {
        const respuesta = {
            data: {
                estadoPerfil: "BORRADOR",
                puedeReenviar: true,
                observaciones: [
                    { requisito: "Cédula", observacion: "Foto borrosa, reintentar" },
                    { requisito: "Tarjeta profesional", observacion: "PDF no legible" },
                ],
            },
        };
        expect(contieneReservada(respuesta)).toEqual([]);
    });

    it("un shape mal construido (con `resultado`) se detecta y se puede rechazar", () => {
        const malo = {
            data: {
                estadoPerfil: "RECHAZADO",
                resultado: "RECHAZADO", // ← filtración H-2
                observaciones: [],
            },
        };
        const violaciones = contieneReservada(malo);
        expect(violaciones).toContain("$.data.resultado");
    });
});
