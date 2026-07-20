export type ParamType = "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | "JSON" | "STRING_ARRAY";

export type Param = {
    id: string;
    clave: string;
    valor: string;
    tipo: ParamType;
    categoria: string;
    esPublico: boolean;
    esSecreto: boolean;
    descripcion: string | null;
};

export const SECTIONS: { key: string; label: string; description: string; prefixes: string[] }[] = [
    { key: "scoring", label: "Modelo de Score (F1)", description: "Pesos y umbrales que calculan el score de riesgo 0-100.", prefixes: ["scoring."] },
    { key: "visibility", label: "Visibilidad Pública", description: "Reglas para que un identificador aparezca en la consulta pública.", prefixes: ["visibility."] },
    { key: "alerts", label: "Alertas por Email", description: "Activar/desactivar notificaciones a administradores y suscriptores.", prefixes: ["alerts."] },
    { key: "ratelimit", label: "Rate Limiting", description: "Límites de peticiones por ventana de tiempo.", prefixes: ["ratelimit."] },
    { key: "reportes", label: "Procesamiento de Reportes", description: "Modelos de IA, umbrales de duplicados y parámetros del worker.", prefixes: ["reportes."] },
    { key: "ui", label: "Interfaz de usuario", description: "Parámetros visibles para usuarios finales, como SLA de seguimiento.", prefixes: ["ui."] },
    { key: "security", label: "Seguridad", description: "Intentos de login, duración de bloqueo, longitud de contraseña, etc.", prefixes: ["security."] },
    { key: "system", label: "Sistema", description: "Parámetros generales de la aplicación.", prefixes: ["system."] },
    { key: "other", label: "Otros", description: "Parámetros adicionales no agrupados.", prefixes: [] },
];

export function sectionForParam(param: Param) {
    return (
        SECTIONS.find((s) => s.prefixes.some((prefix) => param.clave.startsWith(prefix))) ||
        SECTIONS.find((s) => s.key === "other")!
    );
}

export function validateValue(param: Param, value: string): string | null {
    if ((value === "" || value === undefined) && !param.esSecreto) return "El valor es requerido";
    if (param.esSecreto && value === "") return null;
    if (param.tipo === "INTEGER") {
        if (!/^-?\d+$/.test(value)) return "Debe ser un número entero";
    }
    if (param.tipo === "FLOAT") {
        if (!/^-?\d+(\.\d+)?$/.test(value)) return "Debe ser un número decimal";
    }
    if (param.tipo === "BOOLEAN") {
        if (!/^(true|false)$/.test(value)) return "Debe ser true o false";
    }
    return null;
}
