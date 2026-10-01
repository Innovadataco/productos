/**
 * SPEC-790 (T6) · Compuerta de CÓDIGO del registro MANUAL de una verificación REPS, ANTES del insert.
 *
 * El modelo tiene un CHECK `resultado='VIGENTE' ⟹ vigenteHasta IS NOT NULL`, pero Prisma es CIEGO al CHECK:
 * si el servicio inserta un VIGENTE sin fecha, la base lo rechaza con su error CRUDO (23514) y el admin
 * recibe eso. **El CHECK es la red, no la puerta.** Esta compuerta espeja el CHECK en código y agrega lo
 * que el CHECK no puede expresar (una VIGENTE con la vigencia ya pasada es contradictoria; una VIGENTE sin
 * modalidades no habilita nada). Devuelve un CÓDIGO de motivo —no copy— para que la SUPERFICIE (forma de
 * Diseño) elija la palabra visible; acá no se inventan rótulos.
 *
 * PURA: sin base, sin reloj de pared (`ahora` inyectado). El registro del HECHO (fila append-only + actor
 * durable) lo hace el DAL (`verificacion-reps.ts`), que llama esto primero.
 */
import type { EstadoReps, ModalidadReps } from "./reps-elegibilidad";

export interface RegistroManualRepsInput {
    readonly resultado: EstadoReps;
    readonly vigenteHasta: Date | null;
    readonly modalidades: readonly ModalidadReps[];
}

/** Por qué se rechaza un registro manual. CÓDIGO legible por la superficie, que le pone la copy aprobada. */
export type MotivoRechazoReps = "VIGENTE_SIN_VIGENCIA" | "VIGENTE_VIGENCIA_PASADA" | "VIGENTE_SIN_MODALIDAD";

export type ValidacionRegistroReps = { readonly ok: true } | { readonly ok: false; readonly motivo: MotivoRechazoReps };

const esFecha = (d: Date | null | undefined): d is Date => d instanceof Date && Number.isFinite(d.getTime());

/**
 * ¿Se puede registrar este resultado manual? Solo `VIGENTE` tiene exigencias (espejo del CHECK + los
 * guardas de sentido); `VENCIDA`/`NO_ENCONTRADA`/`SIN_VERIFICAR` no requieren fecha ni modalidades.
 */
export function validarRegistroManualReps(input: RegistroManualRepsInput, ahora: Date): ValidacionRegistroReps {
    if (input.resultado !== "VIGENTE") return { ok: true };
    // Espejo del CHECK de la base: un VIGENTE SIN fecha de vigencia no se puede registrar (ni la base lo deja).
    if (!esFecha(input.vigenteHasta)) return { ok: false, motivo: "VIGENTE_SIN_VIGENCIA" };
    // Lo que el CHECK no puede: una vigencia YA pasada contradice «vigente» (debería registrarse VENCIDA).
    if (esFecha(ahora) && input.vigenteHasta.getTime() <= ahora.getTime()) return { ok: false, motivo: "VIGENTE_VIGENCIA_PASADA" };
    // Un VIGENTE que no habilita ninguna modalidad no sirve para reservar nada.
    if (input.modalidades.length === 0) return { ok: false, motivo: "VIGENTE_SIN_MODALIDAD" };
    return { ok: true };
}
