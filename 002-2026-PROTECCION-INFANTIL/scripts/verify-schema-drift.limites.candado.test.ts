/**
 * CANDADO · SPEC-760 / SPEC-766 · registro de LÍMITES del clasificador de drift.
 *
 * `LIMITES_CLASIFICADOR` es deuda DECLARADA: cada entrada es un punto ciego que el
 * clasificador acepta a propósito (para no ahogar el punto ciego de Prisma en falsos
 * positivos). Este candado la fija:
 *  - la lista NO se vacía en silencio (vaciarla = la deuda "desapareció" sin registro);
 *  - cada entrada está documentada y con id único;
 *  - cada `ejemplo` declarado SE clasifica benigno DE VERDAD (la doc no miente sobre el
 *    código: si el clasificador deja de tratarlo benigno, el candado se pone rojo y hay que
 *    MOVER la entrada, no borrarla callado);
 *  - control POSITIVO del caso que motivó el registro (SET DEFAULT gen_random_uuid aislado);
 *  - control NEGATIVO: un SET DEFAULT de un valor NO baselineado SÍ es drift → el límite es
 *    ESPECÍFICO (valores conocidos), no un "todo SET DEFAULT es benigno".
 */
import { describe, it, expect } from "vitest";
import { LIMITES_CLASIFICADOR, clasificarDrift, partirStatements } from "../src/lib/monitoreo/drift-clasificador";

describe("SPEC-760/766 · registro de LÍMITES del clasificador de drift", () => {
    it("ratchet: la lista solo se vacía cuando el punto ciego histórico ya se cerró (no antes, no invierte)", () => {
        // NO se afirma `length > 0`: eso INVERTIRÍA el ratchet — el día que alguien cierre el punto
        // ciego y la lista quede legítimamente vacía, el candado se pondría rojo por MEJORAR, y la
        // única salida sería tocar el candado. En su lugar (patrón PENDIENTES_FASE_2 de Dev-2: al
        // vaciarse, la cláusula ENDURECE), vaciar la lista es un logro VERIFICABLE, no una rotura.
        const { drift } = clasificarDrift(
            partirStatements('ALTER TABLE "x" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();'),
        );
        const puntoCiegoCerrado = drift.length === 1; // gen_random_uuid aislado pasó a ser DRIFT
        // Invariante: hay deuda declarada O el punto ciego histórico ya se cerró. Nunca «lista vacía
        // + punto ciego abierto» (eso sería vaciar el registro sin cerrar nada). Vaciarla NUNCA pone
        // rojo el candado por sí sola. (Una entrada obsoleta —punto ciego cerrado pero aún listada—
        // la caza el test «cada ejemplo se clasifica benigno», que obliga a quitarla.)
        expect(
            LIMITES_CLASIFICADOR.length > 0 || puntoCiegoCerrado,
            "lista vacía PERO gen_random_uuid aislado sigue benigno → se vació el registro sin cerrar el punto ciego",
        ).toBe(true);
    });

    it("cada entrada está documentada (campos no vacíos) y con id único", () => {
        const ids = new Set<string>();
        for (const l of LIMITES_CLASIFICADOR) {
            for (const campo of ["id", "descripcion", "ejemplo", "porQueSeAcepta", "riesgo", "desde"] as const) {
                expect(l[campo].trim().length, `${l.id}.${campo} no puede estar vacío`).toBeGreaterThan(0);
            }
            expect(ids.has(l.id), `id duplicado: ${l.id}`).toBe(false);
            ids.add(l.id);
        }
    });

    it("cada `ejemplo` declarado SE clasifica benigno (la doc refleja el código)", () => {
        for (const l of LIMITES_CLASIFICADOR) {
            const { benignas, drift } = clasificarDrift(partirStatements(l.ejemplo));
            expect(
                drift,
                `el ejemplo de "${l.id}" debería ser BENIGNO; si ahora es drift, el límite cambió → mové la entrada`,
            ).toEqual([]);
            expect(benignas.length, `el ejemplo de "${l.id}" debería producir 1 sentencia benigna`).toBe(1);
        }
    });

    it("control POSITIVO: un SET DEFAULT gen_random_uuid() AISLADO es benigno (prisma-representacion)", () => {
        const { benignas, drift } = clasificarDrift(
            partirStatements('ALTER TABLE "worker_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();'),
        );
        expect(drift).toEqual([]);
        expect(benignas[0]?.categoria).toBe("prisma-representacion");
    });

    it("control NEGATIVO: un SET DEFAULT de un valor NO baselineado SÍ es drift (el límite es específico)", () => {
        // funcion_desconocida() no está en VALOR_DEFAULT_BENIGNO → no se enmascara.
        const { drift } = clasificarDrift(
            partirStatements('ALTER TABLE "worker_logs" ALTER COLUMN "id" SET DEFAULT funcion_desconocida();'),
        );
        expect(drift.length).toBe(1);
    });
});
