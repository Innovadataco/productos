/**
 * SPEC-234 (002-PI-134): tests de la regla N1 de multiplataforma.
 */
import { describe, it, expect } from "vitest";
import { crearEvento } from "../test-fixtures";
import { detectarMultiplataforma } from "./multiplataforma";

function eventosConPlataformas(plataformas: (string | null)[]) {
    return plataformas.map((plataforma, i) =>
        crearEvento({
            ordenSecuencial: i + 1,
            plataforma,
            fechaEvento: new Date(`2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
        })
    );
}

describe("detectarMultiplataforma", () => {
    it("dispara cuando hay suficientes plataformas distintas", () => {
        const eventos = eventosConPlataformas(["whatsapp", "instagram", "tiktok"]);
        const resultado = detectarMultiplataforma(eventos, 2);

        expect(resultado.detectado).toBe(true);
        expect(resultado.severidad).toBe("MEDIA");
        expect(resultado.datosContextoJson.tipoPatron).toBe("MULTIPLATAFORMA");
        expect(resultado.datosContextoJson.plataformasUnicas).toBe(3);
    });

    it("no dispara con una sola plataforma", () => {
        const eventos = eventosConPlataformas(["whatsapp", "whatsapp"]);
        const resultado = detectarMultiplataforma(eventos, 2);

        expect(resultado.detectado).toBe(false);
        expect(resultado.severidad).toBe("BAJA");
    });
});
