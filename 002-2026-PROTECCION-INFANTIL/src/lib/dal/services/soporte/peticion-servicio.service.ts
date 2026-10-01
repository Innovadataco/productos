/**
 * SPEC-819 · Servicio de la Puerta de Soporte: crea la `PeticionServicio` del motivo elegido y —solo para
 * `DATOS_PERSONALES`— la `SolicitudHabeasData` CANÓNICA enlazada (decisión del CEO: la puerta RECIBE, el
 * registro legal es donde vive la PRUEBA). Una sola transacción: las dos filas nacen juntas y enlazadas, o
 * ninguna.
 *
 * El tipo (consulta/rectificación/supresión) y el sujeto (titular o un hijo) NO se infieren: los pregunta la
 * forma (FORMA-SPEC819) y llegan acá ya resueltos — inferir el tipo = elegirle el plazo legal, y elegir mal
 * = incumplir con cara de acierto. `plazoDias` sale de la fuente ÚNICA del techo legal
 * (`plazoMaximoLegalDiasHabiles`, [NORMA] Ley 1581); `venceEn` legal se ancla en la recepción real
 * (`recibidoEn`), que para una petición auto-radicada ES «ahora». El `venceEn` propio de la PQR es su término
 * INTERNO (`venceEnPeticionServicio`), un reloj distinto del legal (la bandeja DERIVA el legal por el enlace).
 */
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { obtenerHijoDePadre } from "@/lib/dal/services/hijos";
import { venceEnPeticionServicio } from "@/lib/soporte/plazo-peticion";
import { plazoMaximoLegalDiasHabiles } from "@/lib/habeas-data/plazos-legales";
import { sumarDiasHabilesColombia } from "@/lib/fechas/dias-habiles-colombia";
import type { MotivoPeticionServicio, TipoSolicitudHabeasData } from "@prisma/client";

/**
 * Sujeto del dato, discriminado por `calidad`. La puerta del padre cubre 2 de las 3 calidades del enum:
 * `TITULAR_MAYORIA_EDAD` (ex-menor sin cuenta) NO es alcanzable desde acá (y es correcto).
 */
export type SujetoHabeasData =
    | { calidad: "TITULAR_CUENTA" }
    | { calidad: "REPRESENTANTE_LEGAL"; hijoId: string };

/** Detalle que SOLO viaja con `DATOS_PERSONALES` (los dos ejes de la forma, ya resueltos). */
export interface DetalleHabeasData {
    tipo: TipoSolicitudHabeasData;
    sujeto: SujetoHabeasData;
}

export interface CrearPeticionInput {
    /** El padre de la sesión (dueño de la petición; la PQR cuelga del usuario, no es anónima). */
    usuarioId: string;
    motivo: MotivoPeticionServicio;
    /** Presente SII `motivo === "DATOS_PERSONALES"` (el servicio lo exige y lo rechaza si sobra). */
    habeasData?: DetalleHabeasData;
}

/**
 * Crea la petición y, para habeas data, su registro legal. Devuelve el número de seguimiento (el id de la
 * PQR) para que la confirmación lo muestre — nunca uno inventado.
 */
export async function crearPeticionServicio(input: CrearPeticionInput): Promise<{ numeroSeguimiento: string }> {
    const esDatos = input.motivo === "DATOS_PERSONALES";

    // Contrato duro: el detalle de habeas data va 1:1 con el motivo. Ni falta (no podríamos fijar el tipo
    // legal) ni sobra (un detalle legal colgado de «una cita» es un dato sin sentido).
    if (esDatos && !input.habeasData) {
        throw new AppError("Falta el detalle de la solicitud de datos personales", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (!esDatos && input.habeasData) {
        throw new AppError("El detalle de datos personales no aplica a este motivo", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // Sujeto del dato: null para «míos» (el sujeto ES quien pide — el CHECK eje_sujeto lo permite); el hijo
    // elegido para «de mi hijo». VERIFICACIÓN de propiedad: un padre solo radica sobre SU hijo — si el hijo
    // no es de esta cuenta, se rechaza (no se puede pedir habeas data sobre el hijo de otro).
    let sujetoDelDato: string | null = null;
    if (input.habeasData?.sujeto.calidad === "REPRESENTANTE_LEGAL") {
        const hijo = await obtenerHijoDePadre(input.habeasData.sujeto.hijoId, input.usuarioId);
        if (!hijo) {
            throw new AppError("No encontramos ese hijo en tu cuenta", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        sujetoDelDato = hijo.id;
    }

    const ahora = new Date();

    const pqr = await prisma.$transaction(async (tx) => {
        let solicitudHabeasDataId: string | undefined;

        if (input.habeasData) {
            const { tipo, sujeto } = input.habeasData;
            // Default = el techo legal del tipo (10 consulta / 15 reclamo). Es el máximo permitido por el
            // CHECK; el operador puede PROMETER menos, nunca más. recibidoEn = ahora (auto-radicada: el reloj
            // legal arranca en la recepción real, que acá es el envío por la app).
            const plazoDias = plazoMaximoLegalDiasHabiles(tipo);
            const sol = await tx.solicitudHabeasData.create({
                data: {
                    tipo,
                    calidad: sujeto.calidad,
                    sujetoDelDato,
                    plazoDias,
                    recibidoEn: ahora,
                    venceEn: sumarDiasHabilesColombia(ahora, plazoDias),
                    origen: "APLICACION",
                },
            });
            solicitudHabeasDataId = sol.id;
        }

        return tx.peticionServicio.create({
            data: {
                usuarioId: input.usuarioId,
                motivo: input.motivo,
                creadoEn: ahora,
                // Término INTERNO de la PQR (distinto del legal; la bandeja deriva el legal por el enlace).
                venceEn: venceEnPeticionServicio(input.motivo, ahora),
                ...(solicitudHabeasDataId ? { solicitudHabeasDataId } : {}),
            },
        });
    });

    return { numeroSeguimiento: pqr.id };
}
