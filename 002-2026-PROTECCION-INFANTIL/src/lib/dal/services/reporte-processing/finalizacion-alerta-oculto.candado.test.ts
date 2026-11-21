/**
 * CANDADO · SPEC-937 (I-451) — la alerta a SUSCRIPTORES es superficie pública: no se envía para un
 * identificador que el comité ocultó.
 *
 * `finalizarReporte` recalcula la visibilidad y dispara `enviarAlertasSuscriptores` (le dice a un
 * TERCERO suscrito que el identificador tiene N reportes). En el barrido de lectores públicos de
 * SPEC-937 este era el único NO cubierto: el camino normal es seguro (un reporte nuevo REAL
 * des-oculta antes de finalizar), pero el RE-PROCESO de un reporte de un identificador oculto
 * notificaría a los suscriptores justo lo que la consulta pública ya no muestra.
 *
 * El gate es `esVisiblePublicamente` (recién recalculado, que ya incorpora `ocultoPorComiteEn`).
 * Para AISLAR el ocultamiento como causa (y no el umbral), se baja el umbral a 1: sin la marca el
 * identificador ES visible y la alerta sale (control positivo); con la marca, no. Integración (BD).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import type { CategoriaConducta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";

const enviarAlertasSuscriptores = vi.fn().mockResolvedValue(undefined);
// Se mockea SOLO esta función del módulo de email (las demás quedan reales) — aislado en su propio
// archivo para no contaminar otros candados de SPEC-937.
vi.mock("@/lib/email", async (importActual) => ({
    ...(await importActual<typeof import("@/lib/email")>()),
    enviarAlertasSuscriptores: (...args: unknown[]) => enviarAlertasSuscriptores(...args),
    enviarAlertaScoreCritico: vi.fn().mockResolvedValue(undefined),
}));

const { finalizarReporte } = await import("./finalizacion");

const IDENT = normalizarIdentificador("+573009371234");

async function plataformaId(): Promise<string> {
    return (await prisma.plataforma.findUniqueOrThrow({ where: { clave: "whatsapp" } })).id;
}

import type { ClasificacionResult } from "./clasificacion";
const CLASIF: ClasificacionResult = {
    categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
    confianza: 0.8,
    categoriasSecundarias: [],
    posibleAgresorPar: false,
    estado: "CLASIFICADO",
    metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
    rawResponse: {},
    votos: [],
};

/** Un reporte en PENDIENTE (NO final, para que finalizarReporte NO corte por idempotencia) + su clasificación. */
async function crearReportePendienteClasificado(pid: string) {
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: IDENT, plataformaId: pid, texto: "Texto anonimizado de prueba.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"), ciudad: "Bogotá", pais: "Colombia",
            esAnonimo: false, estado: "PENDIENTE",
            numeroSeguimiento: `RPT-937A-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        },
    });
    await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria: "CONTACTO_INSISTENTE", confianza: 0.8, contienePii: false, piiDetectada: [], modeloUsado: "ornith:9b", latenciaMs: 1000 },
    });
    return reporte;
}

describe("SPEC-937 · finalizarReporte NO alerta a suscriptores si el comité ocultó el identificador", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        // Umbral 1: con 1 reporte aprobado el identificador es visible — así el ÚNICO motivo de
        // no-visibilidad en el caso oculto es la marca del comité, no el umbral.
        await prisma.parametroSistema.update({ where: { clave: "visibility.report_threshold" }, data: { valor: "1" } });
        enviarAlertasSuscriptores.mockClear();
        process.env.REPORTE_TEXTO_KEY_V1 = process.env.REPORTE_TEXTO_KEY_V1 || "a".repeat(44);
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("control positivo · identificador VISIBLE: finalizar SÍ alerta a suscriptores", async () => {
        const pid = await plataformaId();
        await prisma.identificadorReportado.create({
            data: { identificador: IDENT, plataformaId: pid, totalReportes: 0, reportesAutenticados: 0 },
        });
        const reporte = await crearReportePendienteClasificado(pid);

        await finalizarReporte({ reporteId: reporte.id, estadoFinal: "CLASIFICADO", clasificacion: CLASIF, esRafaga: false, prioridadAlta: false, keywordsDetectadas: [] });

        const agregado = await prisma.identificadorReportado.findUniqueOrThrow({ where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } } });
        expect(agregado.ocultoPorComiteEn, "no ocultado por el comité").toBeNull();
        expect(enviarAlertasSuscriptores).toHaveBeenCalledTimes(1);
    });

    it("identificador OCULTO por el comité: finalizar NO alerta a suscriptores", async () => {
        const pid = await plataformaId();
        await prisma.identificadorReportado.create({
            data: { identificador: IDENT, plataformaId: pid, totalReportes: 0, reportesAutenticados: 0, ocultoPorComiteEn: new Date() },
        });
        const reporte = await crearReportePendienteClasificado(pid);

        await finalizarReporte({ reporteId: reporte.id, estadoFinal: "CLASIFICADO", clasificacion: CLASIF, esRafaga: false, prioridadAlta: false, keywordsDetectadas: [] });

        const agregado = await prisma.identificadorReportado.findUniqueOrThrow({ where: { identificador_plataformaId: { identificador: IDENT, plataformaId: pid } } });
        expect(agregado.ocultoPorComiteEn, "el re-proceso NO des-oculta (solo un reporte nuevo real lo hace, SPEC-110)").not.toBeNull();
        expect(enviarAlertasSuscriptores).not.toHaveBeenCalled();
    });
});
