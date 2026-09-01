/**
 * SPEC-344 (A-69 · C1 · FR-026-bis · candado I-245) — la plantilla oficial de
 * profesores DEBE pasar su propio validador con la fila de ejemplo:
 * 1 fila válida, 0 omitidas, 0 errores. Sin este test la plantilla puede
 * desincronizarse en silencio del validador (defecto que originalmente
 * ocurrió con la de alumnos — I-245).
 */
import { describe, it, expect, vi } from "vitest";

// Evita tocar Prisma en el test unit; el parser consulta límites por
// parámetro con fallback default (5MB / 2000 filas).
vi.mock("@/lib/parametros", () => ({
    getParametroSistema: vi.fn(async () => null),
}));

import {
    PLANTILLA_PROFESORES_CSV,
    parseArchivoCargaProfesores,
    COLUMNAS_PROFESOR,
} from "./parser";
import { validarFilasProfesores } from "./validator";

describe("plantilla-profesores autoconsistente (SPEC-344 · FR-026-bis · I-245)", () => {
    it("incluye TODAS las columnas obligatorias del validador", () => {
        const header = PLANTILLA_PROFESORES_CSV.split("\n")[0];
        for (const columna of COLUMNAS_PROFESOR) {
            expect(header, `falta la columna "${columna}"`).toContain(columna);
        }
    });

    it("su fila de ejemplo pasa el validador con 1 fila válida y 0 problemas", async () => {
        const buffer = new TextEncoder().encode(PLANTILLA_PROFESORES_CSV).buffer as ArrayBuffer;
        const parseado = await parseArchivoCargaProfesores(buffer, "csv");
        expect(parseado.errores, `parseo devolvió errores: ${JSON.stringify(parseado.errores)}`).toEqual([]);
        expect(parseado.filas.length).toBe(1);

        const validado = validarFilasProfesores(parseado.filas, {
            tiposDocumentoActivos: new Set(["CC"]),
            documentosEnBd: new Set<string>(),
        });
        expect(validado.resumen).toEqual({ crear: 1, omitidos: 0, errores: 0 });
    });
});
