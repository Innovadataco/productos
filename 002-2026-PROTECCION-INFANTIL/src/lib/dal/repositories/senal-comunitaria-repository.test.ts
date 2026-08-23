/**
 * SPEC-234 (002-PI-134): tests del SenalComunitariaRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { SenalComunitariaRepository } from "./senal-comunitaria-repository";

function baseCache(identificador: string) {
    return {
        identificadorReportado: identificador,
        totalExpedientesActivos: 1,
        totalExpedientesCerrados: 0,
        totalExpedientesEscalados: 0,
        categoriasFrecuenciaJson: { CONTACTO_INSISTENTE: 1 },
        primeraAparicionEn: new Date("2026-08-01T00:00:00Z"),
        ultimaAparicionEn: new Date("2026-08-22T00:00:00Z"),
        paisesJson: { CO: 1 },
        ciudadesJson: { "Bogotá": 1 },
        plataformasJson: { whatsapp: 1 },
    };
}

describe("SenalComunitariaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("guardarCache crea y actualiza por PK", async () => {
        const repo = new SenalComunitariaRepository();
        await repo.guardarCache(baseCache("+573001234567"));

        const primera = await repo.obtenerPorIdentificador("+573001234567");
        expect(primera?.totalExpedientesActivos).toBe(1);

        await repo.guardarCache({ ...baseCache("+573001234567"), totalExpedientesActivos: 3 });
        const segunda = await repo.obtenerPorIdentificador("+573001234567");
        expect(segunda?.totalExpedientesActivos).toBe(3);
    });

    it("invalidar marca la fila como invalidado", async () => {
        const repo = new SenalComunitariaRepository();
        await repo.guardarCache(baseCache("+573001234567"));
        await repo.invalidar("+573001234567");

        const actualizado = await repo.obtenerPorIdentificador("+573001234567");
        expect(actualizado?.invalidado).toBe(true);
    });

    it("obtenerPendientesDeRefresco devuelve filas inválidas y vencidas", async () => {
        const repo = new SenalComunitariaRepository();
        await repo.guardarCache(baseCache("+573001234567"));
        await repo.invalidar("+573001234567");

        const pendientes = await repo.obtenerPendientesDeRefresco(60, 10);
        expect(pendientes.map((p) => p.identificadorReportado)).toContain("+573001234567");
    });
});
