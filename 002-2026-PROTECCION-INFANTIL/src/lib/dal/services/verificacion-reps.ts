/**
 * SPEC-790 (T6) · Registro MANUAL de una verificación REPS (`fuente=MANUAL_ADMIN`), append-only.
 *
 * Es la pantalla que ENCIENDE la compuerta del producto; por eso el registro del HECHO pesa más que la
 * comodidad. Dos invariantes del CEO:
 *  (1) La compuerta de CÓDIGO corre ANTES del insert. Prisma es ciego al CHECK `VIGENTE⟹vigenteHasta` de la
 *      base; sin esta validación, un VIGENTE sin fecha llega a la base y el admin recibe el error CRUDO
 *      (23514). El CHECK es la RED, no la puerta → `validarRegistroManualReps` rechaza antes con un CÓDIGO.
 *  (2) El actor va al SNAPSHOT DURABLE (`verificadoPorSnapshot`), no solo al FK (`verificadoPorId`, SetNull
 *      se vacía al borrar la cuenta). La fila es el registro de responsabilidad; sobrevive a la baja.
 *
 * NO muta `habilitado` (REPS es un EJE SEPARADO del «habilitado» interno — candado C-1 del falso amigo):
 * el estado REPS se DERIVA de la ÚLTIMA fila, no se cachea. Una corrección es una fila NUEVA (append-only),
 * no un update: el trigger de inmutabilidad de `verificadoEn` lo refuerza.
 */
import type { EstadoReps, ModalidadReps, VerificacionReps } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { validarRegistroManualReps } from "@/lib/profesional/reps/registro-manual-reps";

export interface RegistrarVerificacionManualInput {
    readonly profesionalId: string;
    readonly resultado: EstadoReps;
    readonly vigenteHasta: Date | null;
    readonly modalidades: readonly ModalidadReps[];
}

/** Quién carga: el FK (puede vaciarse) + el SNAPSHOT durable (email/identificador del admin, o «sistema»). */
export interface ActorVerificacionReps {
    readonly usuarioId: string | null;
    readonly snapshot: string;
}

export async function registrarVerificacionManualReps(
    input: RegistrarVerificacionManualInput,
    actor: ActorVerificacionReps,
    ahora: Date = new Date(),
    db: DbClient = prisma,
): Promise<VerificacionReps> {
    // (1) compuerta de código ANTES del insert — el admin no ve el error crudo de la base.
    const v = validarRegistroManualReps(input, ahora);
    if (!v.ok) throw new AppError(`Registro REPS inválido (${v.motivo})`, ERROR_CODES.VALIDATION_ERROR, 400);
    // La vigencia de la autoridad solo aplica a VIGENTE; para los otros tres se normaliza a null.
    const vigenteHasta = input.resultado === "VIGENTE" ? input.vigenteHasta : null;
    return db.verificacionReps.create({
        data: {
            profesionalId: input.profesionalId,
            verificadoEn: ahora,
            fuente: "MANUAL_ADMIN",
            resultado: input.resultado,
            vigenteHasta,
            modalidades: [...input.modalidades],
            verificadoPorId: actor.usuarioId,
            verificadoPorSnapshot: actor.snapshot, // (2) durable
        },
    });
}
