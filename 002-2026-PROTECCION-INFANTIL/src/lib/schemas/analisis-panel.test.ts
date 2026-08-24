/**
 * SPEC-222 (002-PI-123): tests unitarios de los schemas Zod del panel
 * Dinero vs Valor. Sin base de datos.
 */
import { describe, it, expect } from "vitest";
import {
    dineroVsValorQuerySchema,
    dispersionQuerySchema,
    anomaliasQuerySchema,
    parseQuery,
} from "./analisis-panel";

describe("dineroVsValorQuerySchema", () => {
    it("aplica defaults (pais/mes/todas/ambos/paginación estándar)", () => {
        const q = dineroVsValorQuerySchema.parse({});
        expect(q).toMatchObject({
            granularidad: "pais",
            periodo: "mes",
            estado: "todas",
            tipoTitular: "ambos",
            page: 1,
            pageSize: 25,
        });
    });

    it("acepta las 7 granularidades", () => {
        for (const g of ["pais", "ciudad", "colegio", "padre", "plan", "cohorte", "canal"]) {
            expect(dineroVsValorQuerySchema.parse({ granularidad: g }).granularidad).toBe(g);
        }
        expect(() => dineroVsValorQuerySchema.parse({ granularidad: "galaxia" })).toThrow();
    });

    it("custom exige desde y hasta", () => {
        expect(() => dineroVsValorQuerySchema.parse({ periodo: "custom" })).toThrow();
        expect(() => dineroVsValorQuerySchema.parse({ periodo: "custom", desde: "2026-08-01" })).toThrow();
        const q = dineroVsValorQuerySchema.parse({ periodo: "custom", desde: "2026-08-01", hasta: "2026-08-31" });
        expect(q.periodo).toBe("custom");
    });

    it("rechaza rango invertido (desde > hasta)", () => {
        expect(() =>
            dineroVsValorQuerySchema.parse({ periodo: "custom", desde: "2026-08-31", hasta: "2026-08-01" })
        ).toThrow();
    });

    it("pageSize máximo 100 y page mínimo 1", () => {
        expect(() => dineroVsValorQuerySchema.parse({ pageSize: "101" })).toThrow();
        expect(() => dineroVsValorQuerySchema.parse({ page: "0" })).toThrow();
        expect(dineroVsValorQuerySchema.parse({ page: "2", pageSize: "50" })).toMatchObject({ page: 2, pageSize: 50 });
    });
});

describe("dispersionQuerySchema", () => {
    it("aplica defaults y valida custom", () => {
        expect(dispersionQuerySchema.parse({})).toMatchObject({ periodo: "mes", estado: "todas", tipoTitular: "ambos" });
        expect(() => dispersionQuerySchema.parse({ periodo: "custom", desde: "2026-08-02", hasta: "2026-08-01" })).toThrow();
    });
});

describe("anomaliasQuerySchema", () => {
    it("severidad default 'todas' y enum cerrado", () => {
        expect(anomaliasQuerySchema.parse({}).severidad).toBe("todas");
        expect(anomaliasQuerySchema.parse({ severidad: "ALTA" }).severidad).toBe("ALTA");
        expect(() => anomaliasQuerySchema.parse({ severidad: "CRITICA" })).toThrow();
    });
});

describe("parseQuery", () => {
    it("lee el querystring del Request y valida", () => {
        const req = new Request("http://localhost/api/admin/analisis/dinero-vs-valor?granularidad=ciudad&page=3");
        const q = parseQuery(req, dineroVsValorQuerySchema);
        expect(q).toMatchObject({ granularidad: "ciudad", page: 3, pageSize: 25 });
    });

    it("lanza ZodError con query inválido", () => {
        const req = new Request("http://localhost/api/x?granularidad=nope");
        expect(() => parseQuery(req, dineroVsValorQuerySchema)).toThrow();
    });
});
