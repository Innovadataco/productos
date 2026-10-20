/**
 * SPEC-870 (I-446) · CANDADO — el agregado público NO queda huérfano al borrar sus reportes.
 *
 * Muere con el defecto (control positivo):
 *  A · borrar el ÚNICO reporte (SIN match) de un identificador → su `IdentificadorReportado` queda en
 *      score 0 + `esVisiblePublicamente=false`. SIN el recálculo en `borrarReporte` (que antes solo
 *      limpiaba agregados ligados por eventoMatch) la fila quedaría colgada visible — el defecto I-446.
 *      Control positivo: si QUEDA otro reporte vivo, el agregado refleja el restante (NO se pone en 0).
 *  B · el detector `detectarAgregadosHuerfanos` ENCUENTRA una fila visible con 0 reportes vivos y NO
 *      marca una sana (con reporte vivo).
 *  C · el corrector (mismo escritor: recalcularYGuardarScore + actualizarVisibilidadPublica) sanea una
 *      fila huérfana plantada → 0 + oculto.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";
import { recalcularYGuardarScore } from "@/lib/scoring";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { detectarAgregadosHuerfanos } from "@/lib/dal/services/agregados-huerfanos";
import { borrarReporte } from "../../../../scripts/limpieza/borrar-reporte";

const TAG = Math.random().toString(36).slice(2, 8);
let correlativo = 0;

async function crearReporteAprobado(opts: { identificador: string; plataformaId: string; usuarioId?: string; huella?: string }) {
    correlativo += 1;
    const reporte = await prisma.$transaction((tx) =>
        crearReporteConTexto(tx, {
            texto: "Texto de prueba del candado de agregado huérfano, suficientes caracteres.",
            reporte: {
                identificador: opts.identificador,
                plataformaId: opts.plataformaId,
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: !opts.usuarioId,
                usuarioId: opts.usuarioId ?? null,
                numeroSeguimiento: `RPT-${TAG}-${correlativo}`,
                estado: "CLASIFICADO",
            },
        })
    );
    await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria: "EXTORSION", confianza: 0.9, contienePii: false, piiDetectada: [], modeloUsado: "ornith:9b", latenciaMs: 100 },
    });
    if (opts.huella) await prisma.fuenteReporte.create({ data: { reporteId: reporte.id, ipHash: opts.huella, pesoAplicado: 1 } });
    return reporte;
}

/** Fija un agregado como «presente públicamente» (visible, score>0), simulando el estado previo a
 *  que sus reportes se borraran. */
async function plantarAgregadoVisible(identificador: string, plataformaId: string, aprobados: number) {
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId } },
        update: { score: 58, reportesAprobados: aprobados, totalReportes: aprobados, esVisiblePublicamente: true, ultimoReporteEn: new Date() },
        create: { identificador, plataformaId, score: 58, reportesAprobados: aprobados, totalReportes: aprobados, esVisiblePublicamente: true, ultimoReporteEn: new Date() },
    });
}

describe("SPEC-870 · agregado público no queda huérfano (control positivo)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPaisCiudad();
    });

    it("A · borrarReporte del ÚNICO reporte (sin match) → agregado 0 + oculto", async () => {
        const plat = await crearPlataforma();
        const identificador = `+57uno${TAG}`;
        const reporte = await crearReporteAprobado({ identificador, plataformaId: plat.id });
        await plantarAgregadoVisible(identificador, plat.id, 1); // visible/score=58, como tras scoring

        await borrarReporte(reporte.id, "candado SPEC-870", { confirm: true });

        const agg = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId: plat.id } },
        });
        expect(agg).not.toBeNull();
        expect(agg!.reportesAprobados).toBe(0);
        expect(agg!.score).toBe(0);
        expect(agg!.esVisiblePublicamente).toBe(false); // sin el recálculo en borrarReporte, seguiría visible (I-446)
    });

    it("A-control · si QUEDA otro reporte vivo, el agregado refleja el restante (no se pone en 0)", async () => {
        const plat = await crearPlataforma();
        const identificador = `+57dos${TAG}`;
        const a = await crearReporteAprobado({ identificador, plataformaId: plat.id, usuarioId: (await crearUsuario("PARENT")).id });
        await crearReporteAprobado({ identificador, plataformaId: plat.id, usuarioId: (await crearUsuario("PARENT")).id });
        await recalcularYGuardarScore(identificador, plat.id); // agregado real con 2 aprobados

        await borrarReporte(a.id, "candado SPEC-870", { confirm: true });

        const agg = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId: plat.id } },
        });
        expect(agg!.reportesAprobados).toBe(1); // queda 1 vivo; NO se puso en 0 (correctitud del recalc)
    });

    it("B · el detector encuentra el huérfano y NO marca el sano", async () => {
        const plat = await crearPlataforma();
        const idHuerfano = `+57huerf${TAG}`;
        const idSano = `+57sano${TAG}`;
        await plantarAgregadoVisible(idHuerfano, plat.id, 1); // visible, 0 reportes vivos
        await crearReporteAprobado({ identificador: idSano, plataformaId: plat.id });
        await plantarAgregadoVisible(idSano, plat.id, 1); // visible, 1 reporte vivo

        const huerfanos = await detectarAgregadosHuerfanos(prisma);
        const claves = huerfanos.map((h) => h.identificador);
        expect(claves).toContain(idHuerfano);
        expect(claves).not.toContain(idSano);
    });

    it("C · el corrector (recalc + visibilidad) sanea el huérfano a 0 + oculto", async () => {
        const plat = await crearPlataforma();
        const identificador = `+57corr${TAG}`;
        await plantarAgregadoVisible(identificador, plat.id, 1); // visible, 0 reportes vivos

        // Mismo escritor que el corrector (recalcularAgregadosHuerfanos itera esto por fila).
        await recalcularYGuardarScore(identificador, plat.id);
        await actualizarVisibilidadPublica(identificador, plat.id);

        const agg = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId: plat.id } },
        });
        expect(agg!.score).toBe(0);
        expect(agg!.esVisiblePublicamente).toBe(false);
    });
});
