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
    // SPEC-574 (I-357): SPAM está en el enum y la máquina lo usa, pero faltaba acá — por eso se caía
    // del desplegable derivado. Rótulo consolidado desde la lista vieja de types.ts («Spam»).
    SPAM: "Spam",
    OTRO: "Otro",
    // SPEC-248 (002-PI-151): Ley 2564 de 2026 art. 6. Rótulos SPEC-574 (Diseño, c2fa62b):
    // «Agresión grabada» (no «Happy slapping» crudo en inglés) y «Acecho» (término legal, corto, no
    // se confunde con «Contacto insistente»). La máquina clasificó 699 reportes en estas tres y el
    // humano no podía elegir ninguna (I-357).
    CIBERACOSO: "Ciberacoso",
    HAPPY_SLAPPING: "Agresión grabada",
    STALKING: "Acecho",
};

export function formatCategoria(categoria: string) {
    return CATEGORIAS_LABELS[categoria] || categoria;
}
