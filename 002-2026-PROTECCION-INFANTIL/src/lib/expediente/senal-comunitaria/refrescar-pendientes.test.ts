/**
 * SPEC-234 (002-PI-134): tests del refresco de caché de señal comunitaria.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { seedParametrosPadre, seedParametrosSenalComunitaria } from "../../../../prisma/seed";
import { SenalComunitariaRepository } from "@/lib/dal/repositories/senal-comunitaria-repository";
import { refrescarSenalComunitariaPendientes } from "./refrescar-pendientes";

async function crearCacheInvalidada(identificador: string, actualizadoEn: Date) {
    const repo = new SenalComunitariaRepository();
    await repo.guardarCache({
        identificadorReportado: identificador,
        categoriasFrecuenciaJson: {},
        primeraAparicionEn: actualizadoEn,
        ultimaAparicionEn: actualizadoEn,
        paisesJson: {},
        ciudadesJson: {},
        plataformasJson: {},
    });
    await prisma.senalComunitariaCache.update({
        where: { identificadorReportado: identificador },
        data: { invalidado: true, actualizadoEn },
    });
}

describe("refrescarSenalComunitariaPendientes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParametrosPadre();
        await seedParametrosSenalComunitaria();
    });

    it("recalcula y limpia el flag invalidado de cachés pendientes", async () => {
        const identificador = "+573001112233";
        const viejo = new Date(Date.now() - 120 * 60_000);
        await crearCacheInvalidada(identificador, viejo);

        const procesados = await refrescarSenalComunitariaPendientes(60, 100);
        expect(procesados).toBe(1);

        const cache = await new SenalComunitariaRepository().obtenerPorIdentificador(identificador);
        expect(cache).not.toBeNull();
        expect(cache?.invalidado).toBe(false);
        expect(cache?.actualizadoEn.getTime()).toBeGreaterThan(viejo.getTime());
    });

    it("no toca cachés vigentes", async () => {
        const identificador = "+573009998877";
        const repo = new SenalComunitariaRepository();
        await repo.guardarCache({
            identificadorReportado: identificador,
            categoriasFrecuenciaJson: {},
            primeraAparicionEn: new Date(),
            ultimaAparicionEn: new Date(),
            paisesJson: {},
            ciudadesJson: {},
            plataformasJson: {},
        });

        const procesados = await refrescarSenalComunitariaPendientes(60, 100);
        expect(procesados).toBe(0);

        const cache = await repo.obtenerPorIdentificador(identificador);
        expect(cache?.invalidado).toBe(false);
    });
});
