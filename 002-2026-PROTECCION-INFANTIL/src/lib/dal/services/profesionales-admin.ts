/**
 * SPEC-421 (A-75) · Service de gestión de cuentas de profesionales por admin.
 *
 * Espejo de `/api/admin/padres` para psicólogos (orden Jelkin 20:5x):
 *   - listar (con filtro q + paginación)
 *   - ver detalle
 *   - desactivar
 *   - reactivar
 *   - restablecer contraseña (mismo patrón que padres: si el correo no salió,
 *     la clave viaja en la respuesta y se muestra al admin una sola vez).
 *
 * PLUS lo que padres no tiene y acá sí hace falta:
 *   - listar solicitudes de registro pendientes (TokenRegistro rol=PROFESIONAL)
 *   - reenviar enlace de una solicitud (si el correo no sale, la URL viaja
 *     en la respuesta y se muestra una sola vez, igual que la clave).
 *
 * LÍMITES DUROS (orden Jelkin 20:5x):
 *   - El admin **no crea** cuentas. Padre y psicólogo se registran solos vía
 *     `/registro-profesional/solicitar`.
 *   - El admin **no llena el perfil**. Perfil, tarifa, especialidades y los
 *     cuatro documentos los sigue cargando el propio profesional (SPEC-391).
 *
 * Sin modelo de asignación: al psicólogo lo elige el padre.
 */
import type { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { UsuarioRepository } from "../repositories/usuario";
import { TokenRegistroRepository } from "../repositories/token-registro";

function tempPassword() {
    return randomBytes(6).toString("hex");
}

export interface InfoClienteDto {
    ipAddress: string;
    userAgent: string;
}

export interface ProfesionalListItem {
    id: string;
    email: string;
    nombre: string | null;
    estado: "activo" | "inactivo";
    debeCambiarPassword: boolean;
    creadoEn: string;
    ultimaSesion: string | null;
}

export interface SolicitudPendienteItem {
    id: string;
    email: string;
    creadoEn: string;
    expiraEn: string;
}

export class ProfesionalesAdminService {
    private readonly usuarios: UsuarioRepository;
    private readonly tokens: TokenRegistroRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.usuarios = new UsuarioRepository(tx);
        this.tokens = new TokenRegistroRepository(tx);
    }

    /** Lista paginada de cuentas PROFESIONAL con filtro q (email/nombre). */
    async listar(
        query: { page: number; pageSize: number; q?: string | undefined },
    ): Promise<{ items: ProfesionalListItem[]; total: number }> {
        const where: Prisma.UsuarioWhereInput = { rol: "PROFESIONAL" };
        if (query.q) {
            where.OR = [
                { email: { contains: query.q, mode: "insensitive" } },
                { nombre: { contains: query.q, mode: "insensitive" } },
            ];
        }
        const [rows, total] = await this.usuarios.findProfesionalesPaginados(where, {
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
        });
        return {
            items: rows.map((u) => ({
                id: u.id,
                email: u.email,
                nombre: u.nombre,
                estado: u.estado as "activo" | "inactivo",
                debeCambiarPassword: u.debeCambiarPassword,
                creadoEn: u.creadoEn.toISOString(),
                ultimaSesion: u.ultimaSesion ? u.ultimaSesion.toISOString() : null,
            })),
            total,
        };
    }

    async obtener(id: string) {
        return this.usuarios.findProfesionalById(id);
    }

    async restablecerPassword(
        profesional: { id: string; debeCambiarPassword: boolean },
        admin: { id: string } & InfoClienteDto,
    ): Promise<{ password: string }> {
        const password = tempPassword();
        const passwordHash = await hashPassword(password);
        await this.usuarios.actualizar(profesional.id, { passwordHash, debeCambiarPassword: true });
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario:PROFESIONAL",
            recursoId: profesional.id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ debeCambiarPassword: profesional.debeCambiarPassword }),
            valorNuevo: JSON.stringify({ debeCambiarPassword: true }),
            ipAddress: admin.ipAddress,
            userAgent: admin.userAgent,
        });
        return { password };
    }

    async desactivar(
        profesional: { id: string; estado: string },
        admin: { id: string } & InfoClienteDto,
    ): Promise<void> {
        if (profesional.estado === "inactivo") return;
        await this.usuarios.actualizar(profesional.id, { estado: "inactivo" });
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario:PROFESIONAL",
            recursoId: profesional.id,
            usuarioId: admin.id,
            valorAnterior: "activo",
            valorNuevo: "inactivo",
            ipAddress: admin.ipAddress,
            userAgent: admin.userAgent,
        });
    }

    async reactivar(
        profesional: { id: string; estado: string },
        admin: { id: string } & InfoClienteDto,
    ): Promise<void> {
        if (profesional.estado === "activo") return;
        await this.usuarios.actualizar(profesional.id, { estado: "activo" });
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario:PROFESIONAL",
            recursoId: profesional.id,
            usuarioId: admin.id,
            valorAnterior: "inactivo",
            valorNuevo: "activo",
            ipAddress: admin.ipAddress,
            userAgent: admin.userAgent,
        });
    }

    /** Solicitudes de registro pendientes (TokenRegistro rol=PROFESIONAL activo). */
    async listarSolicitudesPendientes(): Promise<SolicitudPendienteItem[]> {
        const filas = await this.tokens.findPendientesPorRol("PROFESIONAL");
        return filas.map((t) => ({
            id: t.id,
            email: t.email,
            creadoEn: t.creadoEn.toISOString(),
            expiraEn: t.expiraEn.toISOString(),
        }));
    }
}

export function throwSiNoEsProfesional(usuario: unknown): void {
    if (!usuario || typeof usuario !== "object" || (usuario as { id?: unknown }).id === undefined) {
        throw new AppError("Profesional no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
}
