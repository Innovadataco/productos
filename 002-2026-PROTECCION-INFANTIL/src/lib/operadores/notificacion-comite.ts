import { prisma } from "@/lib/prisma";
import { getParametroSistemaValor } from "@/lib/parametros";
import { enviarAlertaComitePendientes } from "@/lib/email";

function horasDesde(fecha: Date): number {
    const ahora = Date.now();
    const pasada = fecha.getTime();
    return (ahora - pasada) / (1000 * 60 * 60);
}

export async function notificarComiteSiCorresponde(): Promise<void> {
    const habilitado = await getParametroSistemaValor("comite.notificaciones.enabled");
    if (habilitado !== "true") return;

    const frecuenciaHorasRaw = await getParametroSistemaValor("comite.notificaciones.frecuencia_horas");
    const frecuenciaHoras = frecuenciaHorasRaw ? parseInt(frecuenciaHorasRaw, 10) : 24;
    if (Number.isNaN(frecuenciaHoras) || frecuenciaHoras <= 0) return;

    const comite = await prisma.usuario.findFirst({
        where: { rol: "COMITE_VALIDACION", estado: "activo" },
        include: { perfilOperador: true },
    });
    if (!comite) return;

    const cantidad = await prisma.solicitudComite.count({
        where: {
            estado: { in: ["PENDIENTE", "ASIGNADA"] },
            OR: [{ comiteId: comite.id }, { comiteId: null }],
        },
    });
    if (cantidad === 0) return;

    const ultimoEmail = comite.perfilOperador?.ultimoEmailNotificacionEn;
    if (ultimoEmail && horasDesde(ultimoEmail) < frecuenciaHoras) return;

    await enviarAlertaComitePendientes(comite.email, cantidad);

    await prisma.perfilOperador.update({
        where: { usuarioId: comite.id },
        data: { ultimoEmailNotificacionEn: new Date() },
    });
}
