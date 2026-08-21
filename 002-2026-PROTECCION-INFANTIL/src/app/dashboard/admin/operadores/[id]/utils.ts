export const ESTADOS = [
    { value: "", label: "Todos los estados" },
    { value: "PENDIENTE", label: "Pendiente" },
    { value: "PROCESANDO", label: "Procesando" },
    { value: "CLASIFICADO", label: "Clasificado" },
    { value: "REVISION_MANUAL", label: "Revisión manual" },
    { value: "POSIBLE_SPAM", label: "Posible spam" },
    { value: "REQUIERE_ANONIMIZACION", label: "Requiere anonimización" },
    { value: "CORREGIDO", label: "Corregido" },
];

export const CATEGORIAS: Record<string, string> = {
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
    SPAM: "Spam",
    OTRO: "Otro",
};

export const PAGE_SIZE = 25;

export function formatCategoria(categoria: string | null): string {
    if (!categoria) return "—";
    return CATEGORIAS[categoria] || categoria.replace(/_/g, " ");
}

export function formatEstado(estado: string): string {
    return estado.replace(/_/g, " ");
}

export function formatDuracion(ms: number): string {
    const totalMinutos = Math.floor(ms / 60000);
    const dias = Math.floor(totalMinutos / 1440);
    const horas = Math.floor((totalMinutos % 1440) / 60);
    const minutos = totalMinutos % 60;
    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}

export function formatPorcentaje(value: number | null): string {
    if (value === null) return "—";
    return `${Math.round(value * 100)}%`;
}
