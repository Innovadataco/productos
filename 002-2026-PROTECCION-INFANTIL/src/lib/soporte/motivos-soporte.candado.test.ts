/**
 * SPEC-752 · CANDADO del copy de la puerta de PQR (fuente única, paridad con el enum).
 *
 * Todo valor del enum MotivoPeticionServicio tiene copy y NINGUNA clave sobra (si mañana
 * se agrega un motivo al enum sin su copy, ROJO). Motivo 1 (habeas data, Ley 1581) va
 * primero. La confirmación dice el QUÉ («te responde por aquí») y NUNCA el CUÁNDO (ningún
 * plazo/fecha). Puro, sin BD, sin DOM.
 */
import { describe, it, expect } from "vitest";
import { MotivoPeticionServicio } from "@prisma/client";
import {
    MOTIVOS_SOPORTE,
    COPY_PUERTA_SOPORTE,
    confirmacionSoporte,
    tituloDeMotivo,
} from "@/lib/soporte/motivos-soporte";

const SIN_PLAZO = /d[ií]as|plazo|24\s*h|h[áa]biles|\bfecha\b|\bsemana/i;

describe("SPEC-752 · motivos de soporte (copy CERRADO, fuente única)", () => {
    it("paridad con el enum: todo motivo mapeado, ninguna clave sobra, sin duplicados", () => {
        const valoresEnum = new Set<string>(Object.values(MotivoPeticionServicio));
        const valoresCopy = MOTIVOS_SOPORTE.map((m) => m.valor);
        for (const v of valoresEnum) {
            expect(valoresCopy, `motivo ${v} sin copy`).toContain(v);
        }
        for (const v of valoresCopy) {
            expect(valoresEnum.has(v), `copy de ${v} no es un motivo del enum`).toBe(true);
        }
        expect(new Set(valoresCopy).size, "hay motivos duplicados").toBe(valoresCopy.length);
        expect(valoresCopy.length).toBe(valoresEnum.size);
    });

    it("motivo 1 = habeas data (DATOS_PERSONALES) va PRIMERO", () => {
        expect(MOTIVOS_SOPORTE[0].valor).toBe("DATOS_PERSONALES");
    });

    it("cada motivo tiene un título no vacío (lo que ve el padre)", () => {
        for (const m of MOTIVOS_SOPORTE) {
            expect(m.titulo.trim().length, `motivo ${m.valor} sin título`).toBeGreaterThan(0);
        }
    });

    it("la confirmación dice el QUÉ (te responde por aquí) y NINGÚN plazo", () => {
        const texto = confirmacionSoporte(tituloDeMotivo("PAGO_O_COBRO"));
        expect(texto).toContain("te responde por aquí");
        expect(texto).toContain(tituloDeMotivo("PAGO_O_COBRO"));
        expect(SIN_PLAZO.test(texto), `la confirmación menciona un plazo: "${texto}"`).toBe(false);
    });

    it("el encabezado tampoco promete plazo", () => {
        for (const s of [COPY_PUERTA_SOPORTE.titulo, COPY_PUERTA_SOPORTE.subtitulo, COPY_PUERTA_SOPORTE.enviar]) {
            expect(SIN_PLAZO.test(s), `el copy "${s}" menciona un plazo`).toBe(false);
        }
    });
});
