/**
 * SPEC-863 (I-400) · CANDADO de exclusión del SIMULACRO — con CONTROL POSITIVO.
 *
 * Invariante que muere con el defecto: un reporte de PRUEBA (marcado en `demo_marcado`
 * entidad="Reporte" O ligado en `simulacion_reportes`) es INVISIBLE para los consumidores de
 * usuario real, y — lo exigido por el CEO — **un simulacro NO mueve el agregado público de un
 * identificador REAL**. Cada caso lleva su control positivo: el mismo escenario SIN la marca (o
 * con un reporte real) SÍ produce el efecto, de modo que el test fallaría si se quita el filtro.
 *
 * Si un consumidor deja de honrar el predicado (o el factory deja de escribir la marca), un caso
 * se pone ROJO. Fuente única del predicado: `src/lib/dal/demo-exclusion.ts`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";
import {
    esReporteNoReal,
    idsReportesNoReales,
    whereExcluirReportesNoReales,
} from "@/lib/dal/demo-exclusion";
import { recalcularYGuardarScore, recalcularYGuardarScoreSiReporteReal } from "@/lib/scoring";
import { detectarYRegistrarMatch } from "@/lib/dal/services/evento-match";

const TAG = Math.random().toString(36).slice(2, 8);
let correlativo = 0;

/** Crea un reporte APROBADO (CLASIFICADO + categoría aprobada). `marcaSimulacro` lo marca en la
 *  MISMA tx (como hace el simulador de abusos). `huella`/`usuarioId` dan una FUENTE probable para
 *  el match. */
async function crearReporteAprobado(opts: {
    identificador: string;
    plataformaId: string;
    usuarioId?: string;
    huella?: string;
    marcaSimulacro?: boolean;
    ciudad?: string;
}) {
    correlativo += 1;
    const reporte = await prisma.$transaction((tx) =>
        crearReporteConTexto(tx, {
            texto: "Texto de prueba del candado de simulacro, con suficientes caracteres.",
            reporte: {
                identificador: opts.identificador,
                plataformaId: opts.plataformaId,
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: opts.ciudad ?? "Bogotá",
                pais: "Colombia",
                esAnonimo: !opts.usuarioId,
                usuarioId: opts.usuarioId ?? null,
                numeroSeguimiento: `RPT-${TAG}-${correlativo}`,
                estado: "CLASIFICADO",
            },
            ...(opts.marcaSimulacro ? { marcaSimulacro: { origen: "simulador-abuso" } } : {}),
        })
    );
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "EXTORSION",
            confianza: 0.9,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 100,
        },
    });
    if (opts.huella) {
        await prisma.fuenteReporte.create({
            data: { reporteId: reporte.id, ipHash: opts.huella, pesoAplicado: 1 },
        });
    }
    return reporte;
}

describe("SPEC-863 · exclusión del simulacro (control positivo)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPaisCiudad();
    });

    it("A · el factory escribe la marca `demo_marcado` en la MISMA tx — y NO sin la bandera", async () => {
        const plat = await crearPlataforma();
        const conMarca = await crearReporteAprobado({ identificador: `+57a${TAG}`, plataformaId: plat.id, marcaSimulacro: true });
        const sinMarca = await crearReporteAprobado({ identificador: `+57b${TAG}`, plataformaId: plat.id });

        const marca = await prisma.demoMarcado.findUnique({
            where: { entidad_entidadId: { entidad: "Reporte", entidadId: conMarca.id } },
        });
        expect(marca).not.toBeNull();
        expect((marca!.metadata as { origen?: string }).origen).toBe("simulador-abuso");

        // Control positivo: un reporte normal NO deja marca (si el factory marcara siempre, esto fallaría).
        const sinMarcaRow = await prisma.demoMarcado.findUnique({
            where: { entidad_entidadId: { entidad: "Reporte", entidadId: sinMarca.id } },
        });
        expect(sinMarcaRow).toBeNull();
    });

    it("B · el predicado canónico distingue simulacro (demo_marcado y simulacion_reportes) de real", async () => {
        const plat = await crearPlataforma();
        const real = await crearReporteAprobado({ identificador: `+57c${TAG}`, plataformaId: plat.id });
        const demo = await crearReporteAprobado({ identificador: `+57d${TAG}`, plataformaId: plat.id, marcaSimulacro: true });
        // Rama simulacion_reportes: un reporte ligado a una corrida del simulador de clasificación.
        const sim = await crearReporteAprobado({ identificador: `+57e${TAG}`, plataformaId: plat.id });
        const creador = await crearUsuario("ADMIN");
        const run = await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 1, estado: "COMPLETADA", creadoPorId: creador.id },
        });
        await prisma.simulacionReporte.create({ data: { simulacionRunId: run.id, reporteId: sim.id, indice: 0 } });

        expect(await esReporteNoReal(prisma, real.id)).toBe(false);
        expect(await esReporteNoReal(prisma, demo.id)).toBe(true);
        expect(await esReporteNoReal(prisma, sim.id)).toBe(true);

        const ids = await idsReportesNoReales(prisma);
        expect(ids).toEqual(expect.arrayContaining([demo.id, sim.id]));
        expect(ids).not.toContain(real.id);

        const visibles = await prisma.reporte.findMany({
            where: await whereExcluirReportesNoReales(prisma),
            select: { id: true },
        });
        const visiblesIds = visibles.map((r) => r.id);
        expect(visiblesIds).toContain(real.id);
        expect(visiblesIds).not.toContain(demo.id);
        expect(visiblesIds).not.toContain(sim.id);
    });

    it("C · un simulacro NO mueve el agregado público de un identificador REAL (exigido por el CEO)", async () => {
        const plat = await crearPlataforma();
        const identificador = `+57real${TAG}`;

        // Un reporte REAL aprobado fija el agregado del id en 1.
        await crearReporteAprobado({ identificador, plataformaId: plat.id, usuarioId: (await crearUsuario("PARENT")).id });
        await recalcularYGuardarScore(identificador, plat.id);
        const base = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId: plat.id } },
        });
        expect(base?.reportesAprobados).toBe(1);

        // Llega un SIMULACRO sobre el MISMO identificador real.
        const simulacro = await crearReporteAprobado({ identificador, plataformaId: plat.id, marcaSimulacro: true, usuarioId: (await crearUsuario("PARENT")).id });

        // Un recálculo del id real NO cuenta el simulacro (calcularScore lo excluye).
        await recalcularYGuardarScore(identificador, plat.id);
        const despues = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId: plat.id } },
        });
        expect(despues?.reportesAprobados).toBe(1); // control positivo: si contara el simulacro, sería 2.

        // Y el wrapper disparado POR el simulacro no toca el agregado (devuelve null).
        const r = await recalcularYGuardarScoreSiReporteReal(simulacro.id, identificador, plat.id);
        expect(r).toBeNull();
        const final = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId: plat.id } },
        });
        expect(final?.reportesAprobados).toBe(1);
    });

    it("D · detectarYRegistrarMatch ignora el simulacro — y SÍ registra el real (control positivo)", async () => {
        const plat = await crearPlataforma();

        // Control positivo: real previo (fuente A) + real nuevo (fuente B) → match registrado.
        const idReal = `+57mr${TAG}`;
        await prisma.identificadorReportado.create({ data: { identificador: idReal, plataformaId: plat.id, totalReportes: 1, reportesAprobados: 1 } });
        await crearReporteAprobado({ identificador: idReal, plataformaId: plat.id, huella: `hA${TAG}` });
        const nuevoReal = await crearReporteAprobado({ identificador: idReal, plataformaId: plat.id, huella: `hB${TAG}` });
        const okReal = await detectarYRegistrarMatch(nuevoReal.id);
        expect(okReal.registrado).toBe(true);

        // Caso simulacro: mismo escenario pero el reporte NUEVO es simulacro → NO registra.
        const idSim = `+57ms${TAG}`;
        await prisma.identificadorReportado.create({ data: { identificador: idSim, plataformaId: plat.id, totalReportes: 1, reportesAprobados: 1 } });
        await crearReporteAprobado({ identificador: idSim, plataformaId: plat.id, huella: `hC${TAG}` });
        const nuevoSim = await crearReporteAprobado({ identificador: idSim, plataformaId: plat.id, huella: `hD${TAG}`, marcaSimulacro: true });
        const resSim = await detectarYRegistrarMatch(nuevoSim.id);
        expect(resSim.registrado).toBe(false);
        expect(resSim.motivo).toBe("simulacro");
        const evento = await prisma.eventoMatch.findUnique({ where: { reporteNuevoId: nuevoSim.id } });
        expect(evento).toBeNull();
    });
});
