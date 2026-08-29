/**
 * SPEC-234 (002-PI-134): tests del cálculo de score.
 */
import { describe, it, expect } from "vitest";
import { calcularScore } from "./calcular-score";

const BASE = {
    pesoNumReportes: 2,
    pesoCategoriaGrave: 5,
    pesoAceleracion: 3,
    pesoSenalComunitaria: 4,
    umbralAmarillo: 20,
    umbralRojo: 50,
};

describe("calcularScore", () => {
    it("devuelve VERDE por debajo del umbral amarillo", () => {
        const resultado = calcularScore({
            ...BASE,
            numEventos: 2,
            eventosCategoriaGrave: 0,
            patrones: [],
            senalComunitariaScore: 0,
        });

        expect(resultado.score).toBe(4);
        expect(resultado.gravedad).toBe("VERDE");
    });

    it("devuelve AMARILLO entre umbrales", () => {
        const resultado = calcularScore({
            ...BASE,
            numEventos: 5,
            eventosCategoriaGrave: 2,
            patrones: [{ detectado: true, severidad: "MEDIA", descripcionTexto: "", datosContextoJson: {} }],
            senalComunitariaScore: 1,
        });

        expect(resultado.score).toBe(27);
        expect(resultado.gravedad).toBe("AMARILLO");
    });

    it("devuelve ROJO al superar el umbral rojo", () => {
        const resultado = calcularScore({
            ...BASE,
            numEventos: 10,
            eventosCategoriaGrave: 5,
            patrones: [{ detectado: true, severidad: "ALTA", descripcionTexto: "", datosContextoJson: {} }],
            senalComunitariaScore: 3,
        });

        expect(resultado.score).toBeGreaterThanOrEqual(50);
        expect(resultado.gravedad).toBe("ROJO");
    });
});
