/**
 * Etiquetas de presentación para enums crudos de PI (categorías de conducta,
 * etapas del pipeline, señales de salud). SOLO presentación: jamás calculan
 * ni filtran — los valores reales viajan crudos en los contratos de datos.
 */

/** Etiquetas legibles para el enum CategoriaConducta de PI. */
export const ETIQUETAS_CATEGORIA: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    SPAM: "Spam",
    CIBERACOSO: "Ciberacoso",
    HAPPY_SLAPPING: "Happy slapping",
    STALKING: "Stalking",
};

/** Etiquetas legibles para las etapas del pipeline (PasoProcesamiento.etapa). */
export const ETIQUETAS_ETAPA: Record<string, string> = {
    guardas: "Guardas / antifraude",
    deduplicacion: "Deduplicación semántica",
    contexto_rag: "RAG (dataset corregido)",
    decision: "Clasificación (votos)",
    match_detectado: "Match detectado",
};
