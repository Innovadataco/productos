/**
 * SPEC-587 / SPEC-631 — Resolución y alta de cuenta para el OAuth de Google.
 *
 * Vive en el DAL (frontera Q-3: `@/lib/prisma` solo en src/lib/dal/).
 *
 * SPEC-590: la resolución busca PRIMERO por `googleSub` (único e inmutable) y DESPUÉS por email
 * normalizado. El email del padre es editable; si la resolución fuera solo por email, un «Continúa con
 * Google» tras cambiar el email crearía una cuenta DUPLICADA. A una cuenta por email sin `googleSub`
 * (OAuth previas a SPEC-590) se le RELLENA el sub.
 *
 * SPEC-631 (I-378): se PARTE en dos. `resolver` SOLO busca (nunca crea) — lo usa el botón de /login y
 * el primer paso de un registro. `crearConRol` crea con el rol FIRMADO en el state, re-validado contra
 * el allowlist AL CREAR (un rol privilegiado forjado → lanza, no crea) y por el MISMO primitivo
 * (`UsuarioRepository.crear`) que usa el alta por correo, para no saltarse por una segunda puerta lo
 * que la primera exige. Preserva el invariante SPEC-613 (googleSub set + passwordCreadaEn null →
 * `cuentaSinContrasenaLocal` true): sigue siendo cuenta de Google, sin clave local.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ROLES_AUTORREGISTRABLES_GOOGLE } from "@/lib/auth-oauth";
import { UsuarioRepository } from "../repositories/usuario";
import type { RolUsuario, Usuario } from "@prisma/client";

/** Contraseña local inutilizable para cuentas creadas vía Google (72 chars hex). */
function generarPasswordAleatorio(): string {
    return randomBytes(36).toString("hex");
}

export class AutenticacionOauthService {
    /**
     * SOLO resuelve: por sub, y si no, por email (rellenando el sub a cuentas OAuth previas). NUNCA
     * crea. Devuelve `null` si el correo no tiene cuenta — el llamador decide (login → /registro/inicio;
     * registro → `crearConRol`).
     */
    async resolver(params: { email: string; proveedorSub: string }): Promise<Usuario | null> {
        const porSub = await prisma.usuario.findUnique({ where: { googleSub: params.proveedorSub } });
        if (porSub) return porSub;

        const email = params.email.trim().toLowerCase();
        const existente = await prisma.usuario.findUnique({ where: { email } });
        if (!existente) return null;

        // Backfill del sub SOLO si no tenía ninguno (nunca se pisa otro sub: es otra identidad Google).
        if (existente.googleSub === null) {
            return prisma.usuario.update({ where: { id: existente.id }, data: { googleSub: params.proveedorSub } });
        }
        return existente;
    }

    /**
     * Crea una cuenta NUEVA por Google con el rol firmado. Re-valida el allowlist AL CREAR (gate de
     * Datos): rol fuera de {PARENT, PROFESIONAL} → lanza y NO crea. Va por `UsuarioRepository.crear`
     * (el primitivo compartido con el alta por correo). El llamador ya verificó que el correo no existe.
     */
    async crearConRol(params: {
        email: string;
        nombre: string | null;
        proveedorSub: string;
        rol: RolUsuario;
        ipAddress: string;
        userAgent: string;
    }): Promise<Usuario> {
        if (!ROLES_AUTORREGISTRABLES_GOOGLE.includes(params.rol)) {
            // Defensa AL CREAR: un state con rol privilegiado (aunque estuviera firmado) no crea nada.
            throw new Error(`[oauth] rol no auto-registrable por Google: ${params.rol}`);
        }

        const usuario = await new UsuarioRepository().crear({
            email: params.email,
            googleSub: params.proveedorSub,
            nombre: params.nombre,
            passwordHash: await hashPassword(generarPasswordAleatorio()),
            passwordCreadaEn: null, // SPEC-613: cuenta de Google sin clave local.
            rol: params.rol,
            estado: "activo",
        });

        // Mutación crítica: trazabilidad sin PII sensible (ni email ni nombre).
        await logAudit({
            accion: "USER_CREATE",
            tipoRecurso: "Usuario",
            recursoId: usuario.id,
            usuarioId: usuario.id,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            metadatos: { origen: "oauth_google", proveedorSub: params.proveedorSub, rol: params.rol },
        });

        return usuario;
    }
}
