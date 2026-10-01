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
import { MotivoPeticionServicio, type TipoSolicitudHabeasData, type CalidadPeticionario, type ClaseDatoTitular } from "@prisma/client";

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

/**
 * SPEC-819 (FORMA-SPEC819, Diseño f9545ca) · la PREGUNTA de habeas data cuando el padre entra por
 * «Mis datos personales». Decisión del CEO: el sistema NO infiere el tipo (inferir = elegirle el plazo
 * legal; elegir mal = incumplir con cara de acierto) — se PREGUNTA en DOS ejes: QUÉ (tipo) y DE QUIÉN
 * (sujeto, obligatorio por el CHECK del registro). Copy VERBATIM de la FORMA: voz tú, cero lenguaje de
 * abogado («habeas data/titular/tratamiento/consulta/rectificación/supresión» NUNCA en lo que ve el
 * padre — eso vive en el `valor`, que no se renderiza), cero plazo. Mapea 1:1 a los tres tipos; no hay
 * cuarto (REVOCACION no existe en el enum).
 */

/** EJE A — ¿Qué quieres hacer? [NORMA] discriminador de TIPO. */
export interface OpcionTipoHabeasData {
    /** Enum TipoSolicitudHabeasData — se PERSISTE, NO se muestra. */
    readonly valor: TipoSolicitudHabeasData;
    /** Lo que ve el padre (tú). */
    readonly titulo: string;
    /** Aclaración en primera persona (voz del padre). */
    readonly aclaracion: string;
}
export const TIPOS_HABEAS_DATA: readonly OpcionTipoHabeasData[] = [
    { valor: "CONSULTA", titulo: "Ver qué datos tienen", aclaracion: "Quiero ver qué información personal tienen guardada." },
    { valor: "RECTIFICACION", titulo: "Corregir un dato equivocado", aclaracion: "Hay un dato que está mal o desactualizado y quiero que lo corrijan." },
    { valor: "SUPRESION", titulo: "Pedir que borren los datos", aclaracion: "Quiero pedir que eliminen la información personal." },
];

/**
 * [NORMA] verdad de la promesa: FIJO bajo «Pedir que borren los datos». Quitarlo/suavizarlo reintroduce
 * el falso borrado (Dec. 1377 art. 10): si la pregunta promete el borrado, una negativa legítima deja al
 * padre engañado. El verbo es «pedir», no un hecho consumado.
 */
export const COPY_SUPRESION_LIMITE =
    "No siempre se puede borrar todo: hay datos que la ley obliga a conservar. Revisaremos tu solicitud y te diremos qué procede.";

/** EJE B — ¿De quién son los datos? [NORMA] discriminador de SUJETO. La puerta del padre cubre 2 de las 3
 *  calidades (TITULAR_MAYORIA_EDAD —ex-menor sin cuenta— no es alcanzable desde acá, y es correcto). */
export interface OpcionSujetoHabeasData {
    readonly calidad: Extract<CalidadPeticionario, "TITULAR_CUENTA" | "REPRESENTANTE_LEGAL">;
    readonly titulo: string;
}
export const SUJETOS_HABEAS_DATA: readonly OpcionSujetoHabeasData[] = [
    { calidad: "TITULAR_CUENTA", titulo: "Míos" },
    { calidad: "REPRESENTANTE_LEGAL", titulo: "De mi hijo" },
];

/**
 * SPEC-827 · EJE C — ¿sobre QUÉ dato recae? El OBJETO de la petición: una o más CLASES cerradas. Solo para
 * RECTIFICACION/SUPRESION (CONSULTA no lleva objeto). Las etiquetas + ayudas son copy VERBATIM de Diseño
 * (FORMA-SPEC827, b87771e, voz tú · lenguaje de familia: NUNCA «identificador/nick/alias», «PII», «titular»,
 * «clase de dato»; «cuenta» para el círculo). RELATO_CITA ya tenía su copy (COPY_CORRECCION_RELATO / 780): su
 * etiqueta viene de aquí y sus LÍMITES se muestran aparte cuando se elige en una RECTIFICACION.
 * Orden = el del enum. Las SEIS clases tienen etiqueta → ninguna cae sin casilla (el derecho queda entero).
 */
export interface OpcionClaseDatoHabeas {
    readonly valor: ClaseDatoTitular;
    readonly etiqueta: string;
    /** Una línea de ayuda (qué incluye). Opcional: RELATO_CITA la explica en COPY_CORRECCION_RELATO. */
    readonly ayuda?: string;
}
export const CLASES_DATO_HABEAS: readonly OpcionClaseDatoHabeas[] = [
    { valor: "PERFIL", etiqueta: "Mis datos de cuenta", ayuda: "Tu nombre, tu correo y tu contacto." },
    { valor: "HIJOS", etiqueta: "Los datos de mis hijos", ayuda: "Lo que registraste de cada hijo." },
    { valor: "IDENTIFICADORES_CIRCULO", etiqueta: "Las cuentas que vigilo", ayuda: "Tu círculo de confianza — a quién le sigues la pista." },
    { valor: "RELATO_CITA", etiqueta: "Lo que le conté al profesional en una cita" },
    { valor: "CONTENIDO_REPORTE", etiqueta: "Lo que escribí en mis reportes", ayuda: "El texto de los reportes que enviaste." },
    { valor: "OTRO", etiqueta: "Otra cosa", ayuda: "Algo sobre tus datos que no está en la lista." },
];

/** Copy de apoyo de la pregunta (redacción libre NEUTRAL; el plazo NUNCA va acá). */
export const COPY_HABEAS_PREGUNTA = {
    ejeATitulo: "¿Qué quieres hacer?",
    ejeBTitulo: "¿De quién son los datos?",
    // SPEC-827 · título del eje C. Las OPCIONES son verbatim de Diseño (b87771e); este encabezado mantiene el
    // patrón de los ejes A/B (voz tú, familia). Se puede elegir más de una.
    ejeCTitulo: "¿Sobre qué datos?",
    ejeCAyuda: "Puedes elegir más de uno.",
    elegirHijo: "¿De cuál?",
    /** Borde (FORMA §2): el padre sin hijos registrados. La SALIDA accionable queda PENDIENTE de Diseño. */
    sinHijos: "No tienes un hijo registrado en tu cuenta.",
} as const;
