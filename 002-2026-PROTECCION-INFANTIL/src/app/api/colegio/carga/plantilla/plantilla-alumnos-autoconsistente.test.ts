/**
 * SPEC-344 (A-69 · C1 · FR-026-ter · candado I-245) — la plantilla oficial de
 * alumnos DEBE pasar su propio parser + validator con la fila de ejemplo:
 * 0 errores de parseo, 0 errores de validación, ≥ 1 fila válida.
 *
 * Cierra I-245: la plantilla anterior omitía `documento_tipo_alumno` y
 * `documento_numero_alumno` (obligatorios desde SPEC-320) y todo rector que
 * la descargaba y la subía tal cual obtenía 0 filas válidas.
 */
import { describe, it, expect, vi } from "vitest";

// El parser consulta parámetros del sistema; usamos defaults.
vi.mock("@/lib/parametros", () => ({
    getParametroSistema: vi.fn(async () => null),
}));

import { CSV_PLANTILLA_ALUMNOS } from "./route";
import { parseArchivoCarga } from "@/lib/colegio/carga/parser";
import { validarFilasCarga } from "@/lib/colegio/carga/validator";

describe("plantilla-alumnos autoconsistente (SPEC-344 · FR-026-ter · cierra I-245)", () => {
    it("incluye las columnas de documento obligatorias del validador", () => {
        const header = CSV_PLANTILLA_ALUMNOS.split("\n")[0];
        expect(header).toContain("documento_tipo_alumno");
        expect(header).toContain("documento_numero_alumno");
    });

    it("su fila de ejemplo pasa el parser + validador (>=1 fila válida, 0 errores)", async () => {
        const buffer = new TextEncoder().encode(CSV_PLANTILLA_ALUMNOS).buffer as ArrayBuffer;
        const parseado = await parseArchivoCarga(buffer, "csv");
        expect(parseado.errores, `errores de parseo: ${JSON.stringify(parseado.errores)}`).toEqual([]);
        expect(parseado.filas.length).toBeGreaterThan(0);

        const plataformas = new Map<string, string>([["whatsapp", "cmt_plataforma_whatsapp"]]);
        const validado = validarFilasCarga(parseado.filas, plataformas);
        expect(validado.errores, `errores de validación: ${JSON.stringify(validado.errores)}`).toEqual([]);
        expect(validado.filasValidas.length).toBeGreaterThanOrEqual(1);
    });
});
