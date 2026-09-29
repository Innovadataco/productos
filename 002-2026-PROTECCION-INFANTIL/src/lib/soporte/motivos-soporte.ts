/**
 * SPEC-752 · Copy CERRADO de la puerta de PQR/soporte (FORMA-SPEC752, Diseño, v1.0).
 *
 * Fuente ÚNICA de lo que ve el padre (voz tú). Los VALORES son los del enum
 * MotivoPeticionServicio (el candado exige paridad: todo motivo del enum tiene copy y
 * ninguna clave sobra). El orden es el de la FORMA; el motivo 1 (habeas data, Ley 1581)
 * va primero — la puerta de habeas data es ESTE motivo, no una segunda puerta.
 *
 * Disciplina de la FORMA: motivos CERRADOS, SIN texto libre (imposibilidad estructural),
 * SIN plazo en la UI (el término legal lo cuenta el backend por motivo; ver
 * `plazo-peticion.ts`). El copy dice el QUÉ pasa después, nunca el CUÁNDO.
 */
import { MotivoPeticionServicio } from "@prisma/client";

export interface MotivoSoporte {
    /** Clave del enum MotivoPeticionServicio (lo que se persiste). */
    readonly valor: MotivoPeticionServicio;
    /** Lo que ve el padre (tú). Copy VERBATIM de la FORMA. */
    readonly titulo: string;
    /** Aclaración opcional bajo el título (VERBATIM de la FORMA). */
    readonly subtitulo?: string;
}

/** Los 5 motivos, en el orden de la FORMA. Copy de Diseño — no editar sin Diseño. */
export const MOTIVOS_SOPORTE: readonly MotivoSoporte[] = [
    { valor: "DATOS_PERSONALES", titulo: "Mis datos personales", subtitulo: "conocer, corregir o eliminar lo que tienen sobre mí" },
    { valor: "PAGO_O_COBRO", titulo: "Un pago o un cobro" },
    { valor: "CITA", titulo: "Una cita", subtitulo: "algo que no pude resolver desde la cita" },
    { valor: "SERVICIO_PLATAFORMA", titulo: "El servicio de la plataforma", subtitulo: "una queja o una sugerencia" },
    { valor: "OTRA", titulo: "Otra solicitud" },
];

/** Copy del encabezado y la acción (FORMA §2). Voz tú, sin plazo. */
export const COPY_PUERTA_SOPORTE = {
    titulo: "¿Sobre qué necesitas escribirnos?",
    subtitulo: "Elige el tema y nuestro equipo de soporte te responde.",
    enviar: "Enviar",
    numeroSeguimientoLabel: "Número de seguimiento",
} as const;

/**
 * Confirmación (FORMA §2.3): dice el QUÉ (recibimos · la revisa soporte · te responde
 * por aquí · queda con seguimiento) y NUNCA el CUÁNDO (ningún plazo). `tituloMotivo` es
 * el título del motivo elegido. El número de seguimiento se muestra aparte (no se
 * interpola acá para conservar el copy de Diseño intacto).
 */
export function confirmacionSoporte(tituloMotivo: string): string {
    return `Listo. Recibimos tu solicitud sobre ${tituloMotivo}. Nuestro equipo de soporte la revisa y te responde por aquí. Queda con un número de seguimiento para que consultes su estado.`;
}

/** Título del motivo por su valor de enum (para armar la confirmación). */
export function tituloDeMotivo(valor: string): string {
    return MOTIVOS_SOPORTE.find((m) => m.valor === valor)?.titulo ?? "tu solicitud";
}
