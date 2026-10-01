/**
 * CANDADO · SPEC-790 (D-2/D-7) · el STUB del adaptador REPS NUNCA fabrica un `VIGENTE`.
 *
 * El riesgo es la degradación SILENCIOSA: un stub que devolviera «al día» abriría la compuerta para
 * todos los profesionales sin haber mirado el REPS — el falso amigo que esta spec cierra. Por eso el
 * stub degrada a `SIN_VERIFICAR` (lo rige el cutover) y la ingesta en bloque LEVANTA (un dataset vacío
 * lo tomaría el worker por «miré a todos, ninguno vigente»).
 *
 * Control positivo por MUTACIÓN: el MISMO predicado (`esVigente`) distingue al stub bueno del malo —
 * un stub que fabrica VIGENTE es cazado por la aserción que protege al real.
 */
import { describe, it, expect } from "vitest";
import {
    adaptadorRepsStub,
    RepsNoConfiguradoError,
    type AdaptadorReps,
    type IdentidadProfesionalReps,
    type ResultadoConsultaReps,
} from "./reps-adaptador";

const esVigente = (r: ResultadoConsultaReps) => r.resultado === "VIGENTE";

const MUESTRAS: IdentidadProfesionalReps[] = [
    { tipoDocumento: "CC", numeroDocumento: "123456" },
    { tipoDocumento: "CE", numeroDocumento: "999" },
    { tipoDocumento: "", numeroDocumento: "" },
];

describe("SPEC-790 · adaptador REPS stub — nunca VIGENTE", () => {
    it("consultarReps degrada a SIN_VERIFICAR (jamás VIGENTE) para cualquier identidad", async () => {
        for (const id of MUESTRAS) {
            const r = await adaptadorRepsStub.consultarReps(id);
            expect(esVigente(r), "el stub jamás devuelve VIGENTE (sería degradación silenciosa)").toBe(false);
            expect(r.resultado).toBe("SIN_VERIFICAR");
        }
    });

    it("ingestarDatasetReps LEVANTA «no configurado» (no devuelve [] que el worker tome por «ninguno vigente»)", async () => {
        await expect(adaptadorRepsStub.ingestarDatasetReps()).rejects.toBeInstanceOf(RepsNoConfiguradoError);
    });

    it("control positivo: el MISMO predicado caza un stub que fabricara VIGENTE", async () => {
        const stubMalo: AdaptadorReps = {
            async consultarReps() {
                return { resultado: "VIGENTE", vigenteHasta: null, modalidades: [] };
            },
            async ingestarDatasetReps() {
                return [];
            },
        };
        const bueno = await adaptadorRepsStub.consultarReps(MUESTRAS[0]);
        const malo = await stubMalo.consultarReps(MUESTRAS[0]);
        expect(esVigente(bueno)).toBe(false);
        expect(esVigente(malo), "si la aserción no distinguiera, un stub que abre para todos pasaría").toBe(true);
    });
});
