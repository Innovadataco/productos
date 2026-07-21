import { describe, it, expect } from "vitest";
import { validarFilasCarga } from "./validator";
import type { FilaCargaAlumno } from "./parser";

function filaBase(override: {
    fila?: number;
    nombre?: string;
    grado?: string | null;
    anioLectivo?: string | null;
    nombreAlumno?: string;
    tipo?: string;
    valor?: string;
    etiquetaRelacion?: string;
    plataformaId?: string | null;
} = {}): FilaCargaAlumno {
    return {
        fila: override.fila ?? 2,
        curso: {
            nombre: override.nombre ?? "6A",
            grado: override.grado ?? "Sexto",
            anioLectivo: override.anioLectivo ?? "2026",
        },
        alumno: {
            nombre: override.nombreAlumno ?? "María Gómez",
        },
        identificador: {
            tipo: override.tipo ?? "telefono",
            valor: override.valor ?? "+573001234567",
            etiquetaRelacion: (override.etiquetaRelacion ?? "ALUMNO") as FilaCargaAlumno["identificador"]["etiquetaRelacion"],
            plataformaId: override.plataformaId ?? null,
        },
    };
}

describe("validarFilasCarga", () => {
    it("valida filas correctas", () => {
        const plataformas = new Map([["whatsapp", "pl-id-1"], ["whatsapp ".trim(), "pl-id-1"]]);
        const resultado = validarFilasCarga([filaBase({ plataformaId: "whatsapp" })], plataformas);
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filasValidas).toHaveLength(1);
        expect(resultado.filasValidas[0].identificador.plataformaId).toBe("pl-id-1");
        expect(resultado.resumen.cursos).toBe(1);
        expect(resultado.resumen.alumnos).toBe(1);
        expect(resultado.resumen.identificadores).toBe(1);
    });

    it("detecta curso inválido", () => {
        const resultado = validarFilasCarga([filaBase({ nombre: "A" })], new Map());
        expect(resultado.filasValidas).toHaveLength(0);
        expect(resultado.errores.some((e) => e.campos.includes("nombre_curso"))).toBe(true);
    });

    it("detecta alumno inválido", () => {
        const resultado = validarFilasCarga([filaBase({ nombreAlumno: "A" })], new Map());
        expect(resultado.filasValidas).toHaveLength(0);
        expect(resultado.errores.some((e) => e.campos.includes("nombre_alumno"))).toBe(true);
    });

    it("detecta identificador vacío", () => {
        const resultado = validarFilasCarga([filaBase({ tipo: "", valor: "" })], new Map());
        expect(resultado.filasValidas).toHaveLength(0);
        expect(resultado.errores.some((e) => e.campos.includes("tipo_identificador"))).toBe(true);
        expect(resultado.errores.some((e) => e.campos.includes("valor_identificador"))).toBe(true);
    });

    it("detecta etiqueta de relación inválida", () => {
        const resultado = validarFilasCarga([filaBase({ etiquetaRelacion: "ABUELO" as never })], new Map());
        expect(resultado.filasValidas).toHaveLength(0);
        expect(resultado.errores.some((e) => e.campos.includes("etiqueta_relacion"))).toBe(true);
    });

    it("detecta plataforma inexistente", () => {
        const resultado = validarFilasCarga([filaBase({ plataformaId: "Inexistente" })], new Map());
        expect(resultado.filasValidas).toHaveLength(0);
        expect(resultado.errores.some((e) => e.campos.includes("plataforma"))).toBe(true);
    });

    it("detecta duplicado interno de identificador", () => {
        const filas = [filaBase({ fila: 2 }), filaBase({ fila: 3 })];
        const resultado = validarFilasCarga(filas, new Map());
        expect(resultado.filasValidas).toHaveLength(1);
        expect(resultado.errores).toHaveLength(1);
        expect(resultado.errores[0].mensaje).toContain("duplicado");
    });

    it("permite un alumno con múltiples identificadores", () => {
        const filas = [
            filaBase({ fila: 2, tipo: "telefono", valor: "+573001234567" }),
            filaBase({ fila: 3, tipo: "email", valor: "maria@example.com" }),
        ];
        const resultado = validarFilasCarga(filas, new Map());
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filasValidas).toHaveLength(2);
        expect(resultado.resumen.alumnos).toBe(1);
        expect(resultado.resumen.identificadores).toBe(2);
    });

    it("normaliza el valor del identificador", () => {
        const resultado = validarFilasCarga([filaBase({ valor: "  Maria@Example.COM  ", tipo: "email" })], new Map());
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filasValidas[0].identificador.valor).toBe("maria@example.com");
    });
});
