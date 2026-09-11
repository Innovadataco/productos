/**
 * SPEC-605 (pantalla madre del EXPEDIENTE) — DTOs del expediente del padre.
 *
 * Tres lecturas sobre el mismo modelo de SPEC-604 (toda cadena del padre nace
 * con expediente; el identificador canónico es `Expediente.identificadorReportado`):
 *
 *  - `listarExpedientesPadreConUrgencia`: la lista «Mis expedientes», ordenada
 *    por URGENCIA (clasificación dominante: alta → media → baja → sin
 *    clasificar; los cerrados al final) y desempatada por última actividad.
 *  - `detalleExpedientePadre`: la pantalla madre con sus 5 bloques (cabecera
 *    con semáforo · línea de tiempo unificada propios + blindados · tu
 *    evidencia · el análisis con tendencia · acciones).
 *  - `estadoFrescoExpediente`: el refetch de «Consultar estado» (ligero, sin
 *    línea de tiempo ni análisis).
 *
 * Blindajes heredados (cadenas-padre / expediente-vivo): el TEXTO jamás viaja
 * (la evidencia propia se pide por `/api/padre/reportes/[id]/texto` con
 * step-up); los reportes de OTRAS familias se exponen solo como metadatos
 * (fecha · ciudad · categoría · «una familia más»), incluidos los anónimos y
 * los DUPLICADOS (SPEC-543, I-330: un duplicado es la señal de que otra
 * familia reportó lo mismo); SPAM/OTRO nunca cuentan (regla del CEO).
 *
 * Módulo partido por la regla de 500 líneas: `types.ts` (DTOs + selects),
 * `armado.ts` (piezas puras) y acá las consultas y el ensamblado.
 */
import { prisma } from "../../../prisma";
import { formatCategoria } from "../../../labels";
import {
    whereReporteVigente,
    ESTADOS_APROBADOS,
    CATEGORIAS_NO_APROBADAS,
} from "../../../reportes-acceso";
import { getParametroSistemaValor } from "../../../parametros";
import { LABELS_ESTADO } from "../../../padre/expediente-ui";
import type { EstadoReporte } from "@prisma/client";
import {
    ESTADOS_EN_PROCESO,
    ESTADOS_FINALES,
    SELECT_AJENO,
    SELECT_PROPIO,
    type EstadoFrescoExpedienteDto,
    type ExpedienteDetalleDto,
    type ExpedienteListaItemDto,
    type HijoResumenDto,
    type ReporteAjenoRow,
    type ReportePropioRow,
    type UrgenciaExpediente,
} from "./types";
import {
    armarTendencia,
    armarTimeline,
    clasificacionDominante,
    clasificacionesQueCuentan,
    codigoExpediente,
    estadoDeReportes,
    familiasAjenas,
    leerSecundariasLabels,
    nivelDeCategoria,
    plataformaDeCadena,
    resumenHijo,
    semaforoDelExpediente,
    urgenciaDeCategoria,
} from "./armado";

// Reexportaciones deliberadas: el contrato público del módulo es el mismo que
// tenía el archivo único (los consumidores importan del directorio sin saberlo).
export * from "./types";
export { codigoExpediente, urgenciaDeCategoria } from "./armado";

/* ------------------------------ Piezas internas ------------------------------ */

/** El menor vinculado: ficha del reporte propio más reciente que la tenga
 * (SPEC-591/604); si ninguno la tiene, la ficha que vigila ese identificador
 * (IdentificadorHijo activo, mismo criterio que `lecturaDelExpediente`). */
async function resolverHijo(
    usuarioId: string,
    identificador: string,
    propios: ReportePropioRow[]
): Promise<HijoResumenDto | null> {
    const conHijo = [...propios]
        .filter((r) => r.hijo)
        .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime())[0];
    if (conHijo?.hijo) return resumenHijo(conHijo.hijo);

    const vigilado = await prisma.identificadorHijo.findFirst({
        where: { valor: identificador, activo: true, hijo: { usuarioId, estado: "activo" } },
        select: { hijo: { select: { nombre: true, apellidos: true, anioNacimiento: true } } },
        orderBy: { creadoEn: "desc" },
    });
    return vigilado ? resumenHijo(vigilado.hijo) : null;
}

/* -------------------------------- Consultas -------------------------------- */

async function cargarPropios(usuarioId: string, identificadores: string[]): Promise<ReportePropioRow[]> {
    return prisma.reporte.findMany({
        where: whereReporteVigente({ usuarioId, identificador: { in: identificadores } }),
        select: SELECT_PROPIO,
        orderBy: { creadoEn: "asc" },
    });
}

async function cargarAjenos(usuarioId: string, identificadores: string[]): Promise<ReporteAjenoRow[]> {
    // Mismo blindaje que cadenas-padre (SPEC-543 · I-330): aprobados + DUPLICADO,
    // nunca SPAM/OTRO; sin texto ni autor en el select. El «no míos» va como OR
    // explícito: NOT{usuarioId} sobre una columna NULL (el anónimo) excluiría al
    // anónimo por la lógica trivaluada de SQL — y el anónimo ES señal (I-330).
    return prisma.reporte.findMany({
        where: {
            ...whereReporteVigente({ identificador: { in: identificadores } }),
            OR: [{ usuarioId: null }, { usuarioId: { not: usuarioId } }],
            estado: { in: [...ESTADOS_APROBADOS, "DUPLICADO"] as EstadoReporte[] },
            clasificacion: { isNot: { categoria: { in: [...CATEGORIAS_NO_APROBADAS] } } },
        },
        select: SELECT_AJENO,
        orderBy: { creadoEn: "asc" },
    });
}

/* --------------------------------- API pública --------------------------------- */

/** Lista «Mis expedientes»: una tarjeta por expediente, orden por urgencia. */
export async function listarExpedientesPadreConUrgencia(usuarioId: string): Promise<ExpedienteListaItemDto[]> {
    const expedientes = await prisma.expediente.findMany({
        where: { padreUsuarioId: usuarioId },
        orderBy: { fechaApertura: "desc" },
    });
    if (expedientes.length === 0) return [];

    const identificadores = [...new Set(expedientes.map((e) => e.identificadorReportado))];
    const [propios, ajenos] = await Promise.all([cargarPropios(usuarioId, identificadores), cargarAjenos(usuarioId, identificadores)]);

    const propiosPorIdentificador = new Map<string, ReportePropioRow[]>();
    for (const r of propios) {
        const lista = propiosPorIdentificador.get(r.identificador) ?? [];
        lista.push(r);
        propiosPorIdentificador.set(r.identificador, lista);
    }
    const ajenosPorIdentificador = new Map<string, ReporteAjenoRow[]>();
    for (const r of ajenos) {
        const lista = ajenosPorIdentificador.get(r.identificador) ?? [];
        lista.push(r);
        ajenosPorIdentificador.set(r.identificador, lista);
    }

    const items: ExpedienteListaItemDto[] = [];
    for (const exp of expedientes) {
        const propiosDel = propiosPorIdentificador.get(exp.identificadorReportado) ?? [];
        const ajenosDel = ajenosPorIdentificador.get(exp.identificadorReportado) ?? [];
        const dominante = clasificacionDominante(clasificacionesQueCuentan(propiosDel, ajenosDel));
        const hijo = await resolverHijo(usuarioId, exp.identificadorReportado, propiosDel);
        const ultimaActividad = [
            exp.ultimoEventoEn,
            ...propiosDel.map((r) => r.creadoEn),
            ...ajenosDel.map((r) => r.creadoEn),
        ]
            .filter((f): f is Date => Boolean(f))
            .reduce<Date | null>((max, f) => (max && max > f ? max : f), null);

        items.push({
            expedienteId: exp.id,
            codigo: codigoExpediente(exp.id),
            identificador: exp.identificadorReportado,
            plataforma: plataformaDeCadena(propiosDel),
            estado: exp.estado,
            estadoLabel: LABELS_ESTADO[exp.estado],
            hijo,
            urgencia: urgenciaDeCategoria(dominante?.categoria ?? null),
            clasificacionDominante: dominante ? formatCategoria(dominante.categoria) : null,
            eventosTuyos: propiosDel.length,
            otrasFamilias: familiasAjenas(ajenosDel),
            totalReportes: propiosDel.length + ajenosDel.length,
            ultimaActividad: ultimaActividad ?? exp.fechaApertura,
            cerrado: exp.estado === "CERRADO",
        });
    }

    // Urgencia primero (alta → media → baja → sin clasificar); los cerrados al
    // final (mockup: el archivado cierra la lista); desempate por actividad.
    const ORDEN_URGENCIA: Record<UrgenciaExpediente, number> = { alta: 0, media: 1, baja: 2, sin_clasificar: 3 };
    items.sort((a, b) => {
        if (a.cerrado !== b.cerrado) return a.cerrado ? 1 : -1;
        const d = ORDEN_URGENCIA[a.urgencia] - ORDEN_URGENCIA[b.urgencia];
        if (d !== 0) return d;
        return b.ultimaActividad.getTime() - a.ultimaActividad.getTime();
    });
    return items;
}

/** Pantalla madre del expediente (los 5 bloques). Null si no es del padre. */
export async function detalleExpedientePadre(expedienteId: string, usuarioId: string): Promise<ExpedienteDetalleDto | null> {
    const expediente = await prisma.expediente.findFirst({
        where: { id: expedienteId, padreUsuarioId: usuarioId },
    });
    if (!expediente) return null;

    const identificador = expediente.identificadorReportado;
    const [propios, ajenos] = await Promise.all([cargarPropios(usuarioId, [identificador]), cargarAjenos(usuarioId, [identificador])]);

    const hijo = await resolverHijo(usuarioId, identificador, propios);
    const dominante = clasificacionDominante(clasificacionesQueCuentan(propios, ajenos));
    const estadoReportes = estadoDeReportes(propios);

    const otrasFamilias = familiasAjenas(ajenos);
    const familiasQueReportan = otrasFamilias + (propios.length > 0 ? 1 : 0);
    const totalReportes = propios.length + ajenos.length;
    const dominanteLabel = dominante ? formatCategoria(dominante.categoria) : null;
    const urgencia = urgenciaDeCategoria(dominante?.categoria ?? null);

    const secundarias = leerSecundariasLabels(dominante?.categoriasSecundarias);
    const queSignifica = dominante
        ? await getParametroSistemaValor(`padre.analisis.explicacion.${dominante.categoria}`)
        : null;

    const plataforma = plataformaDeCadena(propios);

    return {
        expediente: {
            id: expediente.id,
            codigo: codigoExpediente(expediente.id),
            identificador,
            plataforma,
            estado: expediente.estado,
            estadoLabel: LABELS_ESTADO[expediente.estado],
            fechaApertura: expediente.fechaApertura,
            ultimoEventoEn: expediente.ultimoEventoEn,
        },
        hijo,
        reportePrincipalId: propios[0]?.id ?? null,
        estadoReportes: estadoReportes.estado,
        procesando: estadoReportes.procesando,
        semaforo: semaforoDelExpediente(urgencia, expediente.estado, totalReportes, familiasQueReportan, dominanteLabel),
        timeline: armarTimeline(propios, ajenos),
        evidencia: [...propios]
            .sort((a, b) => b.fechaIncidente.getTime() - a.fechaIncidente.getTime())
            .map((r) => {
                const categoria =
                    r.clasificacion && ESTADOS_FINALES.includes(r.estado) ? r.clasificacion.categoria : null;
                return {
                    reporteId: r.id,
                    fecha: r.fechaIncidente,
                    horaAproximada: r.horaAproximada,
                    categoriaLabel: categoria ? formatCategoria(categoria) : null,
                    nivel: categoria ? nivelDeCategoria(categoria) : null,
                    estadoReporte: r.estado,
                };
            }),
        analisis: dominante
            ? {
                clasificacionDominante: formatCategoria(dominante.categoria),
                confianza: dominante.confianza,
                revisadoPorPersona: (dominante.modeloUsado ?? "").startsWith("manual"),
                tambienConsidero: secundarias,
                queSignifica,
            }
            : null,
        tendencia: armarTendencia([...propios.map((r) => r.creadoEn), ...ajenos.map((r) => r.creadoEn)]),
        ficha: {
            eventosTotales: totalReportes,
            tuyos: propios.length,
            familiasQueReportan,
            estadoLabel: LABELS_ESTADO[expediente.estado],
            plataforma,
            menor: hijo?.nombre ?? null,
            abierto: expediente.fechaApertura,
        },
    };
}

/** «Consultar estado»: refetch ligero del estado fresco del expediente. */
export async function estadoFrescoExpediente(expedienteId: string, usuarioId: string): Promise<EstadoFrescoExpedienteDto | null> {
    const expediente = await prisma.expediente.findFirst({
        where: { id: expedienteId, padreUsuarioId: usuarioId },
        select: { id: true, estado: true, identificadorReportado: true, ultimoEventoEn: true, updatedAt: true },
    });
    if (!expediente) return null;

    const propios = await prisma.reporte.findMany({
        where: whereReporteVigente({ usuarioId, identificador: expediente.identificadorReportado }),
        select: { estado: true },
    });
    const procesando = propios.filter((r) => ESTADOS_EN_PROCESO.includes(r.estado)).length;

    return {
        estadoExpediente: expediente.estado,
        estadoLabel: LABELS_ESTADO[expediente.estado],
        estadoReportes: procesando > 0 ? "EN_PROCESO" : "PROCESADO",
        procesando,
        ultimoEventoEn: expediente.ultimoEventoEn,
        actualizadoEn: expediente.updatedAt,
    };
}
