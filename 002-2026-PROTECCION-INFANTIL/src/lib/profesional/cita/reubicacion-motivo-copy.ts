import type { MotivoReubicacion } from "./reubicacion-cola";

export interface CopyMotivoReubicacion {
    /** Motivo SOBRIO — el HECHO funcional, nunca «inhabilitado/sancionado/suspendido» (no expone el
     *  estado de la cuenta de nadie). */
    titulo: string;
    /** La NATURALEZA: si el caso puede esperar o no (la ACCIÓN), nunca un plazo ni un umbral. */
    detalle: string;
}

/**
 * SPEC-814 · Copy de Diseño (FORMA v1.5 §1-ter, commit 994f082). Los DOS motivos de orfandad leen
 * DISTINTO porque piden acciones distintas al operador:
 *   · `PANEL_BLOQUEADO`      → no se resuelve solo; reubicar es la única salida.
 *   · `REGISTRO_NO_VIGENTE`  → el profesional puede renovar; puede resolverse sin reubicar.
 * El contraste es por ACCIÓN, no por tiempo: el MOTIVO dice SI puede esperar; el ORDEN (franja más
 * próxima) dice CUÁNDO. Sin plazos, sin estado de cuenta, sin insinuar reubicación automática.
 *
 * Record COMPLETO (no Partial): el compilador exige cubrir CADA `MotivoReubicacion`. El candado
 * `reubicacion-motivo-copy.candado.test.ts` exige, además, que los dos NUNCA lean igual — para que
 * nadie «unifique» el copy más adelante y el operador vuelva a no poder distinguir la acción.
 */
export const COPY_MOTIVO_REUBICACION: Record<MotivoReubicacion, CopyMotivoReubicacion> = {
    PANEL_BLOQUEADO: {
        titulo: "El profesional no puede entrar a su panel",
        detalle: "No puede resolverlo por su cuenta → reubicar es la única salida.",
    },
    REGISTRO_NO_VIGENTE: {
        titulo: "Inscripción en el registro no vigente",
        detalle: "El profesional sigue operando y puede renovar (ya se le avisó) → puede resolverse sin reubicar.",
    },
    // SPEC-836 · PLACEHOLDER · el copy lo emite Diseño (lo pidió el CEO; cubre DOS marcos: «nuestra
    // verificación envejeció» y «el registro no cubre esta modalidad y aún no se le avisó»). La página NO
    // está en el menú (no es alcanzable) hasta que 832 la cierre; se reemplaza al llegar la forma. El
    // candado exige que este motivo NUNCA contenga «avis…» (813 no lo bannerea) ni lea igual que los otros.
    REVISION_INTERNA: {
        titulo: "[Motivo pendiente de Diseño]",
        detalle: "[Texto pendiente de Diseño]",
    },
};
