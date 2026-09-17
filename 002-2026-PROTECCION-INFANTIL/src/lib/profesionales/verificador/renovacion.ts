/**
 * SPEC-693 (I-416) · Revisión de RENOVACIÓN — por requisito.
 *
 * Un profesional YA ACTIVO subió una versión nueva de UN requisito (un documento
 * EN_REVISION que convive con el vigente) y el verificador la aprueba o la devuelve.
 * NO es la verificación completa: esa renueva la vigencia y pasa por `decidir`.
 *
 * Los DOS invariantes del CEO acá son ESTRUCTURALES, no una regla que alguien deba
 * recordar (Datos, D-121):
 *   1) NUNCA extiende la vigencia — `RevisionRenovacion` no tiene `venceEn` y este
 *      service jamás crea una `VerificacionProfesional` ni calcula `calcularVenceEn`.
 *   2) NUNCA cambia el estado del perfil — `RevisionRenovacion` no tiene FK a perfil y
 *      este service jamás llama `cambiarEstadoPerfil`.
 *
 * Aprobar promueve la versión pendiente a VIGENTE (la anterior queda SUPERSEDIDA, no se
 * pierde); devolver la marca DEVUELTA y deja la anterior respaldando. Devolver EXIGE
 * observación — el mismo candado que «NO CUMPLE exige observación» de `decidir`.
 */
import type { Usuario } from "@prisma/client";
import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { VerificadorRepository } from "@/lib/dal/repositories/verificador-repository";
import { DocumentoProfesionalRepository } from "@/lib/dal/repositories/documento-profesional";
import { leerRequisitosVerificacion } from "./requisitos";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";

// ────────────────────────────────────────────────────────────────────────────
// Pantalla de comparar — el documento vigente y el nuevo, lado a lado
// ────────────────────────────────────────────────────────────────────────────

export interface DocumentoNuevoComparacion {
    perfilProfesionalId: string;
    profesional: { nombreVisible: string; tituloProfesional: string; ciudadNombre: string };
    requisitoClave: string;
    requisitoNombre: string;
    /** Vigencia actual (la pantalla la DICE: «la fecha sigue igual: {venceEn}»). */
    venceEn: string | null;
    vigente: { subidoEn: string; aprobadoEn: string | null; aprobadoPor: string | null };
    nuevo: { subidoEn: string };
}

/**
 * SPEC-693 · datos de la pantalla «documento nuevo» de un requisito: el vigente y el
 * pendiente lado a lado. Solo para profesionales ACTIVOS con una versión pendiente y una
 * vigente (FORMA §5: sin vigente NO es un documento nuevo, es una solicitud incompleta;
 * sin pendiente, ya lo decidió otro). Lanza el error que la pantalla traduce a «volver».
 */
export async function abrirDocumentoNuevo(
    perfilProfesionalId: string,
    requisitoClave: string,
): Promise<DocumentoNuevoComparacion> {
    const perfil = await new VerificadorRepository().obtenerFicha(perfilProfesionalId);
    if (!perfil) throw new AppError("Profesional no encontrado", ERROR_CODES.NOT_FOUND, 404);
    if (perfil.estado !== "ACTIVO") {
        throw new AppError(
            `La revisión de un documento nuevo es solo para profesionales activos (este está ${perfil.estado}).`,
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }

    const requisitos = await leerRequisitosVerificacion();
    const requisito = requisitos.find((r) => r.clave === requisitoClave);
    if (!requisito) {
        throw new AppError("Ese requisito no existe en la lista configurada.", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const docRepo = new DocumentoProfesionalRepository();
    const [nuevo, vigente] = await Promise.all([
        docRepo.buscarPendiente(perfilProfesionalId, requisitoClave),
        docRepo.buscarVigente(perfilProfesionalId, requisitoClave),
    ]);
    if (!nuevo) {
        throw new AppError(
            "Ya no hay un documento nuevo en revisión para ese requisito — puede que otro lo haya decidido.",
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }
    if (!vigente) {
        throw new AppError(
            "Este requisito no tiene un documento vigente: es una solicitud incompleta, no un documento nuevo.",
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }

    // La aprobación vigente: la última verificación APROBADA del perfil (fecha + quién).
    // Es la vigencia bajo la que atiende hoy; también da `venceEn`.
    const ultimaAprob = perfil.verificaciones.find((v) => v.resultado === "APROBADO");

    return {
        perfilProfesionalId: perfil.id,
        profesional: {
            nombreVisible: perfil.nombreVisible,
            tituloProfesional: perfil.tituloProfesional,
            ciudadNombre: perfil.ciudad.nombre,
        },
        requisitoClave,
        requisitoNombre: requisito.nombre,
        venceEn: ultimaAprob?.venceEn.toISOString() ?? null,
        vigente: {
            subidoEn: vigente.subidoEn.toISOString(),
            aprobadoEn: ultimaAprob?.revisadoEn.toISOString() ?? null,
            aprobadoPor: ultimaAprob?.revisadoPor.email ?? null,
        },
        nuevo: { subidoEn: nuevo.subidoEn.toISOString() },
    };
}

export const revisarRenovacionSchema = z.object({
    requisitoClave: z.string().min(1),
    decision: z.enum(["APROBAR", "DEVOLVER"]),
    observacion: z.string().max(1000).optional().default(""),
});
export type RevisionRenovacionEntrada = z.infer<typeof revisarRenovacionSchema>;

export interface ResultadoRevisionRenovacion {
    decision: "APROBAR" | "DEVOLVER";
    requisitoClave: string;
    /** La versión que queda respaldando el requisito tras la decisión (o null). */
    documentoVigenteId: string | null;
}

export async function revisarRenovacion(
    perfilProfesionalId: string,
    verificador: Pick<Usuario, "id" | "email">,
    entrada: RevisionRenovacionEntrada,
): Promise<ResultadoRevisionRenovacion> {
    const repo = new VerificadorRepository();
    const perfil = await repo.obtenerFicha(perfilProfesionalId);
    if (!perfil) throw new AppError("Profesional no encontrado", ERROR_CODES.NOT_FOUND, 404);

    // Solo ACTIVO: la revisión inicial (EN_REVISION) es carril de `decidir`, y un perfil
    // vencido recupera vigencia por re-verificación completa, no renovando un requisito.
    if (perfil.estado !== "ACTIVO") {
        throw new AppError(
            `La renovación por requisito es solo para profesionales activos (este está ${perfil.estado}).`,
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }

    // SPEC-704: revisar un documento nuevo es CONSULTAR ANTECEDENTES — el documento puede ser un
    // certificado de antecedentes — y eso requiere la autorización PREVIA aceptada EN PANTALLA
    // (Ley 1918/2018). La MISMA guarda que `decidir` (`aceptacionAntesDe`, antes de cualquier rama
    // de la revisión). La guardia del ACTIVO lo obliga en la práctica, pero la ruta de la API lo
    // exige acá también. Código propio AUTORIZACION_REQUERIDA (más específico que el genérico).
    const aceptacionPrevia = await new AutorizacionProfesionalService().aceptacionAntesDe(
        perfil.usuarioId,
        new Date(),
    );
    if (!aceptacionPrevia) {
        throw new AppError(
            "El profesional no ha aceptado la autorización en pantalla — no se puede revisar un documento sin ella.",
            ERROR_CODES.AUTORIZACION_REQUERIDA,
            409,
        );
    }

    // La clave tiene que ser un requisito configurado (cliente desactualizado / intento).
    const requisitos = await leerRequisitosVerificacion();
    if (!requisitos.some((r) => r.clave === entrada.requisitoClave)) {
        throw new AppError("Ese requisito no existe en la lista configurada.", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // Tiene que haber una versión pendiente que revisar.
    const pendiente = await new DocumentoProfesionalRepository().buscarPendiente(
        perfilProfesionalId,
        entrada.requisitoClave,
    );
    if (!pendiente) {
        throw new AppError(
            "No hay un documento nuevo en revisión para ese requisito.",
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }

    const observacion = entrada.observacion.trim();
    // Regla dura (misma que `decidir`): sin observación no se puede devolver — el
    // profesional tiene que saber qué corregir.
    if (entrada.decision === "DEVOLVER" && !observacion) {
        throw new AppError(
            "Devolver un documento exige una observación escrita: el profesional tiene que saber qué corregir.",
            ERROR_CODES.VALIDATION_ERROR,
            400,
        );
    }

    const documentoVigenteId = await repo.transaccion(async (tx) => {
        const docRepoTx = new DocumentoProfesionalRepository(tx);
        if (entrada.decision === "APROBAR") {
            // Promueve la pendiente a VIGENTE (la anterior → SUPERSEDIDA). Re-lee dentro
            // de la transacción: si otra petición ya la resolvió, devuelve null y paramos.
            const promovida = await docRepoTx.promoverPendienteAVigente(
                perfilProfesionalId,
                entrada.requisitoClave,
            );
            if (!promovida) {
                throw new AppError("El documento en revisión ya no existe.", ERROR_CODES.VALIDATION_ERROR, 409);
            }
            await docRepoTx.registrarRevisionRenovacion({
                documentoProfesionalId: promovida.id,
                revisadoPorId: verificador.id,
                resultado: "APROBADO",
                observacion: observacion || null,
            });
            return promovida.id;
        }
        // DEVOLVER: marca la pendiente DEVUELTA; la anterior VIGENTE sigue respaldando.
        const devuelta = await docRepoTx.marcarPendienteDevuelta(perfilProfesionalId, entrada.requisitoClave);
        if (!devuelta) {
            throw new AppError("El documento en revisión ya no existe.", ERROR_CODES.VALIDATION_ERROR, 409);
        }
        await docRepoTx.registrarRevisionRenovacion({
            documentoProfesionalId: devuelta.id,
            revisadoPorId: verificador.id,
            resultado: "DEVUELTA",
            observacion,
        });
        const vigente = await docRepoTx.buscarVigente(perfilProfesionalId, entrada.requisitoClave);
        return vigente?.id ?? null;
    });

    return { decision: entrada.decision, requisitoClave: entrada.requisitoClave, documentoVigenteId };
}
