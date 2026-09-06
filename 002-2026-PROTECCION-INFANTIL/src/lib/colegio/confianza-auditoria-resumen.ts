/**
 * SPEC-576 (I-358) · «Resumen» del historial de auditoría del colegio — LISTA DECLARADA, no un
 * pretty-print del payload.
 *
 * El defecto: el origen mandaba el `valorNuevo` (payload JSON) como `resumen` — un canal que reenvía
 * lo que traiga, sin revisar. Misma clase que la publicación completa a BI que costó un P0: un payload
 * futuro con un campo sensible llegaría SOLO a la pantalla del rector. La forma correcta (Diseño): cada
 * acción DECLARA qué campos muestra y cómo se leen en español; los ids internos (comiteId, colegioId,
 * reporteId, entidadId, identificador*Id) NUNCA se leen — son la vía por donde un payload filtraría algo.
 *
 * Una acción sin renderer declarado → `null` → la UI muestra «—». NUNCA el payload: seguro por defecto,
 * no expuesto por defecto. Un tipo de acción nuevo aparece con «—» hasta que se le agrega su renderer.
 */

type Payload = Record<string, unknown>;

/** Lee un campo de allowlist como string no vacío, o null. Nunca alcanza ids ni campos no declarados. */
function campo(p: Payload, clave: string): string | null {
    const v = p[clave];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

const ROL_HUMANO: Record<string, string> = {
    COMITE_CONVIVENCIA: "Comité de convivencia",
};

const TIPO_EVENTO_HUMANO: Record<string, string> = {
    REPORTE_NUEVO: "reporte nuevo",
    UMBRAL_CURSO: "umbral de curso",
    ESTUDIANTE_REPETIDO: "estudiante repetido",
    RESUMEN_SEMANAL: "resumen semanal",
};

const TIPO_SUJETO_HUMANO: Record<string, string> = {
    ESTUDIANTE: "estudiante",
    PROFESOR: "profesor",
    ACUDIENTE: "acudiente",
};

/**
 * Renderers DECLARADOS: acción → frase en español, leyendo SOLO campos de allowlist. Devuelven null si
 * faltan los campos requeridos (→ «—»), nunca una frase a medias ni el payload.
 */
const RENDERERS: Record<string, (p: Payload) => string | null> = {
    COLEGIO_COMITE_INTEGRANTE_CREADO: (p) => {
        const nombres = campo(p, "nombres");
        const apellidos = campo(p, "apellidos");
        const cargo = campo(p, "cargo");
        if (!nombres || !apellidos || !cargo) return null;
        return `Se agregó a ${nombres} ${apellidos} como ${cargo} del comité.`;
    },
    COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO: (p) => {
        const mes = campo(p, "mes");
        return mes ? `Se descargó el informe mensual de ${mes}.` : null;
    },
    COLEGIO_COMITE_CREADO: (p) => {
        const email = campo(p, "email");
        const rol = campo(p, "rol");
        if (!email || !rol) return null;
        return `Se invitó a ${email} como ${ROL_HUMANO[rol] ?? rol}.`;
    },
    COLEGIO_ESTADISTICAS_PDF_DESCARGADO: () => "Se descargó el PDF de estadísticas.",
    COLEGIO_ALERTA_CREADA: (p) => {
        const tipoSujeto = campo(p, "tipoSujeto");
        if (!tipoSujeto) return null;
        return `Se creó una alerta sobre un ${TIPO_SUJETO_HUMANO[tipoSujeto] ?? tipoSujeto}.`;
    },
    COLEGIO_AVISO_ENVIADO: (p) => {
        const tipoEvento = campo(p, "tipoEvento");
        if (!tipoEvento) return null;
        return `Se envió un aviso: ${TIPO_EVENTO_HUMANO[tipoEvento] ?? tipoEvento}.`;
    },
    USER_CREATE: () => "Se creó un usuario de demostración.",
};

/**
 * Etiqueta humana de la columna «Acción». Los 3 primeros son de Diseño (§ del doc de 576); los 4
 * restantes los propuso Dev siguiendo el patrón participio (pendiente confirmación de Diseño). Cae al
 * enum crudo si la acción no tiene rótulo — mejor eso que romper, y el candado exige rótulo a las 7.
 */
const ACCION_LABEL: Record<string, string> = {
    COLEGIO_COMITE_INTEGRANTE_CREADO: "Integrante de comité agregado",
    COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO: "Informe mensual descargado",
    COLEGIO_COMITE_CREADO: "Usuario invitado",
    COLEGIO_ESTADISTICAS_PDF_DESCARGADO: "PDF de estadísticas descargado",
    COLEGIO_ALERTA_CREADA: "Alerta creada",
    COLEGIO_AVISO_ENVIADO: "Aviso enviado",
    USER_CREATE: "Usuario de demostración creado",
};

/** Acciones con renderer declarado (para el candado: todas deben tener también rótulo). */
export const ACCIONES_CON_RESUMEN = Object.keys(RENDERERS);

/**
 * Resumen DECLARADO de una fila de auditoría: una frase en español o null (→ la UI muestra «—»).
 * NUNCA devuelve el payload. `valorNuevo` es el payload serializado del audit log.
 */
export function resumenAuditoriaColegio(accion: string, valorNuevo: string | null): string | null {
    const render = RENDERERS[accion];
    if (!render) return null; // acción no mapeada → «—», jamás el JSON
    let payload: Payload;
    try {
        const parsed: unknown = valorNuevo ? JSON.parse(valorNuevo) : {};
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
        payload = parsed as Payload;
    } catch {
        return null; // payload ilegible → «—», jamás el crudo
    }
    return render(payload);
}

/** Etiqueta humana de la acción para la columna «Acción». Cae al enum crudo si no hay rótulo. */
export function accionLabelColegio(accion: string): string {
    return ACCION_LABEL[accion] ?? accion;
}
