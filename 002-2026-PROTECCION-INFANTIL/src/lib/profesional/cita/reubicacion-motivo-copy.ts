import type { MotivoReubicacion } from "./reubicacion-cola";

export interface CopyMotivoReubicacion {
    /** Motivo SOBRIO — el HECHO funcional, nunca «inhabilitado/sancionado/suspendido» (no expone el
     *  estado de la cuenta de nadie). */
    titulo: string;
    /** La NATURALEZA: si el caso puede esperar o no (la ACCIÓN), nunca un plazo ni un umbral. */
    detalle: string;
}

/**
 * SPEC-814 · Copy de Diseño (FORMA v1.5 §1-ter, commit 994f082) para el motivo de orfandad de una cita.
 * SPEC-852: al eliminarse REPS, la cola de reubicación colapsó a UN solo motivo (`PANEL_BLOQUEADO` =
 * ¬habilitado = ¬(ACTIVO ∧ verificación interna)). Los motivos REPS (REGISTRO_NO_VIGENTE / REVISION_INTERNA,
 * que derivaban de `clasificarReps`) se fueron con REPS.
 *
 * Record COMPLETO (no Partial): el compilador exige cubrir CADA `MotivoReubicacion`. Sin plazos, sin estado
 * de cuenta, sin insinuar reubicación automática.
 */
export const COPY_MOTIVO_REUBICACION: Record<MotivoReubicacion, CopyMotivoReubicacion> = {
    PANEL_BLOQUEADO: {
        titulo: "El profesional no puede entrar a su panel",
        detalle: "No puede resolverlo por su cuenta → reubicar es la única salida.",
    },
};
