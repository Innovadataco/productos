/**
 * SPEC-750 · Publicación y validación del ENLACE de la reunión + registro del HECHO.
 *
 * Lo que PI controla (FORMA §4): solo `https`, validado EN SERVIDOR, jamás
 * interpretado como HTML; se publica SOLO en PI (nunca por correo: nadie tiene el
 * correo del padre y un correo se reenvía); y PI deja de mostrarlo pasada la hora.
 * Lo que PI NO promete: caducidad, vida ni «un solo uso» del enlace (la sala vive en
 * un proveedor de video ajeno) — por eso no hay ningún campo ni copy de caducidad.
 *
 * 🚨 El HECHO NUNCA lleva la URL: `AuditLog.metadatos` se replica a `bi_replica` y la
 * URL es acceso a la sesión de un menor. Al hecho van actor + cita + timestamp +
 * versión de protocolo. El candado planta un enlace real y afirma que no aparece.
 */
import type { Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { getParametroSistemaValor } from "@/lib/parametros";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { validarEnlaceReunion } from "./enlace-validacion";
import { metadatosHecho } from "./hecho-sesion-tipos";

// La regla pura de validación (https/no-HTML) vive en `enlace-validacion.ts` para que el
// candado la pruebe como unit sin arrastrar infra. Se re-exporta por conveniencia. (La
// visibilidad ya NO vive acá: SPEC-778 la deriva de `estadoEfectivoDeCita` en `enlace-derivado.ts`.)
export { validarEnlaceReunion, type ValidacionEnlace } from "./enlace-validacion";

/**
 * Registra el HECHO de la convocatoria en AuditLog (append-only; `AuditLog` está en
 * `PRESERVADOS.tablas`, la purga no lo toca → rastro durable). Metadata SIN CONTENIDO
 * y SIN URL. La `protocoloVersion` sale de un parámetro sembrado (`operador.guion.version`),
 * editable sin desplegar. CUANDO el guion pase a ser documento legal versionado (con
 * hash, como el consentimiento), ese parámetro apuntará a su versión+huella.
 */
export async function registrarHechoSesion(
    params: { citaId: string; operadorId: string; tx?: Prisma.TransactionClient },
): Promise<void> {
    const protocoloVersion = (await getParametroSistemaValor("operador.guion.version", params.tx)) ?? "sin-version";
    await logAudit({
        accion: "OPERADOR_ASIGNADO", // enum publicado a BI (no se migra); el tipo real va en metadatos.
        tipoRecurso: "SolicitudCita",
        recursoId: params.citaId,
        usuarioId: params.operadorId,
        // Forma TIPADA (imposible-por-construcción meter url/contenido); viaja ENTERA a bi_replica.
        metadatos: metadatosHecho("sesion_convocada", { protocoloVersion }),
        tx: params.tx,
    });
}

/**
 * El operador ASIGNADO publica el enlace de su cita. Valida, guarda `enlaceReunion` +
 * `enlacePublicadoEn`, y registra el HECHO — todo en una transacción.
 */
export async function publicarEnlaceSesion(
    params: { citaId: string; operadorId: string; enlaceRaw: string },
): Promise<{ ok: true }> {
    const validacion = validarEnlaceReunion(params.enlaceRaw);
    if (!validacion.ok) throw new AppError(validacion.razon, ERROR_CODES.VALIDATION_ERROR, 400);

    return withUnitOfWork(async (tx) => {
        const repo = new SolicitudCitaRepository(tx);
        const cita = await repo.findParaPublicarEnlace(params.citaId);
        if (!cita) throw new AppError("Cita no encontrada", ERROR_CODES.NOT_FOUND, 404);
        if (cita.enlaceOperadorId !== params.operadorId) {
            throw new AppError("No es el operador asignado a esta cita", ERROR_CODES.FORBIDDEN, 403);
        }
        if (cita.estado !== "CONFIRMADA") {
            throw new AppError(`La cita está en ${cita.estado}: no admite publicar enlace`, ERROR_CODES.CONFLICT, 409);
        }
        await repo.publicarEnlace(params.citaId, validacion.url, new Date());
        await registrarHechoSesion({ citaId: params.citaId, operadorId: params.operadorId, tx });
        return { ok: true };
    });
}
