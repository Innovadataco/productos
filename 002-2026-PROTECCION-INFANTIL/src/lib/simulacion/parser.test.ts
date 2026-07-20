import { describe, it, expect } from "vitest";
import { parsearCSV, parsearJSON, parsearArchivoSimulacion, normalizarCategoriaEsperada } from "./parser";

describe("parser.ts", () => {
    const csvCabecera = "texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada";
    const textoValido = "Este es un texto de prueba con más de veinte caracteres";

    it("parsea CSV válido con todos los campos reales", () => {
        const csv = `${csvCabecera}
"${textoValido}",instagram,usuario123,2026-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO
"Otro texto suficientemente largo para pasar",tiktok,usuario456,2026-02-20T15:30:00Z,Medellín,Colombia,12,CIBERBULLYING`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(true);
        expect(result.casos).toHaveLength(2);
        expect(result.casos?.[0].caso.texto).toContain("texto de prueba");
        expect(result.casos?.[0].caso.fechaIncidente).toBe("2026-01-15T10:00:00Z");
        expect(result.casos?.[0].caso.ciudad).toBe("Bogotá");
        expect(result.casos?.[0].caso.pais).toBe("Colombia");
        expect(result.casos?.[0].caso.edadVictima).toBe(14);
        expect(result.casos?.[0].caso.categoriaEsperada).toBe("ACOSO");
    });

    it("parsea CSV sin edadVictima ni categoriaEsperada", () => {
        const csv = `texto,plataforma,identificador,fechaIncidente,ciudad,pais
"${textoValido}",instagram,usuario123,2026-01-15T10:00:00Z,Bogotá,Colombia`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(true);
        expect(result.casos).toHaveLength(1);
        expect(result.casos?.[0].caso.edadVictima).toBeUndefined();
        expect(result.casos?.[0].caso.categoriaEsperada).toBeUndefined();
    });

    it("rechaza CSV legacy (faltan fechaIncidente, ciudad, pais)", () => {
        const csv = `texto,plataforma,identificador
"${textoValido}",instagram,usuario123`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.mensaje).toContain("fechaIncidente");
        expect(result.mensaje).toContain("ciudad");
        expect(result.mensaje).toContain("pais");
    });

    it("rechaza CSV con texto corto", () => {
        const csv = `${csvCabecera}
"corto",instagram,usuario123,2026-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.errores).toHaveLength(1);
        expect(result.errores?.[0].campo).toBe("texto");
    });

    it("rechaza CSV con fecha futura", () => {
        const csv = `${csvCabecera}
"${textoValido}",instagram,usuario123,2099-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.errores?.[0].campo).toBe("fechaIncidente");
        expect(result.errores?.[0].mensaje).toContain("futura");
    });

    it("rechaza CSV con ciudad vacía", () => {
        const csv = `${csvCabecera}
"${textoValido}",instagram,usuario123,2026-01-15T10:00:00Z,,Colombia,14,ACOSO`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.errores?.[0].campo).toBe("ciudad");
    });

    it("rechaza CSV con edadVictima inválida", () => {
        const csv = `${csvCabecera}
"${textoValido}",instagram,usuario123,2026-01-15T10:00:00Z,Bogotá,Colombia,999,ACOSO`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.errores?.[0].campo).toBe("edadVictima");
    });

    it("rechaza CSV con edadVictima no numérica", () => {
        const csv = `${csvCabecera}
"${textoValido}",instagram,usuario123,2026-01-15T10:00:00Z,Bogotá,Colombia,doce,ACOSO`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.errores?.[0].campo).toBe("edadVictima");
    });

    it("reporta errores por línea", () => {
        const csv = `${csvCabecera}
"corto",instagram,usr,2026-01-15T10:00:00Z,,Colombia,doce,ACOSO`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.errores).toBeDefined();
        expect((result.errores ?? []).length).toBeGreaterThanOrEqual(1);
        expect(result.errores?.[0].indice).toBe(1);
    });

    it("rechaza CSV sin cabecera requerida", () => {
        const csv = `foo,bar
"${textoValido}",instagram,usuario123,2026-01-15T10:00:00Z,Bogotá,Colombia`;
        const result = parsearCSV(csv);
        expect(result.ok).toBe(false);
        expect(result.mensaje).toContain("texto");
    });

    it("parsea JSON válido con todos los campos reales", () => {
        const json = JSON.stringify([
            {
                texto: textoValido,
                plataforma: "instagram",
                identificador: "u123",
                fechaIncidente: "2026-01-15T10:00:00Z",
                ciudad: "Bogotá",
                pais: "Colombia",
                edadVictima: 14,
                categoriaEsperada: "ACOSO",
            },
        ]);
        const result = parsearJSON(json);
        expect(result.ok).toBe(true);
        expect(result.casos).toHaveLength(1);
        expect(result.casos?.[0].caso.fechaIncidente).toBe("2026-01-15T10:00:00Z");
        expect(result.casos?.[0].caso.ciudad).toBe("Bogotá");
        expect(result.casos?.[0].caso.pais).toBe("Colombia");
        expect(result.casos?.[0].caso.edadVictima).toBe(14);
    });

    it("rechaza JSON con fecha futura", () => {
        const json = JSON.stringify([
            {
                texto: textoValido,
                plataforma: "instagram",
                identificador: "u123",
                fechaIncidente: "2099-01-15T10:00:00Z",
                ciudad: "Bogotá",
                pais: "Colombia",
            },
        ]);
        const result = parsearJSON(json);
        expect(result.ok).toBe(false);
        expect(result.errores?.[0].campo).toBe("fechaIncidente");
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
        const csv = `${csvCabecera}
"${textoValido}",instagram,usuario123,2026-01-15T10:00:00Z,Bogotá,Colombia`;
        const json = JSON.stringify([
            {
                texto: textoValido,
                plataforma: "instagram",
                identificador: "usuario123",
                fechaIncidente: "2026-01-15T10:00:00Z",
                ciudad: "Bogotá",
                pais: "Colombia",
            },
        ]);
        expect(parsearArchivoSimulacion(csv, "csv").ok).toBe(true);
        expect(parsearArchivoSimulacion(json, "json").ok).toBe(true);
    });
});
