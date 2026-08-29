/**
 * SPEC-224 (002-PI-125, FR-004/FR-005/FR-009): tests de los schemas Zod del
 * panel de reglas. Sin BD.
 */
import { describe, it, expect } from "vitest";
import {
    listaReglasQuerySchema,
    crearReglaSchema,
    editarReglaSchema,
    cambiarModoSchema,
    testSqlSchema,
} from "./analisis-reglas";

const CREACION_VALIDA = {
    clave: "test.vencimientos_7d",
    nombre: "Vencimientos en 7 días",
    descripcion: "Suscripciones activas que vencen en la próxima semana",
    categoria: "renovacion",
    sqlQuery: "SELECT s.id FROM suscripciones s WHERE s.estado = 'ACTIVA'",
    plantillaRecomendacion: "Llama a {{colegio}} · vence {{fechaFin}}",
};

describe("listaReglasQuerySchema", () => {
    it("aplica defaults de paginación y acepta filtros", () => {
        const r = listaReglasQuerySchema.parse({});
        expect(r).toEqual({ page: 1, pageSize: 25 });
        expect(listaReglasQuerySchema.parse({ page: "2", pageSize: "50", activa: "true", q: "venc" }).activa).toBe("true");
    });
    it("rechaza pageSize > 100", () => {
        expect(listaReglasQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    });
});

describe("crearReglaSchema", () => {
    it("acepta el payload del contrato con defaults", () => {
        const r = crearReglaSchema.parse(CREACION_VALIDA);
        expect(r.prioridad).toBe(50);
        expect(r.frecuenciaMin).toBe(60);
        expect(r.umbralMinimo).toBeNull();
        expect(r.accionEjecutable).toBeNull();
    });
    it("rechaza claves inválidas (FR-005)", () => {
        for (const clave of ["Mayuscula", "a", "1empieza-con-digito", "con espacio", "x".repeat(82)]) {
            expect(crearReglaSchema.safeParse({ ...CREACION_VALIDA, clave }).success).toBe(false);
        }
    });
    it("rechaza prioridad/frecuencia fuera de rango y plantilla vacía (400)", () => {
        expect(crearReglaSchema.safeParse({ ...CREACION_VALIDA, prioridad: 101 }).success).toBe(false);
        expect(crearReglaSchema.safeParse({ ...CREACION_VALIDA, prioridad: -1 }).success).toBe(false);
        expect(crearReglaSchema.safeParse({ ...CREACION_VALIDA, frecuenciaMin: 4 }).success).toBe(false);
        expect(crearReglaSchema.safeParse({ ...CREACION_VALIDA, frecuenciaMin: 10081 }).success).toBe(false);
        expect(crearReglaSchema.safeParse({ ...CREACION_VALIDA, plantillaRecomendacion: "" }).success).toBe(false);
    });
    it("valida accionEjecutable contra el enum v1", () => {
        expect(crearReglaSchema.safeParse({ ...CREACION_VALIDA, accionEjecutable: "borrar_todo" }).success).toBe(false);
        expect(crearReglaSchema.parse({ ...CREACION_VALIDA, accionEjecutable: "crear_bono_retencion" }).accionEjecutable).toBe("crear_bono_retencion");
    });
});

describe("editarReglaSchema", () => {
    it("exige motivo de mínimo 10 caracteres (trim)", () => {
        expect(editarReglaSchema.safeParse({ prioridad: 90 }).success).toBe(false);
        expect(editarReglaSchema.safeParse({ prioridad: 90, motivo: "   corto   " }).success).toBe(false);
        expect(editarReglaSchema.safeParse({ prioridad: 90, motivo: "  ajuste de prioridad  " }).success).toBe(true);
    });
    it("captura clave/modo para rechazo explícito y rechaza campos desconocidos (strict)", () => {
        const conClave = editarReglaSchema.parse({ clave: "otra.clave", motivo: "motivo de edición válido" });
        expect(conClave.clave).toBe("otra.clave");
        expect(editarReglaSchema.safeParse({ desconocido: 1, motivo: "motivo de edición válido" }).success).toBe(false);
    });
});

describe("cambiarModoSchema", () => {
    it("EJECUTA exige confirmacion exacta y motivo ≥ 20 (SC-004)", () => {
        expect(cambiarModoSchema.safeParse({ modo: "EJECUTA", motivo: "motivo de más de veinte caracteres" }).success).toBe(false);
        expect(
            cambiarModoSchema.safeParse({ modo: "EJECUTA", confirmacion: "ejecuta", motivo: "motivo de más de veinte caracteres" }).success
        ).toBe(false);
        expect(cambiarModoSchema.safeParse({ modo: "EJECUTA", confirmacion: "EJECUTA", motivo: "corto" }).success).toBe(false);
        expect(
            cambiarModoSchema.parse({ modo: "EJECUTA", confirmacion: "EJECUTA", motivo: "motivo de más de veinte caracteres" }).modo
        ).toBe("EJECUTA");
    });
    it("RECOMIENDA exige motivo ≥ 20 sin confirmación de texto", () => {
        expect(cambiarModoSchema.safeParse({ modo: "RECOMIENDA" }).success).toBe(false);
        expect(cambiarModoSchema.parse({ modo: "RECOMIENDA", motivo: "vuelve a revisión humana por ruido" }).modo).toBe("RECOMIENDA");
    });
    it("motivo con solo espacios se mide tras trim (Edge Case)", () => {
        expect(
            cambiarModoSchema.safeParse({ modo: "RECOMIENDA", motivo: "                    " }).success
        ).toBe(false);
    });
});

describe("testSqlSchema", () => {
    it("exige sqlQuery 1..10000 y reglaId opcional", () => {
        expect(testSqlSchema.safeParse({}).success).toBe(false);
        expect(testSqlSchema.parse({ sqlQuery: "SELECT 1" }).reglaId).toBeUndefined();
        expect(testSqlSchema.safeParse({ sqlQuery: "x".repeat(10001) }).success).toBe(false);
    });
});
