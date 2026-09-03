/**
 * SPEC-379 (PR B · D5a · candado I-245) — la plantilla oficial de CURSOS
 * debe pasar su propio validador: 1 fila válida, 0 omitidas, 0 errores.
 * Sin este test la plantilla puede desincronizarse en silencio del validador
 * (el defecto original ocurrió con la de alumnos — I-245).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/parametros", () => ({
    getParametroSistema: vi.fn(async () => null),
}));

import {
    PLANTILLA_CURSOS_CSV,
    parseArchivoCargaCursos,
    COLUMNAS_CURSO_REQUERIDAS,
} from "./parser";
import { validarFilasCursos } from "./validator";

describe("plantilla-cursos autoconsistente (SPEC-379 · D5a · I-245)", () => {
    it("incluye TODAS las columnas obligatorias del validador", () => {
        const header = PLANTILLA_CURSOS_CSV.split("\n")[0];
        for (const columna of COLUMNAS_CURSO_REQUERIDAS) {
            expect(header, `falta la columna obligatoria "${columna}"`).toContain(columna);
        }
    });

    it("su fila de ejemplo pasa el validador con 1 fila válida y 0 problemas", async () => {
        const buffer = new TextEncoder().encode(PLANTILLA_CURSOS_CSV).buffer as ArrayBuffer;
        const parseado = await parseArchivoCargaCursos(buffer, "csv");
        expect(parseado.errores, `parseo devolvió errores: ${JSON.stringify(parseado.errores)}`).toEqual([]);
        expect(parseado.filas.length).toBe(1);

        const validado = validarFilasCursos(parseado.filas, {
            cursosEnBd: new Set<string>(),
            profesoresPorDocumento: new Map<string, string>(),
        });
        expect(validado.resumen).toEqual({ crear: 1, omitidos: 0, errores: 0 });
    });
});
