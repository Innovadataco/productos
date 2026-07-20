import { describe, it, expect } from "vitest";
import { parsearCSV, parsearJSON, parsearArchivoSimulacion, normalizarCategoriaEsperada } from "./parser";

describe("parser.ts", () => {
    it("parsea CSV válido", () => {
        const csv = `texto,plataforma,identificador,categoriaEsperada
"Este es un texto de prueba con más de 20 caracteres",instagram,usuario123,ACOSO
"Otro texto suficientemente largo para pasar",tiktok,usuario456,OTRO`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(true);
        expect(result.casos).toHaveLength(2);
        expect(result.casos?.[0].caso.texto).toContain("texto de prueba");
    });

    it("rechaza CSV con texto corto", () => {
        const csv = `texto,plataforma,identificador
"corto",instagram,usr`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.errores).toHaveLength(1);
    });

    it("rechaza CSV sin cabecera requerida", () => {
        const csv = `foo,bar
"texto",instagram,usuario123`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
    });

    it("parsea JSON válido", () => {
        const json = JSON.stringify([
            { texto: "Texto de prueba con longitud suficiente para ser válido", plataforma: "instagram", identificador: "u123", categoriaEsperada: "ACOSO" },
        ]);
        const result = parsearJSON(json);
        expect(result.ok).toBe(true);
        expect(result.casos).toHaveLength(1);
    });

    it("rechaza JSON que no es array", () => {
        const result = parsearJSON(JSON.stringify({ texto: "x" }));
        expect(result.ok).toBe(false);
    });

    it("normaliza categoría esperada", () => {
        expect(normalizarCategoriaEsperada("ciber bullying")).toBe("CIBER_BULLYING");
        expect(normalizarCategoriaEsperada("  ")).toBeUndefined();
    });

    it("parseaArchivoSimulacion delega según formato", () => {
        const csv = `texto,plataforma,identificador
"Texto de prueba con longitud suficiente para ser válido",instagram,usuario123`;
        const json = JSON.stringify([{ texto: "Texto de prueba con longitud suficiente para ser válido", plataforma: "instagram", identificador: "usuario123" }]);
        expect(parsearArchivoSimulacion(csv, "csv").ok).toBe(true);
        expect(parsearArchivoSimulacion(json, "json").ok).toBe(true);
    });
});
