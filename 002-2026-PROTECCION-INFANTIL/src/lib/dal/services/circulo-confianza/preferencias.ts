/**
 * SPEC-135 (E-2): preferencias de notificación del círculo (toggle + lectura).
 * Movimiento mecánico desde el god-module.
 */
import { prisma } from "@/lib/prisma";

export async function toggleNotificacionesCirculo(usuarioId: string, habilitado: boolean) {
    await prisma.usuario.update({
        where: { id: usuarioId },
        data: { notificacionesCirculo: habilitado },
    });
    return { notificacionesCirculo: habilitado };
}

export async function obtenerPreferenciasCirculo(usuarioId: string) {
    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { notificacionesCirculo: true },
    });
    return { notificacionesCirculo: usuario?.notificacionesCirculo ?? true };
}
