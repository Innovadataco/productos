/**
 * SPEC-168 (Fase F): servicio de la cuenta compartida del Comité de Convivencia.
 */
import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { Prisma } from "@prisma/client";
import { ComiteConvivenciaRepository } from "../repositories/comite-convivencia";
import type { InfoClienteDto, ComiteCuentaDto } from "../types/comite-convivencia";

export { type InfoClienteDto };

function tempPassword(): string {
    return randomBytes(6).toString("hex");
}

function toDto(row: {
    id: string;
    email: string;
    estado: string;
    debeCambiarPassword: boolean;
    ultimaSesion: Date | null;
    creadoEn: Date;
}): ComiteCuentaDto {
    return {
        id: row.id,
        email: row.email,
        estado: row.estado,
        debeCambiarPassword: row.debeCambiarPassword,
        ultimaSesion: row.ultimaSesion?.toISOString() ?? null,
        creadoEn: row.creadoEn.toISOString(),
    };
}

export class ComiteConvivenciaService {
    private readonly repo: ComiteConvivenciaRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.repo = new ComiteConvivenciaRepository(tx);
    }

    async obtenerCuenta(colegioId: string): Promise<ComiteCuentaDto | null> {
        const cuenta = await this.repo.obtenerPorColegio(colegioId);
        return cuenta ? toDto(cuenta) : null;
    }

    async crearCuenta(
        colegioId: string,
        email: string,
        actorId: string,
        info: InfoClienteDto
    ): Promise<{ cuenta: ComiteCuentaDto; passwordTemporal: string }> {
        const existente = await this.repo.obtenerPorColegio(colegioId);
        if (existente) {
            throw new AppError("El colegio ya tiene una cuenta de comité", ERROR_CODES.CONFLICT, 409);
        }

        const emailEnUso = await this.repo.obtenerPorEmail(email.toLowerCase());
        if (emailEnUso) {
            throw new AppError("El email ya está registrado", ERROR_CODES.CONFLICT, 409);
        }

        const passwordTemporal = tempPassword();
        const passwordHash = await hashPassword(passwordTemporal);

        const cuenta = await this.repo.crear({
            email: email.toLowerCase(),
            passwordHash,
            rol: "COMITE_CONVIVENCIA" as never,
            estado: "activo",
            debeCambiarPassword: true,
            comiteColegioId: colegioId,
        });

        await logAudit({
            accion: "COLEGIO_COMITE_CREADO",
            tipoRecurso: "Usuario",
            recursoId: cuenta.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ email: cuenta.email, rol: "COMITE_CONVIVENCIA" }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { cuenta: toDto(cuenta), passwordTemporal };
    }

    async regenerarPassword(
        colegioId: string,
        actorId: string,
        info: InfoClienteDto
    ): Promise<{ cuenta: ComiteCuentaDto; passwordTemporal: string }> {
        const cuenta = await this.repo.obtenerPorColegio(colegioId);
        if (!cuenta) {
            throw new AppError("Cuenta del comité no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const passwordTemporal = tempPassword();
        const passwordHash = await hashPassword(passwordTemporal);
        const actualizada = await this.repo.actualizarPassword(cuenta.id, passwordHash);

        await logAudit({
            accion: "COLEGIO_COMITE_PASSWORD_REGENERADA",
            tipoRecurso: "Usuario",
            recursoId: actualizada.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ debeCambiarPassword: true }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { cuenta: toDto(actualizada), passwordTemporal };
    }
}
