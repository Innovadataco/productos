/**
 * SPEC-587 — Resolución de cuenta para el OAuth de Google (flujo PADRE).
 *
 * Vive en el DAL porque la frontera Q-3 prohíbe `@/lib/prisma` fuera de
 * src/lib/dal/.
 *
 * SPEC-590: la resolución busca PRIMERO por `googleSub` (el sub del proveedor,
 * único e inmutable) y DESPUÉS por email normalizado (minúsculas + trim, mismo
 * criterio que AutenticacionService.login). El email del padre es editable
 * desde el perfil; si la resolución fuera solo por email, el próximo
 * «Continúa con Google» después de un cambio de email crearía una cuenta
 * DUPLICADA. Al encontrar la cuenta por email sin `googleSub` (cuentas OAuth
 * de antes de SPEC-590) se le RELLENA el sub — la próxima resolución ya es por
 * sub. Al crear cuenta nueva se persiste el sub de Google desde el nacimiento.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Usuario } from "@prisma/client";

/** Contraseña local inutilizable para cuentas creadas vía Google (72 chars hex). */
function generarPasswordAleatorio(): string {
    return randomBytes(36).toString("hex");
}

export interface ResultadoResolucionOauth {
    usuario: Usuario;
    esNuevo: boolean;
}

export class AutenticacionOauthService {
    async resolverODeCrearCuenta(params: {
        email: string;
        nombre: string | null;
        proveedorSub: string;
        ipAddress: string;
        userAgent: string;
    }): Promise<ResultadoResolucionOauth> {
        // 1) SPEC-590: por sub — sobrevive a que el padre cambie su email.
        const porSub = await prisma.usuario.findUnique({ where: { googleSub: params.proveedorSub } });
        if (porSub) {
            return { usuario: porSub, esNuevo: false };
        }

        const email = params.email.trim().toLowerCase();
        const existente = await prisma.usuario.findUnique({ where: { email } });
        if (existente) {
            // 2) Backfill: cuenta OAuth previa a SPEC-590 (o creada por email).
            // Se le ata el sub AHORA solo si no tenía ninguno (nunca se pisa un
            // sub distinto: una cuenta con otro sub es otra identidad de Google);
            // la próxima resolución ya es por sub.
            if (existente.googleSub === null) {
                const actualizado = await prisma.usuario.update({
                    where: { id: existente.id },
                    data: { googleSub: params.proveedorSub },
                });
                return { usuario: actualizado, esNuevo: false };
            }
            return { usuario: existente, esNuevo: false };
        }

        const usuario = await prisma.usuario.create({
            data: {
                email,
                googleSub: params.proveedorSub,
                nombre: params.nombre,
                passwordHash: await hashPassword(generarPasswordAleatorio()),
                rol: "PARENT",
                estado: "activo",
            },
        });

        // Mutación crítica: trazabilidad sin PII sensible (ni email ni nombre).
        await logAudit({
            accion: "USER_CREATE",
            tipoRecurso: "Usuario",
            recursoId: usuario.id,
            usuarioId: usuario.id,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            metadatos: { origen: "oauth_google", proveedorSub: params.proveedorSub },
        });

        return { usuario, esNuevo: true };
    }
}
