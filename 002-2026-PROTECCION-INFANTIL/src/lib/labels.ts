export const RIESGO_LABELS: Record<string, string> = {
    BAJO: "Bajo",
    MEDIO: "Medio",
    ALTO: "Alto",
    CRITICO: "Crítico",
    SIN_CLASIFICAR: "Sin clasificar",
};

export const RIESGO_COLORS: Record<string, string> = {
    BAJO: "bg-emerald-500",
    MEDIO: "bg-amber-500",
    ALTO: "bg-orange-500",
    CRITICO: "bg-red-500",
    SIN_CLASIFICAR: "bg-slate-400",
};

export const RIESGO_TEXT_COLORS: Record<string, string> = {
    BAJO: "text-emerald-700 dark:text-emerald-400",
    MEDIO: "text-amber-700 dark:text-amber-400",
    ALTO: "text-orange-700 dark:text-orange-400",
    CRITICO: "text-red-700 dark:text-red-400",
    SIN_CLASIFICAR: "text-slate-500 dark:text-slate-400",
};

export const CATEGORIAS_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    OTRO: "Otro",
};

export function formatNivel(nivel: string) {
    return RIESGO_LABELS[nivel] || nivel;
}

export function formatCategoria(categoria: string) {
    return CATEGORIAS_LABELS[categoria] || categoria;
}
