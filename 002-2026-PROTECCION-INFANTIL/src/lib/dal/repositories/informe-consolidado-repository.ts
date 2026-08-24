/**
 * SPEC-234 (002-PI-134): repositorio del agregado InformeConsolidado.
 * Frontera DAL (Q-3): todo acceso a estas entidades pasa por aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import type { DbClient } from "../unit-of-work";
import { withUnitOfWork } from "../unit-of-work";

export interface CrearInformeInput {
    expedienteId: string;
    versionSecuencial: number;
    scoreValor: number;
    scoreGravedad: string;
    categoriasDetectadasJson: Prisma.InputJsonValue;
    patronesDetectadosJson?: Prisma.InputJsonValue | undefined;
    senalComunitariaJson?: Prisma.InputJsonValue | undefined;
    resumenTextoGenerado: string;
    pdfUrl?: string | undefined;
    pdfHash?: string | undefined;
    pdfGeneradoEn?: Date | undefined;
    generadoPorId?: string | undefined;
    tipoRevision?: string | undefined;
    guiaAccionCategoriaIdPrincipal?: string | undefined;
    estadoAprobacion?: string | undefined;
    aprobadoPorMiembrosJson?: Prisma.InputJsonValue | undefined;
    correccionesJson?: Prisma.InputJsonValue | undefined;
    nivelConfianza?: number | undefined;
}

export interface PaginacionInput {
    page: number;
    pageSize: number;
}

// ── SPEC-237 (002-PI-mega-cola): tipos de la aprobación multi-miembro.

/** Estados del informe que lo mantienen en la bandeja de consolidación. */
export const ESTADOS_CONSOLIDACION_PENDIENTE = ["PENDIENTE_COMITE", "CORREGIDO"] as const;

export interface MiembroComite {
    id: string;
    nombre: string;
}

export interface AprobacionRegistro {
    miembroId: string;
    nombre: string;
    aprobadoEn: string;
}

export interface CorreccionRegistro {
    miembroId: string;
    nombre: string;
    textoAnterior: string;
    textoNuevo: string;
    motivo: string;
    corregidoEn: string;
}

export interface ResultadoAprobacion {
    informe: Prisma.InformeConsolidadoGetPayload<object>;
    /** true cuando con este voto se alcanzó el umbral y el informe quedó APROBADO. */
    aprobo: boolean;
    /** true cuando el informe ya estaba APROBADO (voto excedente ignorado). */
    yaAprobado: boolean;
}

function esRegistroConMiembro(v: unknown): v is { miembroId: string; nombre: string } {
    return (
        typeof v === "object" &&
        v !== null &&
        typeof (v as Record<string, unknown>).miembroId === "string" &&
        typeof (v as Record<string, unknown>).nombre === "string"
    );
}

/** Parse defensivo del JSON de aprobaciones (type guards, sin `any`). */
export function parseAprobaciones(json: Prisma.JsonValue | null): AprobacionRegistro[] {
    if (!Array.isArray(json)) return [];
    return json.filter(esRegistroConMiembro).map((v) => ({
        miembroId: v.miembroId,
        nombre: v.nombre,
        aprobadoEn:
            typeof (v as Record<string, unknown>).aprobadoEn === "string"
                ? ((v as Record<string, unknown>).aprobadoEn as string)
                : "",
    }));
}

/** Parse defensivo del JSON de correcciones (type guards, sin `any`). */
export function parseCorrecciones(json: Prisma.JsonValue | null): CorreccionRegistro[] {
    if (!Array.isArray(json)) return [];
    return json.filter(esRegistroConMiembro).map((v) => {
        const r = v as Record<string, unknown>;
        return {
            miembroId: v.miembroId,
            nombre: v.nombre,
            textoAnterior: typeof r.textoAnterior === "string" ? r.textoAnterior : "",
            textoNuevo: typeof r.textoNuevo === "string" ? r.textoNuevo : "",
            motivo: typeof r.motivo === "string" ? r.motivo : "",
            corregidoEn: typeof r.corregidoEn === "string" ? r.corregidoEn : "",
        };
    });
}

export class InformeConsolidadoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crearInforme(data: CrearInformeInput) {
        return this.db.informeConsolidado.create({
            data: {
                ...data,
                scoreGravedad: (data.scoreGravedad as never) ?? "VERDE",
                tipoRevision: (data.tipoRevision as never) ?? "CONSOLIDACION_EXPEDIENTE",
            } as never,
        });
    }

    obtenerPorId(id: string) {
        return this.db.informeConsolidado.findUnique({ where: { id } });
    }

    obtenerPorHash(pdfHash: string) {
        return this.db.informeConsolidado.findUnique({ where: { pdfHash } });
    }

    async listarPorExpediente(
        expedienteId: string,
        paginacion: PaginacionInput = { page: 1, pageSize: 25 }
    ) {
        const page = Math.max(1, paginacion.page);
        const pageSize = Math.min(100, Math.max(1, paginacion.pageSize));
        const skip = (page - 1) * pageSize;

        const [items, total] = await Promise.all([
            this.db.informeConsolidado.findMany({
                where: { expedienteId },
                orderBy: { versionSecuencial: "desc" },
                skip,
                take: pageSize,
            }),
            this.db.informeConsolidado.count({ where: { expedienteId } }),
        ]);

        return {
            items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    obtenerUltimaVersion(expedienteId: string) {
        return this.db.informeConsolidado.findFirst({
            where: { expedienteId },
            orderBy: { versionSecuencial: "desc" },
        });
    }

    // ── SPEC-237 (002-PI-mega-cola): bandeja comité CONSOLIDACION + aprobación
    // multi-miembro. Aditivo: no modifica los métodos de SPEC-234.

    /**
     * Lista informes pendientes de consolidación (estados `PENDIENTE_COMITE` y
     * `CORREGIDO`), los más antiguos primero (SLA). Incluye el expediente con
     * los campos que la bandeja necesita.
     */
    async listarPendientesConsolidacion(paginacion: PaginacionInput = { page: 1, pageSize: 25 }) {
        const page = Math.max(1, paginacion.page);
        const pageSize = Math.min(100, Math.max(1, paginacion.pageSize));
        const skip = (page - 1) * pageSize;
        const where: Prisma.InformeConsolidadoWhereInput = {
            estadoAprobacion: { in: [...ESTADOS_CONSOLIDACION_PENDIENTE] },
        };

        const [items, total] = await Promise.all([
            this.db.informeConsolidado.findMany({
                where,
                orderBy: { createdAt: "asc" },
                skip,
                take: pageSize,
                include: {
                    expediente: {
                        select: {
                            id: true,
                            estado: true,
                            identificadorReportado: true,
                            categoriasDominantesJson: true,
                            scoreGravedadActual: true,
                        },
                    },
                },
            }),
            this.db.informeConsolidado.count({ where }),
        ]);

        return {
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        };
    }

    /**
     * Registra la aprobación de un miembro del comité. Idempotente por miembro
     * (duplicado → 409). Si con este voto se alcanza `umbral` aprobaciones de
     * miembros distintos, el informe pasa a `APROBADO` y `aprobo` es true (la
     * transición del expediente la orquesta el servicio). Si el informe ya
     * estaba `APROBADO`, el voto excedente se ignora (`yaAprobado: true`).
     */
    async aprobarPorMiembro(
        informeId: string,
        miembro: MiembroComite,
        umbral: number
    ): Promise<ResultadoAprobacion> {
        return withUnitOfWork(async (tx) => {
            // Bloquea la fila: serializa aprobaciones simultáneas (edge case).
            await tx.informeConsolidado.update({
                where: { id: informeId },
                data: { updatedAt: new Date() },
            });
            const informe = await tx.informeConsolidado.findUnique({ where: { id: informeId } });
            if (!informe) {
                throw new AppError("Informe consolidado no encontrado", ERROR_CODES.NOT_FOUND, 404);
            }
            if (informe.estadoAprobacion === "APROBADO") {
                return { informe, aprobo: false, yaAprobado: true };
            }
            if (informe.estadoAprobacion === "DEVUELTO") {
                throw new AppError(
                    "El informe fue devuelto; no admite aprobaciones hasta una nueva consolidación",
                    ERROR_CODES.CONFLICT,
                    409
                );
            }

            const aprobaciones = parseAprobaciones(informe.aprobadoPorMiembrosJson);
            if (aprobaciones.some((a) => a.miembroId === miembro.id)) {
                throw new AppError("El miembro ya aprobó este informe", ERROR_CODES.CONFLICT, 409);
            }
            aprobaciones.push({
                miembroId: miembro.id,
                nombre: miembro.nombre,
                aprobadoEn: new Date().toISOString(),
            });

            const aprobo = aprobaciones.length >= umbral;
            const actualizado = await tx.informeConsolidado.update({
                where: { id: informeId },
                data: {
                    aprobadoPorMiembrosJson: aprobaciones as unknown as Prisma.InputJsonValue,
                    ...(aprobo ? { estadoAprobacion: "APROBADO" } : {}),
                },
            });

            // Sin textos del informe: solo metadatos de la deliberación.
            await logAudit({
                accion: "INFORME_CONSOLIDADO_APROBADO",
                tipoRecurso: "InformeConsolidado",
                recursoId: informeId,
                usuarioId: miembro.id,
                metadatos: {
                    expedienteId: informe.expedienteId,
                    aprobacionesActuales: aprobaciones.length,
                    umbral,
                    alcanzoUmbral: aprobo,
                },
                tx,
            });

            return { informe: actualizado, aprobo, yaAprobado: false };
        });
    }

    /**
     * Corrige el resumen consolidado: añade un snapshot append-only a
     * `correccionesJson` (nunca borra anteriores) y deja el estado en
     * `CORREGIDO`. Opcionalmente actualiza la guía de acción principal.
     */
    async corregirTexto(
        informeId: string,
        miembro: MiembroComite,
        textoNuevo: string,
        motivo: string,
        guiaAccionCategoriaIdPrincipal?: string
    ) {
        return withUnitOfWork(async (tx) => {
            await tx.informeConsolidado.update({
                where: { id: informeId },
                data: { updatedAt: new Date() },
            });
            const informe = await tx.informeConsolidado.findUnique({ where: { id: informeId } });
            if (!informe) {
                throw new AppError("Informe consolidado no encontrado", ERROR_CODES.NOT_FOUND, 404);
            }
            if (informe.estadoAprobacion === "APROBADO" || informe.estadoAprobacion === "DEVUELTO") {
                throw new AppError(
                    `El informe está en estado ${informe.estadoAprobacion}; no admite correcciones`,
                    ERROR_CODES.CONFLICT,
                    409
                );
            }

            const correcciones = parseCorrecciones(informe.correccionesJson);
            correcciones.push({
                miembroId: miembro.id,
                nombre: miembro.nombre,
                textoAnterior: informe.resumenTextoGenerado,
                textoNuevo,
                motivo,
                corregidoEn: new Date().toISOString(),
            });

            const actualizado = await tx.informeConsolidado.update({
                where: { id: informeId },
                data: {
                    resumenTextoGenerado: textoNuevo,
                    correccionesJson: correcciones as unknown as Prisma.InputJsonValue,
                    estadoAprobacion: "CORREGIDO",
                    ...(guiaAccionCategoriaIdPrincipal !== undefined
                        ? { guiaAccionCategoriaIdPrincipal }
                        : {}),
                },
            });

            // El AuditLog registra el motivo, NUNCA los textos del informe.
            await logAudit({
                accion: "INFORME_CONSOLIDADO_CORREGIDO",
                tipoRecurso: "InformeConsolidado",
                recursoId: informeId,
                usuarioId: miembro.id,
                metadatos: {
                    expedienteId: informe.expedienteId,
                    motivo,
                    correccionesTotales: correcciones.length,
                    guiaAccionCategoriaIdPrincipal: guiaAccionCategoriaIdPrincipal ?? null,
                },
                tx,
            });

            return actualizado;
        });
    }

    /**
     * Devuelve el informe al área de origen con motivo obligatorio; el estado
     * pasa a `DEVUELTO` y sale de la bandeja de pendientes.
     */
    async devolverConMotivo(informeId: string, miembro: MiembroComite, motivo: string) {
        if (!motivo.trim()) {
            throw new AppError("El motivo es obligatorio", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        return withUnitOfWork(async (tx) => {
            await tx.informeConsolidado.update({
                where: { id: informeId },
                data: { updatedAt: new Date() },
            });
            const informe = await tx.informeConsolidado.findUnique({ where: { id: informeId } });
            if (!informe) {
                throw new AppError("Informe consolidado no encontrado", ERROR_CODES.NOT_FOUND, 404);
            }
            if (informe.estadoAprobacion === "APROBADO") {
                throw new AppError(
                    "El informe ya fue aprobado por el comité; no admite devolución",
                    ERROR_CODES.CONFLICT,
                    409
                );
            }

            const actualizado = await tx.informeConsolidado.update({
                where: { id: informeId },
                data: { estadoAprobacion: "DEVUELTO", motivoDevolucion: motivo },
            });

            await logAudit({
                accion: "INFORME_CONSOLIDADO_DEVUELTO",
                tipoRecurso: "InformeConsolidado",
                recursoId: informeId,
                usuarioId: miembro.id,
                metadatos: { expedienteId: informe.expedienteId, motivo },
                tx,
            });

            return actualizado;
        });
    }
}
