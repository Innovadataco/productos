/**
 * SPEC-053 (US3, módulo Comité): ComiteIntegrantesService.
 * Padrón de integrantes del comité de validación (alta, edición, baja lógica).
 * `numeroIdentificacion` viaja cifrado en reposo (AES-256-GCM vía
 * `src/lib/param-encryption.ts`); la serialización pública lo descifra.
 * Auditoría COMITE_INTEGRANTE_* por mutación. Acepta tx opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { encryptParameter, decryptParameter } from "@/lib/param-encryption";
import { IntegranteComiteRepository, type IntegranteComiteConComite } from "../repositories/integrante-comite";
import { UsuarioRepository } from "../repositories/usuario";
import type { InfoClienteDto } from "../types/operador";
import type { ActualizarIntegranteInput, CrearIntegranteInput } from "../types/comite";

interface IntegranteRow {
    id: string;
    comiteId: string;
    nombres: string;
    apellidos: string;
    tipoIdentificacion: string;
    numeroIdentificacion: string;
    email: string;
    fechaInicio: Date;
    fechaFin: Date | null;
    estado: string;
    creadoPorId: string;
    modificadoPorId: string | null;
    creadoEn: Date;
    actualizadoEn: Date;
}

function serializarIntegrante(integrante: IntegranteRow) {
    return {
        id: integrante.id,
        comiteId: integrante.comiteId,
        nombres: integrante.nombres,
        apellidos: integrante.apellidos,
        tipoIdentificacion: integrante.tipoIdentificacion,
        numeroIdentificacion: decryptParameter(integrante.numeroIdentificacion),
        email: integrante.email,
        fechaInicio: integrante.fechaInicio,
        fechaFin: integrante.fechaFin,
        estado: integrante.estado,
        creadoPorId: integrante.creadoPorId,
        modificadoPorId: integrante.modificadoPorId,
        creadoEn: integrante.creadoEn,
        actualizadoEn: integrante.actualizadoEn,
    };
}

export class ComiteIntegrantesService {
    private readonly integrantes: IntegranteComiteRepository;
    private readonly usuarios: UsuarioRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.integrantes = new IntegranteComiteRepository(tx);
        this.usuarios = new UsuarioRepository(tx);
    }

    /** Guarda compartida: el comité existe y tiene rol COMITE_VALIDACION (404 si no). */
    async assertComiteValido(comiteId: string) {
        const comite = await this.usuarios.findById(comiteId);
        if (!comite || comite.rol !== "COMITE_VALIDACION") {
            throw new AppError("Comité no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return comite;
    }

    /** GET /api/admin/comite/integrantes — padrón del comité (identificación descifrada). */
    async listar(comiteId: string) {
        await this.assertComiteValido(comiteId);
        const integrantes = await this.integrantes.findPorComite(comiteId);
        return { integrantes: integrantes.map(serializarIntegrante) };
    }

    /** POST /api/admin/comite/integrantes — alta con identificación cifrada y auditoría. */
    async crear(input: CrearIntegranteInput, adminId: string, info: InfoClienteDto) {
        await this.assertComiteValido(input.comiteId);

        const { comiteId, nombres, apellidos, tipoIdentificacion, numeroIdentificacion, email, fechaInicio } = input;
        const numeroIdentificacionCifrado = encryptParameter(numeroIdentificacion);

        const integrante = await this.integrantes.crear({
            comiteId,
            nombres,
            apellidos,
            tipoIdentificacion,
            numeroIdentificacion: numeroIdentificacionCifrado,
            email,
            fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
            creadoPorId: adminId,
        });

        await logAudit({
            accion: "COMITE_INTEGRANTE_CREADO",
            tipoRecurso: "IntegranteComite",
            recursoId: integrante.id,
            usuarioId: adminId,
            valorNuevo: JSON.stringify({ comiteId, nombres, apellidos, tipoIdentificacion, email }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { integrante: serializarIntegrante(integrante) };
    }

    /** Integrante con su comité (guarda compartida de PATCH/DELETE). */
    async obtenerConComite(id: string) {
        const integrante = await this.integrantes.findByIdConComite(id);
        if (!integrante) {
            throw new AppError("Integrante no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return integrante;
    }

    /** Guarda de PATCH: el integrante debe pertenecer a un comité de validación. */
    assertPerteneceAComite(integrante: { comite: { rol: string } }) {
        if (integrante.comite.rol !== "COMITE_VALIDACION") {
            throw new AppError("El integrante no pertenece a un comité de validación", ERROR_CODES.VALIDATION_ERROR, 400);
        }
    }

    /** PATCH /api/admin/comite/integrantes/[id] — edición con cifrado y auditoría. */
    async actualizar(
        integrante: IntegranteComiteConComite,
        input: ActualizarIntegranteInput,
        adminId: string,
        info: InfoClienteDto
    ) {
        const id = integrante.id;
        const { numeroIdentificacion, fechaInicio, fechaFin, estado, ...resto } = input;
        // Campo ausente ≡ no tocarlo (undefined nunca llega a Prisma).
        const data: Prisma.IntegranteComiteUncheckedUpdateInput = {
            ...(resto.nombres !== undefined ? { nombres: resto.nombres } : {}),
            ...(resto.apellidos !== undefined ? { apellidos: resto.apellidos } : {}),
            ...(resto.tipoIdentificacion !== undefined ? { tipoIdentificacion: resto.tipoIdentificacion } : {}),
            ...(resto.email !== undefined ? { email: resto.email } : {}),
        };
        if (numeroIdentificacion) {
            data.numeroIdentificacion = encryptParameter(numeroIdentificacion);
        }
        if (fechaInicio) {
            data.fechaInicio = new Date(fechaInicio);
        }
        if (fechaFin) {
            data.fechaFin = new Date(fechaFin);
        }
        if (estado) {
            data.estado = estado;
            if (estado === "INACTIVO" && integrante.estado !== "INACTIVO") {
                data.fechaFin = new Date();
            }
        }
        data.modificadoPorId = adminId;

        const actualizado = await this.integrantes.actualizar(id, data);

        await logAudit({
            accion: "COMITE_INTEGRANTE_ACTUALIZADO",
            tipoRecurso: "IntegranteComite",
            recursoId: id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({
                nombres: integrante.nombres,
                apellidos: integrante.apellidos,
                tipoIdentificacion: integrante.tipoIdentificacion,
                email: integrante.email,
                estado: integrante.estado,
            }),
            valorNuevo: JSON.stringify({
                nombres: actualizado.nombres,
                apellidos: actualizado.apellidos,
                tipoIdentificacion: actualizado.tipoIdentificacion,
                email: actualizado.email,
                estado: actualizado.estado,
            }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { integrante: serializarIntegrante(actualizado) };
    }

    /** DELETE /api/admin/comite/integrantes/[id] — baja lógica (idempotente, sin auditoría si ya inactivo). */
    async inactivar(id: string, adminId: string, info: InfoClienteDto) {
        const integrante = await this.obtenerConComite(id);

        if (integrante.estado === "INACTIVO") {
            return { integrante: serializarIntegrante(integrante) };
        }

        const actualizado = await this.integrantes.actualizar(id, {
            estado: "INACTIVO",
            fechaFin: new Date(),
            modificadoPorId: adminId,
        });

        await logAudit({
            accion: "COMITE_INTEGRANTE_INACTIVADO",
            tipoRecurso: "IntegranteComite",
            recursoId: id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ estado: integrante.estado }),
            valorNuevo: JSON.stringify({ estado: "INACTIVO" }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { integrante: serializarIntegrante(actualizado) };
    }
}
