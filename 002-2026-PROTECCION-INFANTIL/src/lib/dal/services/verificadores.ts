/**
 * SPEC-435 (Jelkin vivo 04-09) · Servicio de cuentas VERIFICADOR.
 *
 * Molde: `OperadorService` (SPEC-053), simplificado. Un VERIFICADOR es un
 * puesto de trabajo aparte con cuenta propia. No hay perfil auxiliar
 * (`PerfilOperador` es específico del operador: cupo, comité, revisor de
 * apelaciones — nada de eso aplica). Toda la información vive en `Usuario`.
 *
 * Módulos: el rol `VERIFICADOR` ya viene con `admin_verificacion_profesionales`
 * sembrado (`prisma/seed-modulos-grants.ts:72`); la cuenta hereda por rol. No
 * hay grants por usuario para el verificador — la lección I-278 dice: un rol,
 * una persona, un trabajo.
 *
 * Contrato Jelkin (patrón SPEC-421/423): «restablecer» SIEMPRE muestra la
 * clave en pantalla · «reenviar por correo» NUNCA la devuelve (salvo fallback
 * de encolado). El candado permanente `credencial-siempre-visible.candado.test.ts`
 * escanea las rutas correspondientes.
 *
 * Q-3: acceso a Prisma vive en `UsuarioRepository`; este service no importa
 * `@/lib/prisma`.
 */
import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import type { AccionAudit } from "@prisma/client";

export interface CrearVerificadorInput {
    email: string;
    nombre: string;
}

export interface VerificadorListItem {
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    creadoEn: Date;
    ultimaSesion: Date | null;
}

function tempPassword(): string {
    return randomBytes(6).toString("hex");
}

export class VerificadorService {
    private readonly usuarios = new UsuarioRepository();

    async listar(): Promise<VerificadorListItem[]> {
        const filas = await this.usuarios.listarPorRol("VERIFICADOR");
        return filas.map((u) => ({
            id: u.id,
            email: u.email,
            nombre: u.nombre,
            estado: u.estado,
            creadoEn: u.creadoEn,
            ultimaSesion: u.ultimaSesion,
        }));
    }

    async crear(
        input: CrearVerificadorInput,
        adminId: string,
    ): Promise<{ verificador: VerificadorListItem; password: string }> {
        const emailLower = input.email.toLowerCase();
        const existente = await this.usuarios.findByEmail(emailLower);
        if (existente) {
            throw new AppError(
                "Ya existe un usuario con ese email",
                ERROR_CODES.CONFLICT,
                409,
            );
        }
        const password = tempPassword();
        const passwordHash = await hashPassword(password);
        const nuevo = await this.usuarios.crear({
            email: emailLower,
            nombre: input.nombre,
            passwordHash,
            rol: "VERIFICADOR",
            estado: "activo",
            debeCambiarPassword: true,
        });
        await logAudit({
            accion: "USER_CREATE" satisfies AccionAudit,
            tipoRecurso: "Usuario:VERIFICADOR",
            recursoId: nuevo.id,
            usuarioId: adminId,
            valorNuevo: JSON.stringify({ email: nuevo.email, nombre: nuevo.nombre, rol: "VERIFICADOR" }),
            ipAddress: "admin",
            userAgent: "verificadores.service",
        });
        return {
            verificador: {
                id: nuevo.id,
                email: nuevo.email,
                nombre: nuevo.nombre,
                estado: nuevo.estado,
                creadoEn: nuevo.creadoEn,
                ultimaSesion: nuevo.ultimaSesion,
            },
            password,
        };
    }

    async cambiarEstado(id: string, estado: "activo" | "inactivo", adminId: string): Promise<VerificadorListItem> {
        const usuario = await this.usuarios.findById(id);
        if (!usuario || usuario.rol !== "VERIFICADOR") {
            throw new AppError("Verificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        const actualizado = await this.usuarios.actualizar(id, { estado });
        await logAudit({
            accion: "USER_UPDATE" satisfies AccionAudit,
            tipoRecurso: "Usuario:VERIFICADOR",
            recursoId: id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ estado: usuario.estado }),
            valorNuevo: JSON.stringify({ estado }),
            ipAddress: "admin",
            userAgent: "verificadores.service",
        });
        return {
            id: actualizado.id,
            email: actualizado.email,
            nombre: actualizado.nombre,
            estado: actualizado.estado,
            creadoEn: actualizado.creadoEn,
            ultimaSesion: actualizado.ultimaSesion,
        };
    }

    /**
     * Restablece la contraseña y la devuelve al caller. Contrato Jelkin:
     * el endpoint que llama a este método SIEMPRE muestra la password en
     * la respuesta (mismo patrón que padres/profesionales).
     */
    async restablecerPassword(id: string, adminId: string): Promise<{ email: string; password: string }> {
        const usuario = await this.usuarios.findById(id);
        if (!usuario || usuario.rol !== "VERIFICADOR") {
            throw new AppError("Verificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        const password = tempPassword();
        const passwordHash = await hashPassword(password);
        await this.usuarios.actualizar(id, { passwordHash, debeCambiarPassword: true });
        await logAudit({
            accion: "USER_UPDATE" satisfies AccionAudit,
            tipoRecurso: "Usuario:VERIFICADOR",
            recursoId: id,
            usuarioId: adminId,
            valorNuevo: JSON.stringify({ debeCambiarPassword: true, motivo: "SPEC-435 restablecer-password" }),
            ipAddress: "admin",
            userAgent: "verificadores.service",
        });
        return { email: usuario.email, password };
    }

    /**
     * Regenera password y encola envío por correo. El caller NO devuelve la
     * clave en la respuesta cuando el envío se encoló bien (contrato Jelkin).
     * Único fallback: si el motor de notif no aceptó la tarea, la password
     * viaja como copia manual para no atascar al admin.
     */
    async prepararReenvioEmail(id: string, adminId: string): Promise<{ email: string; password: string }> {
        const usuario = await this.usuarios.findById(id);
        if (!usuario || usuario.rol !== "VERIFICADOR") {
            throw new AppError("Verificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        const password = tempPassword();
        const passwordHash = await hashPassword(password);
        await this.usuarios.actualizar(id, { passwordHash, debeCambiarPassword: true });
        await logAudit({
            accion: "USER_UPDATE" satisfies AccionAudit,
            tipoRecurso: "Usuario:VERIFICADOR",
            recursoId: id,
            usuarioId: adminId,
            valorNuevo: JSON.stringify({ debeCambiarPassword: true, motivo: "SPEC-435 reenviar-email" }),
            ipAddress: "admin",
            userAgent: "verificadores.service",
        });
        return { email: usuario.email, password };
    }
}
