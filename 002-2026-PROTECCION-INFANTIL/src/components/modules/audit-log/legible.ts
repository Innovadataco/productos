/**
 * SPEC-129 (C6, O-4): auditoría legible para un rector no técnico.
 * Traduce acciones a frases naturales y el detalle a pares etiqueta-valor,
 * nunca JSON crudo. Es PRESENTACIÓN sobre la vista ya autorizada del colegio:
 * no amplía acceso (sin denunciante, sin texto de reportes, sin otros tenants).
 */

const FRASES_COLEGIO: Record<string, string> = {
    COLEGIO_CREADO: "Se creó el colegio",
    COLEGIO_ACTUALIZADO: "Se actualizaron los datos del colegio",
    COLEGIO_DESACTIVADO: "Se desactivó el colegio",
    COLEGIO_REACTIVADO: "Se reactivó el colegio",
    COLEGIO_PASSWORD_REGENERADA: "Se restableció la contraseña del administrador",
    COLEGIO_EMAIL_REENVIADO: "Se reenviaron las credenciales por email",
    COLEGIO_CURSO_CREADO: "Se creó un curso",
    COLEGIO_CURSO_EDITADO: "Se editó un curso",
    COLEGIO_CURSO_DESACTIVADO: "Se desactivó un curso",
    COLEGIO_ALUMNO_CREADO: "Se agregó un alumno",
    COLEGIO_ALUMNO_EDITADO: "Se editó un alumno",
    COLEGIO_ALUMNO_DESACTIVADO: "Se desactivó un alumno",
    COLEGIO_IDENTIFICADOR_CREADO: "Se registró un identificador",
    COLEGIO_IDENTIFICADOR_EDITADO: "Se editó un identificador",
    COLEGIO_IDENTIFICADOR_DESACTIVADO: "Se desactivó un identificador",
    COLEGIO_CARGA_MASIVA: "Carga masiva de alumnos",
    COLEGIO_ALERTA_CREADA: "Nueva alerta registrada",
    COLEGIO_ALERTA_ESTADO: "Cambio de estado de una alerta",
    COLEGIO_ESTADISTICAS_PDF_DESCARGADO: "Se descargó el informe PDF",
};

function humanizarClave(clave: string): string {
    const palabras = clave
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase();
    return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

/** Frase natural de una acción (fallback: enum humanizado, nunca el literal crudo). */
export function fraseAccionLegible(accion: string): string {
    const frase = FRASES_COLEGIO[accion];
    if (frase) return frase;
    return humanizarClave(accion);
}

const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatearValor(valor: unknown): string {
    if (valor === null || valor === undefined) return "—";
    if (typeof valor === "boolean") return valor ? "Sí" : "No";
    if (typeof valor === "number") return String(valor);
    if (typeof valor === "string") {
        if (REGEX_FECHA_ISO.test(valor)) {
            const fecha = new Date(valor);
            return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
        }
        return valor;
    }
    // Objetos/arrays anidados: raro en estos metadatos; se muestran compactos, no en bloque.
    return JSON.stringify(valor);
}

export interface ParDetalle {
    clave: string;
    valor: string;
}

/**
 * Detalle como pares etiqueta-valor (para la vista expandida, que sigue
 * colapsada por defecto). Si el valor no es JSON de objeto, se devuelve como texto.
 */
export function detalleLegible(valor: string | null): ParDetalle[] {
    if (!valor) return [];
    try {
        const parsed = JSON.parse(valor);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return Object.entries(parsed as Record<string, unknown>).map(([clave, v]) => ({
                clave: humanizarClave(clave),
                valor: formatearValor(v),
            }));
        }
        return [{ clave: "Detalle", valor: formatearValor(parsed) }];
    } catch {
        return [{ clave: "Detalle", valor }];
    }
}
