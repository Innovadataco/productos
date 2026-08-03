import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
    cuidIdSchema,
    emailSchema,
    parametroClaveSchema,
    emptyBodySchema,
    ollamaProbarBodySchema,
    sandboxBodySchema,
    operadorIdParamsSchema,
    parametroClaveParamsSchema,
    parametroPatchBodySchema,
    profesorBodySchema,
    profesorPatchSchema,
    profesoresQuerySchema,
    cursoBodySchema,
    cursoUpdateBodySchema,
} from "./index";

describe("schemas/index", () => {
    it("cuidIdSchema accepts a valid cuid", () => {
        const validCuid = "cm0k5example12345678901234567890";
        expect(() => cuidIdSchema.parse(validCuid)).not.toThrow();
    });

    it("cuidIdSchema rejects an invalid cuid", () => {
        expect(() => cuidIdSchema.parse("not-a-cuid")).toThrow();
    });

    it("emailSchema accepts a valid email", () => {
        expect(() => emailSchema.parse("test@example.com")).not.toThrow();
    });

    it("emailSchema rejects an invalid email", () => {
        expect(() => emailSchema.parse("not-an-email")).toThrow();
    });

    it("parametroClaveSchema accepts a non-empty key up to 100 chars", () => {
        expect(() => parametroClaveSchema.parse("security.max_login_attempts")).not.toThrow();
    });

    it("parametroClaveSchema rejects an empty key", () => {
        expect(() => parametroClaveSchema.parse("")).toThrow();
    });

    it("emptyBodySchema accepts an empty object", () => {
        expect(() => emptyBodySchema.parse({})).not.toThrow();
    });

    it("emptyBodySchema rejects extra fields", () => {
        expect(() => emptyBodySchema.parse({ extra: true })).toThrow();
    });

    it("ollamaProbarBodySchema requires a non-empty url string", () => {
        expect(() => ollamaProbarBodySchema.parse({ url: "http://localhost:11434" })).not.toThrow();
    });

    it("ollamaProbarBodySchema rejects a missing url", () => {
        expect(() => ollamaProbarBodySchema.parse({})).toThrow();
    });

    it("ollamaProbarBodySchema rejects a non-string url", () => {
        expect(() => ollamaProbarBodySchema.parse({ url: 123 })).toThrow();
    });

    it("sandboxBodySchema accepts a valid payload", () => {
        expect(() =>
            sandboxBodySchema.parse({ texto: "texto de prueba", comparar: true })
        ).not.toThrow();
    });

    it("sandboxBodySchema rejects an empty texto", () => {
        expect(() => sandboxBodySchema.parse({ texto: "" })).toThrow();
    });

    it("sandboxBodySchema rejects a texto longer than 4000 characters", () => {
        const longText = "a".repeat(4001);
        expect(() => sandboxBodySchema.parse({ texto: longText })).toThrow();
    });

    it("sandboxBodySchema rejects non-object parametrosOverride", () => {
        expect(() => sandboxBodySchema.parse({ texto: "ok", parametrosOverride: "bad" })).toThrow();
    });

    it("operadorIdParamsSchema accepts a valid cuid id", () => {
        expect(() => operadorIdParamsSchema.parse({ id: "cm0k5example12345678901234567890" })).not.toThrow();
    });

    it("operadorIdParamsSchema rejects an invalid id", () => {
        expect(() => operadorIdParamsSchema.parse({ id: "not-a-cuid" })).toThrow();
    });

    it("parametroClaveParamsSchema accepts a valid clave", () => {
        expect(() => parametroClaveParamsSchema.parse({ clave: "visibility.report_threshold" })).not.toThrow();
    });

    it("parametroClaveParamsSchema rejects an empty clave", () => {
        expect(() => parametroClaveParamsSchema.parse({ clave: "" })).toThrow();
    });

    it("parametroPatchBodySchema accepts a valid patch payload", () => {
        expect(() =>
            parametroPatchBodySchema.parse({
                valor: "5",
                motivo: "Ajuste de umbral",
                tipo: "INTEGER",
                categoria: "VISIBILITY",
            })
        ).not.toThrow();
    });

    it("parametroPatchBodySchema rejects an empty valor", () => {
        expect(() => parametroPatchBodySchema.parse({ valor: "" })).toThrow();
    });

    it("parametroPatchBodySchema rejects an invalid tipo", () => {
        expect(() => parametroPatchBodySchema.parse({ valor: "x", tipo: "INVALID" })).toThrow();
    });

    it("parametroPatchBodySchema rejects an invalid categoria", () => {
        expect(() => parametroPatchBodySchema.parse({ valor: "x", categoria: "INVALID" })).toThrow();
    });

    it("parametroPatchBodySchema rejects a motivo longer than 500 chars", () => {
        expect(() =>
            parametroPatchBodySchema.parse({ valor: "x", motivo: "a".repeat(501) })
        ).toThrow();
    });
});

// SPEC-145 (FR-005): schemas del CRUD de profesores y titular de curso (D1=A).
describe("schemas profesor (SPEC-145)", () => {
    it("profesorBodySchema acepta el mínimo (nombre + apellidos)", () => {
        const parsed = profesorBodySchema.parse({ nombre: "María", apellidos: "López" });
        expect(parsed.email).toBeUndefined();
        expect(parsed.telefono).toBeUndefined();
    });

    it("profesorBodySchema acepta email y teléfono opcionales", () => {
        expect(() =>
            profesorBodySchema.parse({ nombre: "María", apellidos: "López", email: "maria@colegio.edu.co", telefono: "+573001112233" })
        ).not.toThrow();
    });

    it("profesorBodySchema rechaza sin apellidos con mensaje humano", () => {
        const result = profesorBodySchema.safeParse({ nombre: "María" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Falta el apellido del profesor");
    });

    it("profesorBodySchema rechaza email mal formado", () => {
        expect(() => profesorBodySchema.parse({ nombre: "María", apellidos: "López", email: "no-es-email" })).toThrow();
    });

    it("profesorPatchSchema acepta cualquier subconjunto incluido estado", () => {
        expect(() => profesorPatchSchema.parse({ estado: "inactivo" })).not.toThrow();
        expect(() => profesorPatchSchema.parse({ telefono: "+573009998877" })).not.toThrow();
        expect(() => profesorPatchSchema.parse({ email: null })).not.toThrow();
    });

    it("profesorPatchSchema rechaza estado fuera de activo|inactivo", () => {
        expect(() => profesorPatchSchema.parse({ estado: "suspendido" })).toThrow();
    });

    it("profesorPatchSchema rechaza el body vacío", () => {
        expect(() => profesorPatchSchema.parse({})).toThrow();
    });

    it("profesoresQuerySchema aplica defaults y cota pageSize", () => {
        const parsed = profesoresQuerySchema.parse({});
        expect(parsed).toEqual({ page: 1, pageSize: 25, estado: "activo" });
        expect(profesoresQuerySchema.parse({ page: "2", pageSize: "50", estado: "todos" })).toEqual({ page: 2, pageSize: 50, estado: "todos" });
        expect(() => profesoresQuerySchema.parse({ pageSize: "101" })).toThrow();
        expect(() => profesoresQuerySchema.parse({ estado: "suspendido" })).toThrow();
    });

    it("cursoBodySchema y cursoUpdateBodySchema aceptan profesorTitularId (D1=A), null y ausente", () => {
        const cuid = "cm0k5example12345678901234567890";
        expect(() => cursoBodySchema.parse({ nombre: "6A", profesorTitularId: cuid })).not.toThrow();
        expect(() => cursoBodySchema.parse({ nombre: "6A", profesorTitularId: null })).not.toThrow();
        expect(() => cursoBodySchema.parse({ nombre: "6A" })).not.toThrow();
        expect(() => cursoBodySchema.parse({ nombre: "6A", profesorTitularId: "no-es-cuid" })).toThrow();
        expect(() => cursoUpdateBodySchema.parse({ profesorTitularId: cuid })).not.toThrow();
        expect(() => cursoUpdateBodySchema.parse({ profesorTitularId: null })).not.toThrow();
    });
});
