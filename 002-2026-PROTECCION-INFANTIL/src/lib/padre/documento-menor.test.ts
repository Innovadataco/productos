/**
 * SPEC-361 (A-70 · F7 · F8) — reglas del documento y la edad del menor.
 */
import { describe, it, expect } from "vitest";
import {
    validarDocumentoMenor,
    validarEdadMenor,
    validarAnioNacimientoMenor,
    anioDesdeEdad,
    edadDesdeAnio,
    edadesMenor,
    edadesReporte,
} from "./documento-menor";

describe("validarDocumentoMenor (F7)", () => {
    it("rechaza el caso exacto del recorrido de Jelkin: letras en una TI", () => {
        const error = validarDocumentoMenor("TI", "84opkioniby");
        expect(error).toBe("El número de tarjeta de identidad debe tener solo números, sin letras ni espacios.");
    });

    it("acepta documentos colombianos numéricos y rechaza espacios o símbolos", () => {
        expect(validarDocumentoMenor("TI", "1094567890")).toBeNull();
        expect(validarDocumentoMenor("RC", "1030512345")).toBeNull();
        expect(validarDocumentoMenor("CC", "51355355")).toBeNull();
        expect(validarDocumentoMenor("CC", "51 355 355")).toContain("solo números");
        expect(validarDocumentoMenor("CC", "5135-5355")).toContain("solo números");
    });

    it("pasaporte y OTRO admiten alfanumérico con guiones", () => {
        expect(validarDocumentoMenor("PASAPORTE", "AV123456")).toBeNull();
        expect(validarDocumentoMenor("OTRO", "ABC-123")).toBeNull();
        expect(validarDocumentoMenor("PASAPORTE", "AV 123 456")).toContain("letras, números y guiones");
    });

    it("nombra el campo y el tipo en cada mensaje; nunca deja pasar el vacío", () => {
        expect(validarDocumentoMenor("TI", "   ")).toBe("Escribe el número de documento del menor.");
        expect(validarDocumentoMenor("CC", "123")).toContain("cédula de ciudadanía");
        expect(validarDocumentoMenor("CC", "1234567890123456")).toContain("muy largo");
    });
});

describe("edad del menor (F8) — el año se deriva, no se escribe", () => {
    it("el año sale de la edad contra el año en curso (no envejece con el código)", () => {
        expect(anioDesdeEdad(17, 2026)).toBe(2009);
        expect(anioDesdeEdad(5, 2026)).toBe(2021);
        // La misma edad, cuatro años después, da otro año: el rango se mueve solo.
        expect(anioDesdeEdad(17, 2030)).toBe(2013);
    });

    it("edadDesdeAnio es el camino de vuelta para repintar el formulario", () => {
        expect(edadDesdeAnio(2009, 2026)).toBe(17);
        expect(edadDesdeAnio(anioDesdeEdad(12, 2026), 2026)).toBe(12);
    });

    it("valida el rango 5-17 y deja pasar el vacío (la edad es opcional)", () => {
        expect(validarEdadMenor(5)).toBeNull();
        expect(validarEdadMenor(17)).toBeNull();
        expect(validarEdadMenor(null)).toBeNull();
        expect(validarEdadMenor(undefined)).toBeNull();
        expect(validarEdadMenor(4)).toContain("entre 5 y 17");
        expect(validarEdadMenor(18)).toContain("entre 5 y 17");
        expect(validarEdadMenor(12.5)).toContain("entre 5 y 17");
    });

    it("SPEC-372 (A-74 P4 · I-262) — el año se valida en el servidor contra la ventana 5-17 del año en curso", () => {
        // En 2026: rango 2009-2021.
        expect(validarAnioNacimientoMenor(2009, 2026)).toBeNull();
        expect(validarAnioNacimientoMenor(2021, 2026)).toBeNull();
        expect(validarAnioNacimientoMenor(2008, 2026)).toContain("entre 5 y 17");
        expect(validarAnioNacimientoMenor(2022, 2026)).toContain("entre 5 y 17");
        // El schema deja pasar 1900-2100; acá se corta.
        expect(validarAnioNacimientoMenor(1900, 2026)).toContain("entre 5 y 17");
        expect(validarAnioNacimientoMenor(2100, 2026)).toContain("entre 5 y 17");
        // Opcional: null y undefined pasan sin ruido.
        expect(validarAnioNacimientoMenor(null, 2026)).toBeNull();
        expect(validarAnioNacimientoMenor(undefined, 2026)).toBeNull();
        // No entero.
        expect(validarAnioNacimientoMenor(2015.5, 2026)).toContain("entero");
        // El rango SE MUEVE con el año: en 2030 la ventana es 2013-2025 y
        // 2009 (que era válido en 2026) ya no lo es.
        expect(validarAnioNacimientoMenor(2013, 2030)).toBeNull();
        expect(validarAnioNacimientoMenor(2025, 2030)).toBeNull();
        expect(validarAnioNacimientoMenor(2009, 2030)).toContain("entre 5 y 17");
    });

    it("las listas ofrecidas son 5-17 en el camino y 4-17 al reportar (F9)", () => {
        expect(edadesMenor()).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
        expect(edadesReporte()[0]).toBe(4);
        expect(edadesReporte().at(-1)).toBe(17);
        expect(edadesReporte()).toHaveLength(14);
    });
});
