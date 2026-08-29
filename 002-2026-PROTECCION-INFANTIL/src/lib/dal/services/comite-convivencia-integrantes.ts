/**
 * SPEC-168 (Fase F): servicio del padrón documentado de integrantes del Comité
 * de Convivencia. El cifrado/descifrado vive en el repositorio.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import type { Prisma, TipoIdentificacionIntegrante } from "@prisma/client";
import { ComiteConvivenciaRepository } from "../repositories/comite-convivencia";
import {
    ComiteConvivenciaIntegrantesRepository,
    type IntegranteComiteDescifrado,
} from "../repositories/comite-convivencia-integrantes";
import type { IntegranteComiteDto, InfoClienteDto } from "../types/comite-convivencia";

export interface CrearIntegranteInput {
    nombres: string;
    apellidos: string;
    tipoIdentificacion: TipoIdentificacionIntegrante;
    numeroIdentificacion: string;
    email: string;
    cargo: string;
}

export interface ActualizarIntegranteInput {
    nombres?: string;
    apellidos?: string;
    tipoIdentificacion?: TipoIdentificacionIntegrante;
    numeroIdentificacion?: string;
    email?: string;
    cargo?: string;
}

function toDto(row: IntegranteComiteDescifrado): IntegranteComiteDto {
    return {
        id: row.id,
        comiteId: row.comiteId,
        nombres: row.nombres,
        apellidos: row.apellidos,
        tipoIdentificacion: row.tipoIdentificacion,
        numeroIdentificacion: row.numeroIdentificacion,
        email: row.email,
        cargo: row.cargo,
        estado: row.estado,
        fechaInicio: row.fechaInicio.toISOString(),
        fechaFin: row.fechaFin?.toISOString() ?? null,
    };
}

export class ComiteConvivenciaIntegrantesService {
    private readonly integrantes: ComiteConvivenciaIntegrantesRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.integrantes = new ComiteConvivenciaIntegrantesRepository(tx);
    }

    private async comiteIdDeColegio(colegioId: string): Promise<string> {
        const cuenta = await new ComiteConvivenciaRepository().obtenerPorColegio(colegioId);
        if (!cuenta) {
            throw new AppError("Cuenta del comité no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        return cuenta.id;
    }

    async listar(colegioId: string): Promise<IntegranteComiteDto[]> {
        const comiteId = await this.comiteIdDeColegio(colegioId);
        const rows = await this.integrantes.listarPorComite(comiteId);
        return rows.map(toDto);
    }

    async crear(
        colegioId: string,
        input: CrearIntegranteInput,
        actorId: string,
        info: InfoClienteDto
    ): Promise<IntegranteComiteDto> {
        const comiteId = await this.comiteIdDeColegio(colegioId);

        const duplicado = await this.integrantes.existeDocumentoEnComite(comiteId, input.numeroIdentificacion);
        if (duplicado) {
            throw new AppError("Ya existe un integrante con ese número de identificación", ERROR_CODES.CONFLICT, 409);
        }

        const row = await this.integrantes.crear({ ...input, comiteId, creadoPorId: actorId });

        await logAudit({
            accion: "COLEGIO_COMITE_INTEGRANTE_CREADO",
            tipoRecurso: "IntegranteComite",
            recursoId: row.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ comiteId, nombres: input.nombres, apellidos: input.apellidos, cargo: input.cargo }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return toDto(row);
    }

    async actualizar(
        colegioId: string,
        integranteId: string,
        input: ActualizarIntegranteInput,
        actorId: string,
        info: InfoClienteDto
    ): Promise<IntegranteComiteDto> {
        const comiteId = await this.comiteIdDeColegio(colegioId);
        const existente = await this.integrantes.obtenerPorId(integranteId);
        if (!existente || existente.comiteId !== comiteId) {
            throw new AppError("Integrante no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        if (input.numeroIdentificacion && input.numeroIdentificacion !== existente.numeroIdentificacion) {
            const duplicado = await this.integrantes.existeDocumentoEnComite(comiteId, input.numeroIdentificacion);
            if (duplicado) {
                throw new AppError("Ya existe un integrante con ese número de identificación", ERROR_CODES.CONFLICT, 409);
            }
        }

        const payload: Prisma.IntegranteComiteUncheckedUpdateInput = { modificadoPorId: actorId };
        for (const [key, value] of Object.entries(input)) {
            if (value !== undefined) {
                (payload as Record<string, unknown>)[key] = value;
            }
        }

        const row = await this.integrantes.actualizar(integranteId, payload);

        await logAudit({
            accion: "COLEGIO_COMITE_INTEGRANTE_ACTUALIZADO",
            tipoRecurso: "IntegranteComite",
            recursoId: row.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ campos: Object.keys(input) }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return toDto(row);
    }

    async cambiarEstado(
        colegioId: string,
        integranteId: string,
        estado: "ACTIVO" | "INACTIVO",
        actorId: string,
        info: InfoClienteDto
    ): Promise<IntegranteComiteDto> {
        const comiteId = await this.comiteIdDeColegio(colegioId);
        const existente = await this.integrantes.obtenerPorId(integranteId);
        if (!existente || existente.comiteId !== comiteId) {
            throw new AppError("Integrante no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const fechaFin: Date | null = estado === "INACTIVO" ? new Date() : null;
        const data: Prisma.IntegranteComiteUncheckedUpdateInput = {
            estado,
            modificadoPorId: actorId,
            fechaFin,
        };

        const row = await this.integrantes.actualizar(integranteId, data);

        await logAudit({
            accion:
                estado === "INACTIVO"
                    ? "COLEGIO_COMITE_INTEGRANTE_INACTIVADO"
                    : "COLEGIO_COMITE_INTEGRANTE_ACTUALIZADO",
            tipoRecurso: "IntegranteComite",
            recursoId: row.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ estado, fechaFin: fechaFin?.toISOString() ?? null }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return toDto(row);
    }
}
