/**
 * SPEC-368 (A-74) — candado: la plantilla de la LISTA DEL CAMINO GUIADO debe
 * pasar su propio parser + validador con la fila de ejemplo.
 *
 * Por qué existe: la plantilla de carga ya tenía su candado desde I-245 (la
 * plantilla omitía las columnas de documento y el rector obtenía 0 filas
 * válidas). Esta —la que descarga el rector en el camino guiado— NO lo tenía:
 * hoy coincide con su validador, pero podían divergir sin que nadie se enterara
 * hasta que un colegio subiera el archivo y no cargara ni una fila.
 *
 * OJO: valida contra `validarFilasUnificado`, que es el validador REAL de esta
 * plantilla (no el de la carga vieja) — incluye la regla de documento obligatorio.
 */
import { describe, it, expect, vi } from "vitest";

// El parser consulta parámetros del sistema; usamos defaults.
vi.mock("@/lib/parametros", () => ({
    getParametroSistema: vi.fn(async () => null),
}));

import { CSV_PLANTILLA_LISTA } from "./route";
import { parseArchivoCarga } from "@/lib/colegio/carga/parser";
import { validarFilasUnificado } from "@/lib/colegio/unificado/validar-lista";

describe("plantilla de la lista del camino guiado · autoconsistente (SPEC-368)", () => {
    it("incluye las columnas de documento que su validador exige", () => {
        const encabezado = CSV_PLANTILLA_LISTA.split("\n")[0];
        expect(encabezado).toContain("documento_tipo_alumno");
        expect(encabezado).toContain("documento_numero_alumno");
    });

    it("su fila de ejemplo pasa el parser + el validador del camino guiado, sin problemas", async () => {
        const buffer = new TextEncoder().encode(CSV_PLANTILLA_LISTA).buffer as ArrayBuffer;
        const parseado = await parseArchivoCarga(buffer, "csv");
        expect(parseado.errores, `errores de parseo: ${JSON.stringify(parseado.errores)}`).toEqual([]);
        expect(parseado.filas.length).toBeGreaterThan(0);

        const plataformas = new Map<string, string>([["whatsapp", "cmt_plataforma_whatsapp"]]);
        const resultado = validarFilasUnificado(parseado.filas, plataformas);

        // Si la plantilla divergiera de su validador, aquí caería con el motivo.
        expect(resultado.problemas, `problemas: ${JSON.stringify(resultado.problemas)}`).toEqual([]);
        expect(resultado.filasValidas.length).toBeGreaterThanOrEqual(1);
    });
});
