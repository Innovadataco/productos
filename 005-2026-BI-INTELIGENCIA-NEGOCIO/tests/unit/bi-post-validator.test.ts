import { describe, it, expect } from "vitest";
import { validarSqlGenerado } from "@/lib/bi/post-validator";
import type { CatalogoTablaResuelto } from "@/lib/bi/tipos";

const CAT: CatalogoTablaResuelto = {
    tablasPermitidas: ["bi_reporte_diario"],
    columnasPorTabla: {
        bi_reporte_diario: ["fecha", "categoria", "total"],
    },
    columnasExcluidas: {
        bi_reporte_diario: ["nombre_padre"],
    },
};

describe("validarSqlGenerado (candado 6b)", () => {
    it("rechaza sin LIMIT", () => {
        const r = validarSqlGenerado(
            "SELECT COUNT(*) AS total FROM bi_reporte_diario",
            CAT,
            "ADMIN",
        );
        expect(r.valido).toBe(false);
        expect(r.razon).toBe("limit_missing_o_excedido");
    });

    it("rechaza LIMIT excedido", () => {
        const r = validarSqlGenerado(
            "SELECT * FROM bi_reporte_diario LIMIT 5000",
            CAT,
            "ADMIN",
        );
        expect(r.valido).toBe(false);
        expect(r.razon).toBe("limit_missing_o_excedido");
    });

    it("rechaza tabla no listada", () => {
        const r = validarSqlGenerado(
            "SELECT * FROM tabla_prohibida LIMIT 10",
            CAT,
            "ADMIN",
        );
        expect(r.valido).toBe(false);
        expect(r.razon).toBe("tabla_no_permitida");
    });

    it("rechaza JOIN sin ON", () => {
        const r = validarSqlGenerado(
            "SELECT * FROM bi_reporte_diario JOIN bi_reporte_diario alias LIMIT 10",
            CAT,
            "ADMIN",
        );
        expect(r.valido).toBe(false);
        expect(r.razon).toBe("join_sin_on");
    });

    it("rechaza no-SELECT", () => {
        const r = validarSqlGenerado(
            "UPDATE bi_reporte_diario SET total=0 LIMIT 10",
            CAT,
            "ADMIN",
        );
        expect(r.valido).toBe(false);
        expect(r.razon).toBe("sql_no_es_select");
    });

    it("rechaza columna excluida", () => {
        const r = validarSqlGenerado(
            "SELECT nombre_padre FROM bi_reporte_diario LIMIT 5",
            CAT,
            "ADMIN",
        );
        expect(r.valido).toBe(false);
        expect(r.razon).toBe("columna_excluida");
    });

    it("acepta SELECT válido con LIMIT dentro del rango", () => {
        const r = validarSqlGenerado(
            "SELECT categoria, total FROM bi_reporte_diario LIMIT 100",
            CAT,
            "ADMIN",
        );
        expect(r.valido).toBe(true);
    });

    it("exige WHERE tenant_id para rol no-ADMIN", () => {
        const r = validarSqlGenerado(
            "SELECT total FROM bi_reporte_diario LIMIT 5",
            CAT,
            "SCHOOL_ADMIN",
        );
        expect(r.valido).toBe(false);
        expect(r.razon).toBe("falta_where_tenant");
    });

    it("acepta SCHOOL_ADMIN con WHERE tenant_id", () => {
        const r = validarSqlGenerado(
            "SELECT total FROM bi_reporte_diario WHERE tenant_id = 'x' LIMIT 5",
            CAT,
            "SCHOOL_ADMIN",
        );
        expect(r.valido).toBe(true);
    });

    it("rechaza sql vacío", () => {
        expect(validarSqlGenerado("", CAT, "ADMIN").razon).toBe("sql_vacio");
    });
});
