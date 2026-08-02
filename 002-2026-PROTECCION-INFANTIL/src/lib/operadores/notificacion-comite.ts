import { getParametroSistemaValor } from "@/lib/parametros";
import { enviarAlertaComitePendientes } from "@/lib/email";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { SolicitudComiteRepository } from "@/lib/dal/repositories/solicitud-comite";
import { PerfilOperadorRepository } from "@/lib/dal/repositories/perfil-operador";

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

    // E-8: las lecturas/escrituras viven en los repos; la lógica no cambia.
    const comite = await new UsuarioRepository().findPrimerComiteActivoConPerfil();
    if (!comite) return;

    const cantidad = await new SolicitudComiteRepository().contarPendientesParaComite(comite.id);
    if (cantidad === 0) return;

    const ultimoEmail = comite.perfilOperador?.ultimoEmailNotificacionEn;
    if (ultimoEmail && horasDesde(ultimoEmail) < frecuenciaHoras) return;

    await enviarAlertaComitePendientes(comite.email, cantidad);

    await new PerfilOperadorRepository().actualizarPorUsuarioId(comite.id, { ultimoEmailNotificacionEn: new Date() });
}
