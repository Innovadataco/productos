/**
 * SPEC-234 (002-PI-134): tests de la regla N1 de progresión.
 */
import { describe, it, expect } from "vitest";
import { crearEvento } from "../test-fixtures";
import { detectarProgresion } from "./progresion";

function eventosConCategorias(categorias: string[]) {
    const base = new Date("2026-08-01T00:00:00Z").getTime();
    return categorias.map((categoria, i) =>
        crearEvento({
            ordenSecuencial: i + 1,
            categoriaDetectada: categoria,
            fechaEvento: new Date(base + i * 86400000),
        })
    );
}

const SEVERIDADES = {
    CONTACTO_INSISTENTE: 30,
    OFRECIMIENTO_REGALOS: 60,
    SOLICITUD_ENCUENTRO: 90,
};

describe("detectarProgresion", () => {
    it("dispara cuando la severidad aumenta significativamente", () => {
        const eventos = eventosConCategorias([
            "CONTACTO_INSISTENTE",
            "OFRECIMIENTO_REGALOS",
            "SOLICITUD_ENCUENTRO",
        ]);
        const resultado = detectarProgresion(eventos, SEVERIDADES);

        expect(resultado.detectado).toBe(true);
        expect(resultado.severidad).toBe("ALTA");
        expect(resultado.datosContextoJson.tipoPatron).toBe("PROGRESION");
        expect(resultado.datosContextoJson.mayorIncremento).toBeGreaterThanOrEqual(30);
    });

    it("no dispara cuando las categorías no escalan", () => {
        const eventos = eventosConCategorias([
            "CONTACTO_INSISTENTE",
            "CONTACTO_INSISTENTE",
            "CONTACTO_INSISTENTE",
        ]);
        const resultado = detectarProgresion(eventos, SEVERIDADES);

        expect(resultado.detectado).toBe(false);
        expect(resultado.severidad).toBe("BAJA");
    });
});
