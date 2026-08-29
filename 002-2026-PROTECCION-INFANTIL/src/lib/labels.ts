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
    // SPEC-248 (002-PI-151): Ley 2564 de 2026 art. 6.
    CIBERACOSO: "Ciberacoso",
    HAPPY_SLAPPING: "Happy slapping",
    STALKING: "Stalking",
};

export function formatCategoria(categoria: string) {
    return CATEGORIAS_LABELS[categoria] || categoria;
}
