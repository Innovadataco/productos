/**
 * SPEC-237 (002-PI-mega-cola): servicio de la bandeja comité CONSOLIDACION.
 * Orquesta los repositorios DAL (Q-3), los parámetros `padre.comite.*` y la
 * transición del expediente vía el motor de SPEC-236 (`aplicarTransicion`),
 * que publica `expediente.comite.aprobo` al alcanzar el umbral (FR-008).
 */
import { EstadoExpediente, EstadoGuiaAccion } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getParametroSistemaValor } from "@/lib/parametros";
import {
    InformeConsolidadoRepository,
    parseAprobaciones,
    parseCorrecciones,
    type MiembroComite,
} from "@/lib/dal/repositories/informe-consolidado-repository";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { PatronExpedienteRepository } from "@/lib/dal/repositories/patron-expediente-repository";
import { GuiaAccionRepository } from "@/lib/dal/repositories/guia-accion-repository";
import { aplicarTransicion } from "@/lib/expediente/estados/aplicar-transicion";
import { construirSla, type SlaInfo } from "./sla";

export const PARAM_MIEMBROS_MINIMOS = "padre.comite.miembros_minimos_aprobacion";
export const PARAM_SLA_HORAS_CONSOLIDACION = "padre.comite.sla_horas_consolidacion";

const DEFAULT_MIEMBROS_MINIMOS = 2;
const DEFAULT_SLA_HORAS = 72;

async function numParam(clave: string, defecto: number): Promise<number> {
    const raw = await getParametroSistemaValor(clave);
    const parsed = Number.parseInt(raw ?? String(defecto), 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : defecto;
}

/** Primera categoría del JSON de categorías dominantes del expediente. */
function categoriaDominanteDe(json: Prisma.JsonValue | null): string | null {
    if (!Array.isArray(json)) return null;
    const primera = json[0];
    return typeof primera === "string" ? primera : null;
}

/** Señal comunitaria del informe como objeto plano (defensivo, sin `any`). */
function senalComunitariaDe(json: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (json && typeof json === "object" && !Array.isArray(json)) {
        return json as Record<string, unknown>;
    }
    return null;
}

export interface ItemBandejaConsolidacion {
    id: string;
    expedienteId: string;
    tipo: "CONSOLIDACION_EXPEDIENTE";
    estadoAprobacion: string;
    identificadorPrincipal: string;
    estadoExpediente: EstadoExpediente;
    categoriaDominante: string | null;
    sla: SlaInfo;
    aprobacionesActuales: number;
    aprobacionesRequeridas: number;
    createdAt: string;
}

/** FR-001/FR-004: bandeja de consolidaciones pendientes con SLA en Bogotá. */
export async function listarBandejaConsolidacion(paginacion: { page: number; pageSize: number }) {
    const repo = new InformeConsolidadoRepository();
    const [resultado, slaHoras, requeridas] = await Promise.all([
        repo.listarPendientesConsolidacion(paginacion),
        numParam(PARAM_SLA_HORAS_CONSOLIDACION, DEFAULT_SLA_HORAS),
        numParam(PARAM_MIEMBROS_MINIMOS, DEFAULT_MIEMBROS_MINIMOS),
    ]);

    const items: ItemBandejaConsolidacion[] = resultado.items.map((informe) => ({
        id: informe.id,
        expedienteId: informe.expedienteId,
        tipo: "CONSOLIDACION_EXPEDIENTE",
        estadoAprobacion: informe.estadoAprobacion,
        identificadorPrincipal: informe.expediente.identificadorReportado,
        estadoExpediente: informe.expediente.estado,
        categoriaDominante: categoriaDominanteDe(informe.expediente.categoriasDominantesJson),
        sla: construirSla(informe.createdAt, slaHoras),
        aprobacionesActuales: parseAprobaciones(informe.aprobadoPorMiembrosJson).length,
        aprobacionesRequeridas: requeridas,
        createdAt: informe.createdAt.toISOString(),
    }));

    return { items, pagination: resultado.pagination };
}

/** Resuelve el informe vigente (última versión) del expediente o 404. */
async function requerirInformeVigente(expedienteId: string) {
    const informe = await new InformeConsolidadoRepository().obtenerUltimaVersion(expedienteId);
    if (!informe) {
        throw new AppError(
            "No existe un informe consolidado para este expediente",
            ERROR_CODES.NOT_FOUND,
            404
        );
    }
    return informe;
}

/** FR-005/FR-011: detalle completo para la vista de consolidación. */
export async function obtenerDetalleConsolidacion(expedienteId: string) {
    const informe = await requerirInformeVigente(expedienteId);
    const [expediente, patrones, guias, slaHoras, requeridas] = await Promise.all([
        new ExpedienteRepository().obtenerExpedientePorId(expedienteId),
        new PatronExpedienteRepository().listarPorExpediente(expedienteId),
        new GuiaAccionRepository().listar({ estado: EstadoGuiaAccion.ACTIVA, page: 1, pageSize: 100 }),
        numParam(PARAM_SLA_HORAS_CONSOLIDACION, DEFAULT_SLA_HORAS),
        numParam(PARAM_MIEMBROS_MINIMOS, DEFAULT_MIEMBROS_MINIMOS),
    ]);
    if (!expediente) {
        throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    const categoriaDominante = categoriaDominanteDe(expediente.categoriasDominantesJson);
    const guiasDisponibles = guias.items.map((g) => ({
        id: g.id,
        categoria: g.categoria,
        nombre: g.categoriaBadgeTexto || g.tituloEmocional,
    }));
    // FR-011: la guía sugerida por defecto es la de la categoría dominante.
    const guiaSugerida =
        informe.guiaAccionCategoriaIdPrincipal ??
        guias.items.find((g) => g.categoria === categoriaDominante)?.id ??
        null;

    return {
        informe: {
            id: informe.id,
            expedienteId: informe.expedienteId,
            estadoAprobacion: informe.estadoAprobacion,
            resumenTextoGenerado: informe.resumenTextoGenerado,
            guiaAccionCategoriaIdPrincipal: guiaSugerida,
            aprobaciones: parseAprobaciones(informe.aprobadoPorMiembrosJson),
            correcciones: parseCorrecciones(informe.correccionesJson).map(
                ({ textoAnterior: _t, textoNuevo: _n, ...meta }) => meta
            ),
            motivoDevolucion: informe.motivoDevolucion,
            aprobacionesRequeridas: requeridas,
            createdAt: informe.createdAt.toISOString(),
            updatedAt: informe.updatedAt.toISOString(),
        },
        expediente: {
            id: expediente.id,
            estado: expediente.estado,
            identificadorPrincipal: expediente.identificadorReportado,
            categoriaDominante,
            scoreGravedadActual: expediente.scoreGravedadActual,
            numEventos: expediente.numEventos,
            fechaApertura: expediente.fechaApertura.toISOString(),
            sla: construirSla(informe.createdAt, slaHoras),
            eventos: expediente.eventos.map((e) => ({
                id: e.id,
                ordenSecuencial: e.ordenSecuencial,
                fecha: e.fechaEvento.toISOString(),
                descripcion: e.texto,
                categoriaDetectada: e.categoriaDetectada,
                plataforma: e.plataforma,
            })),
        },
        patrones: patrones.map((p) => ({
            id: p.id,
            tipo: p.tipoPatron,
            severidad: p.severidad,
            descripcion: p.descripcionTexto,
            nivelConfianza: p.nivelConfianza,
        })),
        senalComunitaria: senalComunitariaDe(informe.senalComunitariaJson),
        guiasDisponibles,
    };
}

export interface ResultadoAprobacionServicio {
    informeId: string;
    aprobo: boolean;
    yaAprobado: boolean;
    aprobacionesActuales: number;
    aprobacionesRequeridas: number;
    transicion?: { estadoAnterior: EstadoExpediente; estadoNuevo: EstadoExpediente };
    evento?: "expediente.comite.aprobo";
}

/**
 * FR-007/FR-008: aprobación multi-miembro. Al alcanzar el umbral invoca
 * `aplicarTransicion(expedienteId, EN_APROBACION_PADRE)` (SPEC-236), que
 * publica `expediente.comite.aprobo` exactamente una vez (la guarda del motor
 * exige el informe APROBADO, que este flujo garantiza antes de transicionar).
 */
export async function aprobarInforme(
    expedienteId: string,
    miembro: MiembroComite
): Promise<ResultadoAprobacionServicio> {
    const informe = await requerirInformeVigente(expedienteId);
    const requeridas = await numParam(PARAM_MIEMBROS_MINIMOS, DEFAULT_MIEMBROS_MINIMOS);

    const resultado = await new InformeConsolidadoRepository().aprobarPorMiembro(
        informe.id,
        miembro,
        requeridas
    );

    const base: ResultadoAprobacionServicio = {
        informeId: informe.id,
        aprobo: resultado.aprobo,
        yaAprobado: resultado.yaAprobado,
        aprobacionesActuales: parseAprobaciones(resultado.informe.aprobadoPorMiembrosJson).length,
        aprobacionesRequeridas: requeridas,
    };

    if (!resultado.aprobo) return base;

    const actualizado = await aplicarTransicion({
        expedienteId,
        estadoDestino: EstadoExpediente.EN_APROBACION_PADRE,
        motivo: "Aprobación colegiada del comité de validación",
        actor: { id: miembro.id, tipo: "usuario", rol: "COMITE_VALIDACION" },
    });

    return {
        ...base,
        transicion: { estadoAnterior: EstadoExpediente.PENDIENTE_COMITE, estadoNuevo: actualizado.estado },
        evento: "expediente.comite.aprobo",
    };
}

/** FR-009/FR-011: corrección append-only del resumen (+ guía de acción). */
export async function corregirInforme(
    expedienteId: string,
    miembro: MiembroComite,
    input: { resumenTextoGenerado: string; motivo: string; guiaAccionCategoriaIdPrincipal?: string | undefined }
) {
    const informe = await requerirInformeVigente(expedienteId);
    const actualizado = await new InformeConsolidadoRepository().corregirTexto(
        informe.id,
        miembro,
        input.resumenTextoGenerado,
        input.motivo,
        input.guiaAccionCategoriaIdPrincipal
    );
    return {
        id: actualizado.id,
        estadoAprobacion: actualizado.estadoAprobacion,
        resumenTextoGenerado: actualizado.resumenTextoGenerado,
        guiaAccionCategoriaIdPrincipal: actualizado.guiaAccionCategoriaIdPrincipal,
        correcciones: parseCorrecciones(actualizado.correccionesJson).map(
            ({ textoAnterior: _t, textoNuevo: _n, ...meta }) => meta
        ),
    };
}

/** FR-010: devolución con motivo obligatorio. */
export async function devolverInforme(expedienteId: string, miembro: MiembroComite, motivo: string) {
    const informe = await requerirInformeVigente(expedienteId);
    const actualizado = await new InformeConsolidadoRepository().devolverConMotivo(
        informe.id,
        miembro,
        motivo
    );
    return {
        id: actualizado.id,
        estadoAprobacion: actualizado.estadoAprobacion,
        motivoDevolucion: actualizado.motivoDevolucion,
    };
}

/** Estados del informe en los que el comité puede actuar (botones habilitados). */
export function estadoPermiteAccion(estadoAprobacion: string): boolean {
    return estadoAprobacion === "PENDIENTE_COMITE" || estadoAprobacion === "CORREGIDO";
}
