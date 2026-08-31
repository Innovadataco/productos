/**
 * SPEC-230 (002-PI-130): repositorio del agregado Expediente / EventoExpediente.
 * Frontera DAL (Q-3): todo acceso a estas entidades pasa por aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { EstadoExpediente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import type { DbClient } from "../unit-of-work";
import { withUnitOfWork } from "../unit-of-work";

const MAX_TEXT_LENGTH = 2000;

export interface CrearExpedienteInput {
    padreUsuarioId: string;
    identificadorReportado: string;
    plataformaId?: string;
    fechaApertura?: Date;
}

export interface ReporteACrearInput {
    identificador?: string;
    plataformaId?: string;
    texto?: string;
    fechaIncidente?: Date;
    ciudad?: string;
    pais?: string;
    esAnonimo?: boolean;
}

export interface AgregarEventoInput {
    expedienteId: string;
    texto: string;
    fechaEvento?: Date;
    plataforma?: string;
    reporteId?: string;
    reporteACrear?: ReporteACrearInput;
    adjuntosMetaJson?: Prisma.InputJsonValue;
}

export interface PaginacionInput {
    page: number;
    pageSize: number;
}

export class ExpedienteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Crea un expediente nuevo en estado ACTIVO con score VERDE. */
    async crearExpediente(input: CrearExpedienteInput) {
        return this.db.expediente.create({
            data: {
                padreUsuarioId: input.padreUsuarioId,
                identificadorReportado: input.identificadorReportado,
                plataformaId: input.plataformaId ?? null,
                fechaApertura: input.fechaApertura ?? new Date(),
                estado: EstadoExpediente.ACTIVO,
                scoreGravedadActual: "VERDE",
                numEventos: 0,
            },
        });
    }

    /**
     * Agrega un evento a un expediente de forma atómica.
     * Si no se recibe `reporteId`, crea un Reporte asociado con los datos
     * proporcionados o con defaults derivados del expediente.
     * Rechaza operaciones sobre expedientes CERRADO.
     */
    async agregarEvento(input: AgregarEventoInput) {
        const fechaEvento = input.fechaEvento ?? new Date();

        if (input.texto.length > MAX_TEXT_LENGTH) {
            throw new AppError(
                `El texto del evento no puede superar ${MAX_TEXT_LENGTH} caracteres`,
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        // Si ya nos inyectaron una tx, no anidamos transacciones.
        if (this.db !== prisma) {
            return this.agregarEventoEnTransaccion(input, fechaEvento);
        }

        return withUnitOfWork(async (tx) => {
            const repoTx = new ExpedienteRepository(tx);
            return repoTx.agregarEventoEnTransaccion(input, fechaEvento);
        });
    }

    private async agregarEventoEnTransaccion(
        input: AgregarEventoInput,
        fechaEvento: Date
    ) {
        // Bloquea la fila del expediente para garantizar orden secuencial monotónico.
        const expediente = await this.db.expediente.update({
            where: { id: input.expedienteId },
            data: { updatedAt: new Date() },
        });

        if (!expediente) {
            throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        if (expediente.estado === EstadoExpediente.CERRADO) {
            throw new AppError(
                "No se pueden agregar eventos a un expediente cerrado",
                ERROR_CODES.CONFLICT,
                409
            );
        }

        const ordenSecuencial = await this.siguienteOrdenSecuencial(expediente.id);
        const reporteId = input.reporteId ?? (await this.crearReporteVinculado(expediente, input, fechaEvento));

        const eventoData: Prisma.EventoExpedienteUncheckedCreateInput = {
            expedienteId: expediente.id,
            ordenSecuencial,
            reporteId,
            fechaEvento,
            texto: input.texto,
            plataforma: input.plataforma ?? null,
        };
        if (input.adjuntosMetaJson !== undefined) {
            eventoData.adjuntosMetaJson = input.adjuntosMetaJson;
        }

        const evento = await this.db.eventoExpediente.create({ data: eventoData });

        await this.db.expediente.update({
            where: { id: expediente.id },
            data: {
                numEventos: { increment: 1 },
                ultimoEventoEn: fechaEvento,
            },
        });

        return evento;
    }

    private async siguienteOrdenSecuencial(expedienteId: string) {
        const ultimoEvento = await this.db.eventoExpediente.findFirst({
            where: { expedienteId },
            orderBy: { ordenSecuencial: "desc" },
            select: { ordenSecuencial: true },
        });
        return (ultimoEvento?.ordenSecuencial ?? 0) + 1;
    }

    private async crearReporteVinculado(
        expediente: Prisma.ExpedienteGetPayload<{}>,
        input: AgregarEventoInput,
        fechaEvento: Date
    ) {
        const plataformaClave =
            input.reporteACrear?.plataformaId ?? expediente.plataformaId ?? "otro";
        const plataformaId = await this.resolverPlataformaId(plataformaClave);

        const reporte = await this.db.reporte.create({
            data: {
                identificador:
                    input.reporteACrear?.identificador ?? expediente.identificadorReportado,
                plataformaId,
                texto: input.reporteACrear?.texto ?? input.texto,
                fechaIncidente: input.reporteACrear?.fechaIncidente ?? fechaEvento,
                ciudad: input.reporteACrear?.ciudad ?? "No especificado",
                pais: input.reporteACrear?.pais ?? "No especificado",
                esAnonimo: input.reporteACrear?.esAnonimo ?? false,
            },
        });
        return reporte.id;
    }

    private async resolverPlataformaId(clave: string) {
        const plataforma = await this.db.plataforma.findUnique({
            where: { clave },
            select: { id: true },
        });
        if (plataforma) return plataforma.id;

        const otro = await this.db.plataforma.findUnique({
            where: { clave: "otro" },
            select: { id: true },
        });
        if (otro) return otro.id;

        throw new AppError(
            "No existe la plataforma 'otro' en el catálogo",
            ERROR_CODES.INTERNAL_ERROR,
            500
        );
    }

    /** Lista los expedientes de un padre ordenados por updatedAt DESC. */
    async listarExpedientesDePadre(
        padreUsuarioId: string,
        paginacion: PaginacionInput = { page: 1, pageSize: 25 }
    ) {
        const page = Math.max(1, paginacion.page);
        const pageSize = Math.min(100, Math.max(1, paginacion.pageSize));
        const skip = (page - 1) * pageSize;

        const [items, total] = await Promise.all([
            this.db.expediente.findMany({
                where: { padreUsuarioId },
                orderBy: { updatedAt: "desc" },
                skip,
                take: pageSize,
            }),
            this.db.expediente.count({ where: { padreUsuarioId } }),
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

    /**
     * SPEC-233 (002-PI-133): lista los expedientes de un padre sobre un
     * identificador reportado exacto, ordenados por fechaApertura DESC
     * (nuevo → anterior). Aditivo; no modifica métodos existentes.
     */
    async listarExpedientesDePadrePorIdentificador(
        padreUsuarioId: string,
        identificadorReportado: string,
        paginacion: PaginacionInput = { page: 1, pageSize: 25 }
    ) {
        const page = Math.max(1, paginacion.page);
        const pageSize = Math.min(100, Math.max(1, paginacion.pageSize));
        const skip = (page - 1) * pageSize;
        const where: Prisma.ExpedienteWhereInput = { padreUsuarioId, identificadorReportado };

        const [items, total] = await Promise.all([
            this.db.expediente.findMany({
                where,
                orderBy: { fechaApertura: "desc" },
                skip,
                take: pageSize,
            }),
            this.db.expediente.count({ where }),
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

    /**
     * SPEC-233 (002-PI-133): lista anonimizada de TODOS los expedientes de la
     * plataforma sobre un identificador (vista admin/comité, Ley 1581).
     * El `select` explícito garantiza que `padreUsuarioId`, eventos, JSON de
     * categorías/patrones y cualquier texto jamás salen de la capa de datos.
     */
    async listarExpedientesPorIdentificadorAnonimo(identificadorReportado: string) {
        return this.db.expediente.findMany({
            where: { identificadorReportado },
            orderBy: { fechaApertura: "desc" },
            select: {
                estado: true,
                scoreGravedadActual: true,
                fechaApertura: true,
                fechaCierre: true,
                numEventos: true,
                plataformaId: true,
            },
        });
    }

    /**
     * Obtiene un expediente por id, opcionalmente filtrando por padre.
     * Incluye sus eventos ordenados por ordenSecuencial ascendente.
     */
    async obtenerExpedientePorId(id: string, padreUsuarioId?: string) {
        const where: Prisma.ExpedienteWhereUniqueInput = { id };
        const expediente = await this.db.expediente.findUnique({
            where,
            include: {
                eventos: { orderBy: { ordenSecuencial: "asc" } },
            },
        });

        if (!expediente) return null;
        if (padreUsuarioId && expediente.padreUsuarioId !== padreUsuarioId) {
            return null;
        }
        return expediente;
    }

    /**
     * SPEC-323 (T009): busca el expediente ACTIVO de un padre para un
     * identificador dado. Retorna null si no existe — el flujo de vinculación
     * usa este método para decidir si crear o reutilizar.
     */
    async buscarExpedienteActivo(padreUsuarioId: string, identificadorReportado: string) {
        return this.db.expediente.findFirst({
            where: {
                padreUsuarioId,
                identificadorReportado,
                estado: EstadoExpediente.ACTIVO,
            },
        });
    }

    /**
     * SPEC-323 (T014/US3): detalle del expediente para su dueño.
     * - eventosPropios: eventos del padre con texto descifrado (AD-3 opción C).
     * - contextoOtros: solo 4 campos de los eventos de otros (Ley 1581 § SELECT).
     *
     * C/AD-3: el expediente es documento probatorio del dueño (spec 090/116 acotada,
     * no derogada); descifrado server-side solo para el padreUsuarioId dueño,
     * nunca para ajenos, sin persistir.
     */
    async obtenerDetalleExpediente(id: string, padreUsuarioId: string) {
        const expediente = await this.db.expediente.findUnique({
            where: { id },
            select: {
                id: true,
                padreUsuarioId: true,
                identificadorReportado: true,
                estado: true,
                scoreGravedadActual: true,
                fechaApertura: true,
                numEventos: true,
            },
        });

        if (!expediente || expediente.padreUsuarioId !== padreUsuarioId) return null;

        // Eventos propios: todos los campos + texto descifrado de su Reporte.
        const eventosPropiosRaw = await this.db.eventoExpediente.findMany({
            where: { expedienteId: id, expediente: { padreUsuarioId } },
            orderBy: { ordenSecuencial: "asc" },
            select: {
                id: true,
                ordenSecuencial: true,
                fechaEvento: true,
                texto: true,
                plataforma: true,
                reporteId: true,
                reporte: {
                    select: {
                        texto: true,
                        ciudad: true,
                        pais: true,
                        fechaIncidente: true,
                        clasificacion: { select: { categoria: true, confianza: true } },
                    },
                },
            },
        });

        const eventosPropios = eventosPropiosRaw.map((ev) => ({
            ...ev,
            // C/AD-3: descifrado en memoria, no persistido.
            textoDescifrado: ev.reporte?.texto ? descifrarTextoReporte(ev.reporte.texto) : "",
        }));

        // Contexto de otros: solo fecha/ciudad/país/clasificación (Ley 1581 § SELECT).
        const contextoOtros = await this.db.eventoExpediente.findMany({
            where: {
                expediente: {
                    identificadorReportado: expediente.identificadorReportado,
                    padreUsuarioId: { not: padreUsuarioId },
                },
            },
            orderBy: { fechaEvento: "asc" },
            select: {
                fechaEvento: true,
                reporte: {
                    select: {
                        ciudad: true,
                        pais: true,
                        clasificacion: { select: { categoria: true, confianza: true } },
                    },
                },
            },
        });

        return { expediente, eventosPropios, contextoOtros };
    }
}
