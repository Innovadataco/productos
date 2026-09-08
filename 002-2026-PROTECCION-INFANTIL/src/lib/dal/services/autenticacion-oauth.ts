/**
 * SPEC-587 — Resolución de cuenta para el OAuth de Google (flujo PADRE).
 *
 * Vive en el DAL porque la frontera Q-3 prohíbe `@/lib/prisma` fuera de
 * src/lib/dal/. Por email normalizado (minúsculas + trim, mismo criterio que
 * AutenticacionService.login):
 * - Existe → se devuelve tal cual (el callback aplica vigencia/estado como el login).
 * - No existe → se crea la cuenta PARENT con contraseña aleatoria bcrypteada
 *   (el schema exige passwordHash y el modelo no distingue proveedor de auth)
 *   y se deja AuditLog USER_CREATE sin PII sensible en metadatos.
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
        const email = params.email.trim().toLowerCase();
        const existente = await prisma.usuario.findUnique({ where: { email } });
        if (existente) {
            return { usuario: existente, esNuevo: false };
        }

        const usuario = await prisma.usuario.create({
            data: {
                email,
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
