/**
 * SPEC-227 (002-PI-128): tests unitarios de la serialización del export CSV
 * (FR-006/007): columnas exactas del contrato, escape, hash opaco del sujeto,
 * sin título/descripción/datosContexto (posible PII renderizada).
 */
import { describe, it, expect } from "vitest";
import {
    COLUMNAS_EXPORT,
    construirFilasExport,
    nombreArchivoExport,
    tiempoResolucionHoras,
    toCsv,
    type RecomendacionParaExport,
} from "./historial-csv";
import { pseudonimizarSujeto } from "./pseudonimizar";

const SAL = "sal-de-prueba-32-chars-minimo-0000";

const ENCABEZADO_CONTRATO =
    "recomendacion_id,regla_clave,regla_nombre,categoria,prioridad,estado,generada_en,resuelta_en,tiempo_resolucion_horas,ejecutada_automatica,sujeto_tipo,sujeto_hash";

function recomendacionBase(): RecomendacionParaExport {
    return {
        id: "rec-1",
        categoria: "renovacion",
        prioridad: 80,
        estado: "APLICADA",
        generadaEn: new Date("2026-08-20T19:05:00.000Z"), // 14:05 Bogotá
        resueltaEn: new Date("2026-08-21T14:30:00.000Z"), // 19.4 h después
        ejecutadaAutomatica: false,
        sujetoTipo: "Suscripcion",
        sujetoId: "suj-123",
        regla: { clave: "vencimiento.T_menos_7", nombre: "Llamar a clientes que vencen esta semana" },
    };
}

describe("COLUMNAS_EXPORT", () => {
    it("coinciden exactamente con el contrato (orden incluido)", () => {
        expect(COLUMNAS_EXPORT.join(",")).toBe(ENCABEZADO_CONTRATO);
    });
});

describe("tiempoResolucionHoras", () => {
    it("devuelve horas con 1 decimal", () => {
        expect(
            tiempoResolucionHoras(
                new Date("2026-08-20T19:05:00.000Z"),
                new Date("2026-08-21T14:30:00.000Z")
            )
        ).toBe("19.4");
    });

    it("devuelve cadena vacía si no está resuelta", () => {
        expect(tiempoResolucionHoras(new Date(), null)).toBe("");
    });
});

describe("construirFilasExport", () => {
    it("emite las columnas del contrato con el sujeto pseudonimizado", () => {
        const [fila] = construirFilasExport([recomendacionBase()], SAL);
        expect(fila).toBeDefined();
        expect(Object.keys(fila!)).toEqual([...COLUMNAS_EXPORT]);
        expect(fila!.sujeto_hash).toBe(pseudonimizarSujeto("suj-123", SAL));
        expect(fila!.tiempo_resolucion_horas).toBe("19.4");
        expect(fila!.ejecutada_automatica).toBe(false);
        expect(fila!.generada_en).toBe("2026-08-20T14:05:00-05:00");
        expect(fila!.resuelta_en).toBe("2026-08-21T09:30:00-05:00");
    });

    it("sujeto null → hash vacío", () => {
        const [fila] = construirFilasExport(
            [{ ...recomendacionBase(), sujetoId: null, sujetoTipo: null }],
            SAL
        );
        expect(fila!.sujeto_hash).toBe("");
        expect(fila!.sujeto_tipo).toBe("");
    });
});

describe("toCsv", () => {
    it("genera encabezado + una línea por fila", () => {
        const csv = toCsv(construirFilasExport([recomendacionBase()], SAL));
        const lineas = csv.split("\n");
        expect(lineas[0]).toBe(ENCABEZADO_CONTRATO);
        expect(lineas).toHaveLength(2);
        expect(lineas[1]).toContain("rec-1");
        expect(lineas[1]).toContain("vencimiento.T_menos_7");
    });

    it("escapa comas, comillas y saltos de línea (nombre de regla con puntuación)", () => {
        const fila = {
            ...recomendacionBase(),
            regla: { clave: "c", nombre: 'Mora larga, sugerir "bono"' },
        };
        const csv = toCsv(construirFilasExport([fila], SAL));
        expect(csv).toContain('"Mora larga, sugerir ""bono"""');
    });

    it("export con 0 filas genera solo el encabezado (no es error)", () => {
        expect(toCsv([])).toBe(ENCABEZADO_CONTRATO);
    });
});

describe("nombreArchivoExport", () => {
    it("usa el formato recomendaciones-YYYYMMDD-HHmm.csv (hora Bogotá)", () => {
        // 2026-08-24 14:15 UTC = 09:15 Bogotá (ejemplo del contrato).
        expect(nombreArchivoExport(new Date("2026-08-24T14:15:00.000Z"))).toBe(
            "recomendaciones-20260824-0915.csv"
        );
    });
});
