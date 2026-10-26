/**
 * SPEC-905 (grafo FK del reset) — helpers COMPARTIDOS para el borrado FK-safe del rastro
 * de UN conjunto de usuarios. Una sola fuente del orden para que el bug de facturación
 * (Pago→Suscripcion Restrict) no se arregle en un helper y siga roto en los otros dos.
 *
 * Antes cada helper (borrar-padre/colegio) borraba `suscripcion.deleteMany` SIN borrar
 * primero `Pago`/`BonoAplicado`/`CodigoReferidoUso` (todos FK RESTRICT → Suscripcion), así que
 * una suscripción con un pago reportado tumbaba el borrado. Y `borrar-padre` ni tocaba las
 * `SolicitudCita` del padre (padreUsuarioId → Usuario RESTRICT) ni sus apelaciones/alertas.
 * Acá vive una sola vez, y los candados lo atan (purga-fk-cobertura + el ensayo de purga-total).
 */
import type { Prisma } from "@prisma/client";

/**
 * Cadena de facturación que BLOQUEA el borrado de una Suscripcion (FK RESTRICT):
 * BonoAplicado · CodigoReferidoUso · Pago → antes de la Suscripcion. `CodigoReferidoUso`
 * referencia la suscripción por DOS columnas (propia + referida); ambas son RESTRICT.
 */
export async function borrarFacturacionDeSuscripciones(
    tx: Prisma.TransactionClient,
    suscripcionIds: string[],
): Promise<void> {
    if (suscripcionIds.length === 0) return;
    const inS = { in: suscripcionIds };
    await tx.bonoAplicado.deleteMany({ where: { suscripcionId: inS } });
    await tx.codigoReferidoUso.deleteMany({
        where: { OR: [{ codigoReferidoUsuarioId: inS }, { suscripcionReferidaId: inS }] },
    });
    await tx.pago.deleteMany({ where: { suscripcionId: inS } });
}

/** Conteos de lo borrado por `borrarRastroUsuario` (para el detalle/auditoría del helper que llama). */
export interface RastroUsuarioDetalle {
    solicitudesCita: number;
    apelaciones: number;
    suscripciones: number;
    alertasSuscripcion: number;
    codigosAcceso: number;
    contactosEmergencia: number;
    digestsSemanal: number;
    notificacionesInApp: number;
    contactosConfianza: number;
    codigosVerificacion: number;
    tokensRecuperacion: number;
}

/** RastroUsuarioDetalle en 0 — para el dry-run (sin tocar la BD) y el short-circuit sin usuarios. */
export function rastroVacio(): RastroUsuarioDetalle {
    return {
        solicitudesCita: 0, apelaciones: 0, suscripciones: 0, alertasSuscripcion: 0,
        codigosAcceso: 0, contactosEmergencia: 0, digestsSemanal: 0, notificacionesInApp: 0,
        contactosConfianza: 0, codigosVerificacion: 0, tokensRecuperacion: 0,
    };
}

/**
 * Borra, FK-safe, el RASTRO GENÉRICO de estos usuarios: lo que un Usuario POSEE por su propia
 * columna (no lo que autoría cruzada de staff, no reportes —van por `borrarReporte`—, no el
 * subárbol de Expediente —lo hace `borrarSubarbolExpediente` en el llamador— ni el subárbol
 * profesional —lo hace `borrar-profesional`). Pensado para correr DENTRO de la transacción del
 * llamador (borrar-padre / borrar-profesional), con el guard de consentimiento ya resuelto por él.
 *
 * Orden: primero lo que bloquea a Suscripcion (facturación), luego el resto. `Apelacion` arrastra
 * sus `DocumentoApelacion`/`AccesoDocumentoApelacion` por Cascade; `AccesoDocumentoApelacion`
 * (FK RESTRICT → Usuario) cae con ese cascade, por eso basta borrar la Apelacion del titular.
 */
export async function borrarRastroUsuario(
    tx: Prisma.TransactionClient,
    usuarioIds: string[],
): Promise<RastroUsuarioDetalle> {
    if (usuarioIds.length === 0) return rastroVacio();
    const inU = { in: usuarioIds };

    // SolicitudCita (padreUsuarioId → Usuario RESTRICT): las citas que el usuario reservó como
    // padre. Las franjas quedan vivas (son del profesional); la cita sí se va. Sus hijas
    // (EncuestaCita/EncuestaPrimeraCita/IncidenteContradiccionEncuesta) son Cascade.
    const sc = await tx.solicitudCita.deleteMany({ where: { padreUsuarioId: inU } });

    // Apelacion (usuarioId → Usuario RESTRICT) · cascada a DocumentoApelacion + AccesoDocumentoApelacion.
    const ap = await tx.apelacion.deleteMany({ where: { usuarioId: inU } });

    // Facturación → Suscripcion, en orden, antes de la Suscripcion misma.
    const suscripciones = await tx.suscripcion.findMany({ where: { usuarioId: inU }, select: { id: true } });
    const suscripcionIds = suscripciones.map((s) => s.id);
    await borrarFacturacionDeSuscripciones(tx, suscripcionIds);
    const su = await tx.suscripcion.deleteMany({ where: { usuarioId: inU } });

    const al = await tx.alertaSuscripcion.deleteMany({ where: { usuarioId: inU } });
    const ca = await tx.codigoAccesoContenido.deleteMany({ where: { solicitadoPorId: inU } });
    const ce = await tx.contactoEmergencia.deleteMany({ where: { padreUsuarioId: inU } });
    const ds = await tx.digestSemanal.deleteMany({ where: { destinatarioId: inU } });
    const ni = await tx.notificacionInApp.deleteMany({ where: { usuarioId: inU } });
    const cc = await tx.contactoConfianza.deleteMany({ where: { usuarioId: inU } });
    const cv = await tx.codigoVerificacion.deleteMany({ where: { usuarioId: inU } });
    const tr = await tx.tokenRecuperacion.deleteMany({ where: { usuarioId: inU } });

    return {
        solicitudesCita: sc.count,
        apelaciones: ap.count,
        suscripciones: su.count,
        alertasSuscripcion: al.count,
        codigosAcceso: ca.count,
        contactosEmergencia: ce.count,
        digestsSemanal: ds.count,
        notificacionesInApp: ni.count,
        contactosConfianza: cc.count,
        codigosVerificacion: cv.count,
        tokensRecuperacion: tr.count,
    };
}
