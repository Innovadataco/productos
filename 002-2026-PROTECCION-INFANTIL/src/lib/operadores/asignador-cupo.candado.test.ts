/**
 * SPEC-779 · CANDADO del invariante ESTRUCTURAL del reparto: un candidato EN o POR ENCIMA
 * de su cupo NO alcanza la ponderación (el peso negativo es IMPOSIBLE, no «prohibido por el
 * llamador»), y sin elegibles el resultado es `null` — el intento no pasa en silencio.
 *
 * RED-first: contra el código viejo, seleccionarOperador devolvía SIEMPRE un candidato (nunca
 * null) y ponderaba con `(cupoMaximo - casosAbiertos)/cupoMaximo`, así que un over-cupo entraba
 * con peso negativo y weightedRandom degradaba. Este candado muere con ese defecto. Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import { seleccionarOperador, type OperadorCandidato } from "@/lib/operadores/asignador";

const cand = (id: string, cupo: number, cargaActual: number): OperadorCandidato => ({
    id,
    email: `${id}@t.co`,
    nombre: id,
    cupo,
    cargaActual,
});

describe("SPEC-779 · seleccionarOperador aplica el cupo (peso negativo imposible)", () => {
    it("un candidato EN su cupo (cargaActual === cupo) no es elegible → null si es el único", () => {
        expect(seleccionarOperador([cand("a", 10, 10)], "ponderado_carga_inversa")).toBeNull();
        expect(seleccionarOperador([cand("a", 10, 10)], "aleatorio_puro")).toBeNull();
    });

    it("un candidato SOBRE su cupo (el que hacía el peso negativo) no es elegible → null", () => {
        expect(seleccionarOperador([cand("a", 10, 11)], "ponderado_carga_inversa")).toBeNull();
    });

    it("con un over-cupo (PRIMERO en la lista) y uno bajo cupo, SIEMPRE elige el bajo — nunca el over", () => {
        const over = cand("over", 10, 11); // el que colapsaba weightedRandom al primer candidato
        const bajo = cand("bajo", 10, 0);
        for (let i = 0; i < 100; i++) {
            expect(seleccionarOperador([over, bajo], "ponderado_carga_inversa")?.id).toBe("bajo");
        }
    });

    it("TODOS sobre cupo → null (sube al admin como capacidad; no colapsa al primero)", () => {
        const todos = [cand("a", 10, 11), cand("b", 10, 12), cand("c", 10, 15)];
        expect(seleccionarOperador(todos, "ponderado_carga_inversa")).toBeNull();
        expect(seleccionarOperador(todos, "aleatorio_puro")).toBeNull();
    });

    it("bajo cupo entra (control positivo: no todo es null)", () => {
        expect(seleccionarOperador([cand("a", 10, 3)], "ponderado_carga_inversa")?.id).toBe("a");
    });
});
