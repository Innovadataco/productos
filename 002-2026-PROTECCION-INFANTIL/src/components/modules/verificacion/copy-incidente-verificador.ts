/**
 * SPEC-787 · Copy de la bandeja «Reportes que no coinciden» (FORMA-SPEC753-INCIDENTE-VERIFICADOR).
 *
 * El principio que gobierna todo: el rótulo NO ADJUDICA. El sistema detecta que dos personas
 * dijeron cosas distintas — no sabe quién miente y no lo insinúa (ni palabra, ni color, ni orden).
 * «Vencido a favor del padre» aparece SOLO con el reloj LEGAL vencido y es un DEFAULT por
 * vencimiento (nuestra demora), NO un veredicto. Ámbar-ink en las confesiones (fuera de plazo /
 * vencido): falla operativa, CERO rubí, sin dramatismo. Voz usted (interno).
 */
import type { EstadoIncidenteContradiccion } from "@/lib/profesional/cita/estado-efectivo-incidente";

export const COPY_INCIDENTE = {
    rotulo: "Reportes que no coinciden",
    subtitulo: "El padre y el profesional respondieron distinto sobre si la cita se realizó.",
    ladoPadre: "El padre respondió",
    ladoProfesional: "El profesional respondió",
} as const;

/** Tono visual: ámbar (pendiente/confesión) o neutro (resuelto en plazo). NUNCA rubí. */
export type TonoIncidente = "ambar" | "neutro";

export interface CopiaEstadoIncidente {
    texto: string;
    tono: TonoIncidente;
}

/**
 * El copy del estado depende del estado Y del reloj (legal/interno): «a favor del padre» SOLO con
 * el reloj LEGAL vencido; un vencido INTERNO es «Vencido» a secas (forma §4). Sin eufemismo
 * («fuera del plazo», no «con demora») y sin dramatismo.
 */
export function copiaEstadoIncidente(estado: EstadoIncidenteContradiccion, relojLegal: boolean): CopiaEstadoIncidente {
    switch (estado) {
        case "ABIERTO":
            return { texto: "Abierto", tono: "ambar" };
        case "RESUELTO":
            return { texto: "Resuelto", tono: "neutro" };
        case "RESUELTO_TARDE":
            return { texto: "Resuelto — fuera del plazo", tono: "ambar" };
        case "VENCIDO_A_FAVOR_PADRE":
            return relojLegal
                ? { texto: "Vencido — procede a favor del padre por vencerse el plazo", tono: "ambar" }
                : { texto: "Vencido — fuera del plazo interno", tono: "ambar" };
    }
}

/** «Plazo legal · quedan X» / «Plazo interno · quedan X». Dice de dónde sale el plazo, no quién tiene razón. */
export function copiaReloj(relojLegal: boolean, quedanDiasHabiles: number): string {
    const etiqueta = relojLegal ? "Plazo legal" : "Plazo interno";
    return `${etiqueta} · quedan ${quedanDiasHabiles} día${quedanDiasHabiles === 1 ? "" : "s"} hábil${quedanDiasHabiles === 1 ? "" : "es"}`;
}

/** Etiqueta legible y NEUTRA de una respuesta cruda (enum/bool). Nunca «afirmación»/«negación». */
export function etiquetaRespuesta(pregunta: string, valor: string): string {
    if (pregunta === "SE_REALIZO") return valor === "true" ? "Sí se realizó" : "No se realizó";
    return valor; // los demás son enums cerrados; se muestran tal cual (mecánicos)
}
