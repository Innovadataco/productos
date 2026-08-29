/**
 * SPEC-234 (002-PI-134): orquestador de compilación de un expediente padre.
 * Genera un InformeConsolidado con score, patrones N1, señal comunitaria y PDF.
 * No utiliza IA ni incluye texto original de reportes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/dal/prisma.ts";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { getParametroSistemaValor } from "@/lib/parametros";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { InformeConsolidadoRepository } from "@/lib/dal/repositories/informe-consolidado-repository";
import { PatronExpedienteRepository } from "@/lib/dal/repositories/patron-expediente-repository";
import { SenalComunitariaRepository } from "@/lib/dal/repositories/senal-comunitaria-repository";
import { agregarCategoriasPorExpediente } from "./queries/agregar-categorias";
import { obtenerSenalComunitaria } from "./queries/senal-comunitaria";
import { detectarAceleracion } from "./reglas/aceleracion";
import { detectarProgresion } from "./reglas/progresion";
import { detectarPerpetradorSerial } from "./reglas/perpetrador-serial";
import { detectarMultiplataforma } from "./reglas/multiplataforma";
import { calcularScore } from "./score/calcular-score";
import { renderizarMarkdown } from "./template/renderizar-markdown";
import { generarPdf } from "../pdf/generar-pdf";

export interface CompilarExpedienteOptions {
    generadoPorId?: string;
    timestampPdf?: Date;
}

export interface ParametrosCompilacion {
    pesoNumReportes: number;
    pesoCategoriaGrave: number;
    pesoAceleracion: number;
    pesoSenalComunitaria: number;
    umbralAmarillo: number;
    umbralRojo: number;
    categoriasGraves: string[];
    aceleracionRatioMinimo: number;
    senalComunitariaPerpetradorSerial: number;
    multiplataformaMin: number;
}

export async function cargarParametrosCompilacion(): Promise<ParametrosCompilacion> {
    const [
        pesoNumReportes,
        pesoCategoriaGrave,
        pesoAceleracion,
        pesoSenalComunitaria,
        umbralAmarillo,
        umbralRojo,
        categoriasGravesRaw,
        aceleracionRatioMinimo,
        senalComunitariaPerpetradorSerial,
        multiplataformaMin,
    ] = await Promise.all([
        getParametroSistemaValor("padre.score.peso_num_reportes"),
        getParametroSistemaValor("padre.score.peso_categoria_grave"),
        getParametroSistemaValor("padre.score.peso_aceleracion"),
        getParametroSistemaValor("padre.score.peso_senal_comunitaria"),
        getParametroSistemaValor("padre.score.umbral_amarillo"),
        getParametroSistemaValor("padre.score.umbral_rojo"),
        getParametroSistemaValor("padre.categorias_graves_json"),
        getParametroSistemaValor("padre.patron.aceleracion_ratio_minimo"),
        getParametroSistemaValor("padre.patron.senal_comunitaria_perpetrador_serial"),
        getParametroSistemaValor("padre.patron.multiplataforma_min"),
    ]);

    let categoriasGraves: string[] = [];
    try {
        categoriasGraves = JSON.parse(categoriasGravesRaw ?? "[]") as string[];
    } catch {
        categoriasGraves = [];
    }

    return {
        pesoNumReportes: parseFloat(pesoNumReportes ?? "2"),
        pesoCategoriaGrave: parseFloat(pesoCategoriaGrave ?? "5"),
        pesoAceleracion: parseFloat(pesoAceleracion ?? "3"),
        pesoSenalComunitaria: parseFloat(pesoSenalComunitaria ?? "4"),
        umbralAmarillo: parseInt(umbralAmarillo ?? "20", 10),
        umbralRojo: parseInt(umbralRojo ?? "50", 10),
        categoriasGraves,
        aceleracionRatioMinimo: parseFloat(aceleracionRatioMinimo ?? "2"),
        senalComunitariaPerpetradorSerial: parseInt(senalComunitariaPerpetradorSerial ?? "5", 10),
        multiplataformaMin: parseInt(multiplataformaMin ?? "2", 10),
    };
}

export async function cargarSeveridadCategorias(client?: Prisma.TransactionClient): Promise<Record<string, number>> {
    const db = client ?? prisma;
    const params = await db.parametroSistema.findMany({
        where: { clave: { startsWith: "scoring.severity." } },
        select: { clave: true, valor: true },
    });

    const map: Record<string, number> = {};
    for (const p of params) {
        const categoria = p.clave.replace("scoring.severity.", "");
        map[categoria] = parseInt(p.valor, 10) || 0;
    }
    return map;
}

export async function compilarExpediente(
    expedienteId: string,
    opts: CompilarExpedienteOptions = {}
) {
    const expedienteRepo = new ExpedienteRepository();
    const expediente = await expedienteRepo.obtenerExpedientePorId(expedienteId);

    if (!expediente) {
        throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    const params = await cargarParametrosCompilacion();
    const eventos = expediente.eventos;

    const [categorias, senal, severidadPorCategoria] = await Promise.all([
        agregarCategoriasPorExpediente(expedienteId),
        obtenerSenalComunitaria(expediente.identificadorReportado),
        cargarSeveridadCategorias(),
    ]);

    const patrones = [
        detectarAceleracion(eventos, params.aceleracionRatioMinimo),
        detectarProgresion(eventos, severidadPorCategoria),
        detectarPerpetradorSerial(eventos, params.senalComunitariaPerpetradorSerial),
        detectarMultiplataforma(eventos, params.multiplataformaMin),
    ];

    const eventosCategoriaGrave = eventos.filter((e) =>
        params.categoriasGraves.includes(e.categoriaDetectada ?? "")
    ).length;

    const senalComunitariaScore = senal.totalExpedientesActivos + senal.totalExpedientesEscalados * 2;

    const { score, gravedad } = calcularScore({
        numEventos: eventos.length,
        eventosCategoriaGrave,
        patrones,
        senalComunitariaScore,
        pesoNumReportes: params.pesoNumReportes,
        pesoCategoriaGrave: params.pesoCategoriaGrave,
        pesoAceleracion: params.pesoAceleracion,
        pesoSenalComunitaria: params.pesoSenalComunitaria,
        umbralAmarillo: params.umbralAmarillo,
        umbralRojo: params.umbralRojo,
    });

    const resumen = renderizarMarkdown({
        numEventos: eventos.length,
        categorias,
        patrones,
        senal,
        score,
        gravedad,
    });

    const informeRepo = new InformeConsolidadoRepository();
    const ultimaVersion = await informeRepo.obtenerUltimaVersion(expedienteId);
    const versionSecuencial = (ultimaVersion?.versionSecuencial ?? 0) + 1;

    const pdfTimestamp = opts.timestampPdf ?? new Date();
    const directorioInformes = process.env.INFORMES_STORAGE_DIR ?? "/data/informes";
    const pdfUrl = path.join(directorioInformes, `${expedienteId}-v${versionSecuencial}.pdf`);

    const informePreliminar = {
        expedienteId,
        versionSecuencial,
        scoreValor: score,
        scoreGravedad: gravedad,
        categoriasDetectadasJson: Object.fromEntries(categorias.map((c) => [c.categoria, c.totalEventos])),
        patronesDetectadosJson: patrones.map((p) => ({
            detectado: p.detectado,
            severidad: p.severidad,
            descripcionTexto: p.descripcionTexto,
            datosContextoJson: p.datosContextoJson,
        })),
        senalComunitariaJson: {
            totalExpedientesActivos: senal.totalExpedientesActivos,
            totalExpedientesCerrados: senal.totalExpedientesCerrados,
            totalExpedientesEscalados: senal.totalExpedientesEscalados,
            categoriasFrecuenciaJson: senal.categoriasFrecuenciaJson,
            plataformasJson: senal.plataformasJson,
        },
        resumenTextoGenerado: resumen,
        pdfUrl,
        pdfHash: undefined as unknown as string,
        pdfGeneradoEn: pdfTimestamp,
        generadoPorId: opts.generadoPorId,
    };

    const { buffer, hash } = await generarPdf(informePreliminar as never, { timestamp: pdfTimestamp });
    informePreliminar.pdfHash = hash;

    await mkdir(path.dirname(pdfUrl), { recursive: true });
    await writeFile(pdfUrl, buffer);

    const patronesDetectados = patrones.filter((p) => p.detectado);

    const informe = await withUnitOfWork(async (tx) => {
        const informeCreado = await new InformeConsolidadoRepository(tx).crearInforme({
            expedienteId: informePreliminar.expedienteId,
            versionSecuencial: informePreliminar.versionSecuencial,
            scoreValor: informePreliminar.scoreValor,
            scoreGravedad: informePreliminar.scoreGravedad,
            categoriasDetectadasJson: informePreliminar.categoriasDetectadasJson as never,
            patronesDetectadosJson: informePreliminar.patronesDetectadosJson as never,
            senalComunitariaJson: informePreliminar.senalComunitariaJson as never,
            resumenTextoGenerado: informePreliminar.resumenTextoGenerado,
            pdfUrl: informePreliminar.pdfUrl,
            pdfHash: informePreliminar.pdfHash,
            pdfGeneradoEn: informePreliminar.pdfGeneradoEn,
            generadoPorId: informePreliminar.generadoPorId,
        });

        if (patronesDetectados.length > 0) {
            await new PatronExpedienteRepository(tx).guardarPatrones(
                expedienteId,
                patronesDetectados.map((p) => ({
                    tipoPatron: p.datosContextoJson.tipoPatron as string,
                    severidad: p.severidad,
                    nivelConfianza: 0.7,
                    descripcionTexto: p.descripcionTexto,
                    datosContextoJson: p.datosContextoJson as never,
                    detectadoEn: pdfTimestamp,
                }))
            );
        }

        await new SenalComunitariaRepository(tx).invalidar(expediente.identificadorReportado);

        await logAudit({
            accion: "INFORME_CONSOLIDADO_CREADO",
            tipoRecurso: "InformeConsolidado",
            recursoId: informeCreado.id,
            usuarioId: opts.generadoPorId,
            metadatos: { expedienteId, versionSecuencial: informeCreado.versionSecuencial },
            ipAddress: "worker",
            userAgent: "compilar-expediente",
            tx,
        });

        await logAudit({
            accion: "PDF_GENERADO",
            tipoRecurso: "InformeConsolidado",
            recursoId: informeCreado.id,
            usuarioId: opts.generadoPorId,
            metadatos: { pdfHash: informePreliminar.pdfHash, pdfUrl: informePreliminar.pdfUrl },
            ipAddress: "worker",
            userAgent: "compilar-expediente",
            tx,
        });

        return informeCreado;
    });

    return informe;
}
