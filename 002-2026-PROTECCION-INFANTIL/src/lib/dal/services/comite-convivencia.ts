/**
 * SPEC-168 (Fase F): servicio de la cuenta compartida del Comité de Convivencia.
 */
import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { Prisma } from "@prisma/client";
import { programar as programarNotificacion } from "@/lib/notificaciones";
import { ComiteConvivenciaRepository } from "../repositories/comite-convivencia";
import type { InfoClienteDto, ComiteCuentaDto } from "../types/comite-convivencia";

export { type InfoClienteDto };

// SPEC-319 §2.2: token opaco de invitación (mismo patrón que el rector) y vigencia.
// El template del email dice "expira en 48 horas"; se mantiene el mismo valor.
const TOKEN_VIGENCIA_HORAS = 48;

function generarTokenInvitacion(): string {
    return randomBytes(32).toString("hex");
}

function expiracionInvitacion(): Date {
    return new Date(Date.now() + TOKEN_VIGENCIA_HORAS * 60 * 60 * 1000);
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

    // SPEC-319 §2.2: emite el email de invitación de la cuenta del comité por el
    // motor de notificaciones (evento propio `comite.invitacion.enviada`). El link
    // lleva el token opaco → el comité define su clave en /activar (nunca en pantalla).
    private async emitirInvitacion(cuentaId: string, colegioId: string, token: string): Promise<void> {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pi.innovadataco.com";
        const nombreColegio = await this.repo.nombreColegio(colegioId);
        await programarNotificacion({
            evento: "comite.invitacion.enviada",
            sujetoTipo: "Colegio",
            sujetoId: colegioId,
            destinatarios: [
                {
                    usuarioId: cuentaId,
                    variables: {
                        nombreColegio,
                        linkActivacion: `${baseUrl}/activar?token=${token}`,
                    },
                },
            ],
        }).catch((err: unknown) => {
            console.warn(
                "[ComiteConvivencia] No se pudo programar la invitación:",
                err instanceof Error ? err.message : err
            );
        });
    }

    async crearCuenta(
        colegioId: string,
        email: string,
        actorId: string,
        info: InfoClienteDto
    ): Promise<{ cuenta: ComiteCuentaDto; invitacionEnviada: true }> {
        const existente = await this.repo.obtenerPorColegio(colegioId);
        if (existente) {
            throw new AppError("El colegio ya tiene una cuenta de comité", ERROR_CODES.CONFLICT, 409);
        }

        const emailEnUso = await this.repo.obtenerPorEmail(email.toLowerCase());
        if (emailEnUso) {
            throw new AppError("El email ya está registrado", ERROR_CODES.CONFLICT, 409);
        }

        // SPEC-319 §2.2: la cuenta nace INVITADO con token opaco; NO se genera ni se
        // muestra contraseña. El comité la define por /activar. El hash es un
        // placeholder inutilizable hasta que se consuma el token.
        const token = generarTokenInvitacion();
        const passwordHashPlaceholder = await hashPassword(randomBytes(32).toString("hex"));

        const cuenta = await this.repo.crear({
            email: email.toLowerCase(),
            nombre: "Comité de Convivencia",
            passwordHash: passwordHashPlaceholder,
            rol: "COMITE_CONVIVENCIA" as never,
            estado: "activo",
            debeCambiarPassword: false,
            estadoActivacion: "INVITADO",
            tokenInvitacion: token,
            tokenInvitacionExpiraEn: expiracionInvitacion(),
            comiteColegioId: colegioId,
        });

        await logAudit({
            accion: "COLEGIO_COMITE_CREADO",
            tipoRecurso: "Usuario",
            recursoId: cuenta.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ email: cuenta.email, rol: "COMITE_CONVIVENCIA", estadoActivacion: "INVITADO" }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        await this.emitirInvitacion(cuenta.id, colegioId, token);

        return { cuenta: toDto(cuenta), invitacionEnviada: true };
    }

    // SPEC-319 §2.2/§2.3: reemplaza "regenerar contraseña" (que pintaba la clave).
    // Regenera el token de invitación y reenvía el email — el comité vuelve a definir
    // su clave por /activar. El secreto nunca se muestra ni viaja por chat.
    async reenviarInvitacion(
        colegioId: string,
        actorId: string,
        info: InfoClienteDto
    ): Promise<{ cuenta: ComiteCuentaDto; invitacionEnviada: true }> {
        const cuenta = await this.repo.obtenerPorColegio(colegioId);
        if (!cuenta) {
            throw new AppError("Cuenta del comité no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const token = generarTokenInvitacion();
        const actualizada = await this.repo.actualizarInvitacion(cuenta.id, token, expiracionInvitacion());

        await logAudit({
            // SPEC-319 §2.2/§2.4: valor de auditoría dedicado (agregado en la migración de §2.4).
            accion: "COLEGIO_COMITE_INVITACION_REENVIADA",
            tipoRecurso: "Usuario",
            recursoId: actualizada.id,
            usuarioId: actorId,
            colegioId,
            valorNuevo: JSON.stringify({ estadoActivacion: "INVITADO" }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        await this.emitirInvitacion(actualizada.id, colegioId, token);

        return { cuenta: toDto(actualizada), invitacionEnviada: true };
    }
}
