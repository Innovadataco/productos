/**
 * SPEC-306 (A-50): ensamblado del timeline de eventos del círculo de confianza.
 * Toda la lógica es query-based (sin LLM) y determinista.
 */
import { categoriaAGrupo, obtenerGruposCategoria } from "@/lib/categoria-grupos";
import { TimelineCirculoRepository } from "@/lib/dal/repositories/timeline-circulo-repository";
import type { DatosReporte } from "@/lib/dal/services/circulo-confianza/tipos";
import type { CategoriaGrupo } from "@/lib/categoria-grupos";

export type SeverityTimeline = "VERDE" | "AMARILLO" | "ROJO";

export type TipoEventoTimeline = "REPORTE" | "EXPEDIENTE";

export type TimelineEvento = {
    id: string;
    tipo: TipoEventoTimeline;
    fecha: string;
    severity: SeverityTimeline;
    categoria: string | null;
    titulo: string;
    descripcion: string;
    expedienteId: string | null;
    contactoEtiqueta: string | null;
    identificador: string;
};

const GRUPOS_ALTO_RIESGO = new Set(["contacto_sexual", "amenazas_extorsion"]);
const GRUPOS_RIESGO_MEDIO = new Set(["manipulacion_engano"]);

const PESO_SEVERITY: Record<SeverityTimeline, number> = {
    VERDE: 1,
    AMARILLO: 2,
    ROJO: 3,
};

export function severityDesdeScoreGravedad(score: string): SeverityTimeline {
    if (score === "ROJO") return "ROJO";
    if (score === "AMARILLO") return "AMARILLO";
    return "VERDE";
}

export function severityDesdeCategoria(
    categoria: string | null | undefined,
    grupos: CategoriaGrupo[]
): SeverityTimeline {
    if (!categoria) return "VERDE";
    const grupo = categoriaAGrupo(grupos, categoria);
    if (!grupo) return "VERDE";

    if (GRUPOS_ALTO_RIESGO.has(grupo.clave)) return "ROJO";
    if (GRUPOS_RIESGO_MEDIO.has(grupo.clave)) return "AMARILLO";
    return "VERDE";
}

function formatearFecha(date: Date): string {
    return date.toISOString();
}

function ordenarEventos(a: TimelineEvento, b: TimelineEvento): number {
    const fechaA = new Date(a.fecha).getTime();
    const fechaB = new Date(b.fecha).getTime();
    if (fechaB !== fechaA) return fechaB - fechaA;

    const pesoA = PESO_SEVERITY[a.severity];
    const pesoB = PESO_SEVERITY[b.severity];
    if (pesoB !== pesoA) return pesoB - pesoA;

    // En empate total, EXPEDIENTE antes que REPORTE para destacar actividad procesada.
    if (a.tipo === "EXPEDIENTE" && b.tipo !== "EXPEDIENTE") return -1;
    if (a.tipo !== "EXPEDIENTE" && b.tipo === "EXPEDIENTE") return 1;
    return 0;
}

function construirEventoReporte(
    reporte: DatosReporte,
    grupos: CategoriaGrupo[],
    contactoPorIdentificador: Map<string, { etiqueta: string | null }>,
    expedientePorIdentificador: Map<string, { id: string }>
): TimelineEvento {
    const categoria = reporte.clasificacion?.categoria ?? null;
    const severity = severityDesdeCategoria(categoria, grupos);
    const contacto = contactoPorIdentificador.get(reporte.identificador);
    const expediente = expedientePorIdentificador.get(reporte.identificador);
    const plataforma = reporte.plataforma?.nombre ?? reporte.plataforma?.clave ?? null;

    const titulo = plataforma ? `Reporte recibido · ${plataforma}` : "Reporte recibido";
    const estadoLabel = reporte.estado === "REVISION_MANUAL" || reporte.estado === "REQUIERE_ANONIMIZACION"
        ? "en revisión humana"
        : "clasificado";

    return {
        id: `reporte-${reporte.id}`,
        tipo: "REPORTE",
        fecha: formatearFecha(new Date(reporte.creadoEn)),
        severity,
        categoria,
        titulo,
        descripcion: `Identificador reportado: ${reporte.identificador} (${estadoLabel}).`,
        expedienteId: expediente?.id ?? null,
        contactoEtiqueta: contacto?.etiqueta ?? null,
        identificador: reporte.identificador,
    };
}

function construirEventoExpediente(
    evento: import("@/lib/dal/repositories/timeline-circulo-repository").EventoExpedienteTimeline,
    scoreGravedad: string,
    contactoPorIdentificador: Map<string, { etiqueta: string | null }>,
    identificadorReportado: string
): TimelineEvento {
    const severity = severityDesdeScoreGravedad(scoreGravedad);
    const contacto = contactoPorIdentificador.get(identificadorReportado);

    return {
        id: `expediente-${evento.id}`,
        tipo: "EXPEDIENTE",
        fecha: formatearFecha(new Date(evento.fechaEvento)),
        severity,
        categoria: evento.categoriaDetectada,
        titulo: "Evento en expediente",
        descripcion: evento.texto,
        expedienteId: evento.expedienteId,
        contactoEtiqueta: contacto?.etiqueta ?? null,
        identificador: identificadorReportado,
    };
}

export async function construirTimelineCirculo(
    usuarioId: string,
    repo: TimelineCirculoRepository = new TimelineCirculoRepository()
): Promise<TimelineEvento[]> {
    const contactos = await repo.listarContactosConIdentificadores(usuarioId);
    if (contactos.length === 0) return [];

    const todosLosValores = new Set<string>();
    const contactoPorIdentificador = new Map<string, { etiqueta: string | null }>();

    for (const contacto of contactos) {
        for (const valor of contacto.valores) {
            todosLosValores.add(valor);
            if (!contactoPorIdentificador.has(valor)) {
                contactoPorIdentificador.set(valor, { etiqueta: contacto.etiqueta });
            }
        }
    }

    const valoresArray = Array.from(todosLosValores);
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [reportes, eventosExpediente, expedientes, grupos] = await Promise.all([
        repo.buscarReportesVisiblesRecientes(valoresArray, hace30Dias),
        repo.buscarEventosExpedienteRecientes(usuarioId, valoresArray, hace30Dias),
        repo.buscarExpedientesPorIdentificadores(usuarioId, valoresArray),
        obtenerGruposCategoria(),
    ]);

    const expedientePorIdentificador = new Map<string, { id: string }>();
    const scorePorExpedienteId = new Map<string, string>();
    const identificadorPorExpedienteId = new Map<string, string>();

    for (const expediente of expedientes) {
        expedientePorIdentificador.set(expediente.identificadorReportado, { id: expediente.id });
        scorePorExpedienteId.set(expediente.id, expediente.scoreGravedadActual);
        identificadorPorExpedienteId.set(expediente.id, expediente.identificadorReportado);
    }

    const eventosReporte = reportes.map((reporte) =>
        construirEventoReporte(reporte, grupos, contactoPorIdentificador, expedientePorIdentificador)
    );

    const eventosExpedienteTimeline = eventosExpediente.map((evento) => {
        const identificador = identificadorPorExpedienteId.get(evento.expedienteId) ?? "";
        const score = scorePorExpedienteId.get(evento.expedienteId) ?? "VERDE";
        return construirEventoExpediente(evento, score, contactoPorIdentificador, identificador);
    });

    return [...eventosReporte, ...eventosExpedienteTimeline].sort(ordenarEventos);
}
