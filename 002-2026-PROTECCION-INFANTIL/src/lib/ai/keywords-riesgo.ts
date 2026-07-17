/**
 * Diccionario estático de keywords de riesgo para supervisión determinística.
 *
 * Diseñado a partir de:
 * - Vocabulario de la Guía Grooming LATAM (sextorsión, deepfake/nudificación,
 *   MASNNA, grooming en juegos, secretismo/aislamiento).
 * - Casos fallados del eval de clasificación (DOXING no capturado, fronteras S3).
 *
 * Reglas:
 * - Lista versionable en git, auditable.
 * - Matching insensible a tildes/diacríticos mediante normalización NFD.
 * - Se prefieren frases de contexto sobre palabras sueltas para reducir FP.
 */

export interface KeywordsRiesgoResult {
    tieneMatch: boolean;
    keywords: string[]; // términos/frases detectadas (texto original)
    categoriaSugerida?: string;
}

interface KeywordRule {
    keyword: string;
    // Expresión regular en español normalizado (sin tildes). Se compila con flag i.
    regex: RegExp;
    categoriaSugerida?: string;
}

function normalizar(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function nfdPattern(raw: string): RegExp {
    return new RegExp(normalizar(raw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

// Frases completas o de contexto. Se guardan en español normalizado para legibilidad,
// pero el matching se hace contra texto normalizado.
const RULES: KeywordRule[] = [
    // Sextorsión / chantaje sexual
    { keyword: "sextorsion", regex: nfdPattern("sextorsion"), categoriaSugerida: "EXTORSION" },
    { keyword: "chantaje con fotos", regex: nfdPattern("chantaje con fotos"), categoriaSugerida: "EXTORSION" },
    { keyword: "chantaje con videos", regex: nfdPattern("chantaje con videos"), categoriaSugerida: "EXTORSION" },
    { keyword: "extorsion sexual", regex: nfdPattern("extorsion sexual"), categoriaSugerida: "EXTORSION" },
    { keyword: "si no me mandas fotos", regex: nfdPattern("si no me mandas fotos"), categoriaSugerida: "EXTORSION" },
    { keyword: "si no me mandas videos", regex: nfdPattern("si no me mandas videos"), categoriaSugerida: "EXTORSION" },
    { keyword: "publico tus fotos", regex: nfdPattern("publico tus fotos"), categoriaSugerida: "EXTORSION" },
    { keyword: "publico tus videos", regex: nfdPattern("publico tus videos"), categoriaSugerida: "EXTORSION" },
    { keyword: "filtro tus fotos", regex: nfdPattern("filtro tus fotos"), categoriaSugerida: "EXTORSION" },
    { keyword: "mando tus fotos a todos", regex: nfdPattern("mando tus fotos a todos"), categoriaSugerida: "EXTORSION" },

    // Deepfake / nudificación
    { keyword: "deepfake", regex: nfdPattern("deepfake"), categoriaSugerida: "CONTENIDO_GENERADO_IA" },
    { keyword: "foto falsa desnuda", regex: nfdPattern("foto falsa desnuda"), categoriaSugerida: "CONTENIDO_GENERADO_IA" },
    { keyword: "nudificacion", regex: nfdPattern("nudificacion"), categoriaSugerida: "CONTENIDO_GENERADO_IA" },
    { keyword: "desnudar la foto", regex: nfdPattern("desnudar la foto"), categoriaSugerida: "CONTENIDO_GENERADO_IA" },
    { keyword: "ia desnuda", regex: nfdPattern("ia desnuda"), categoriaSugerida: "CONTENIDO_GENERADO_IA" },
    { keyword: "inteligencia artificial desnuda", regex: nfdPattern("inteligencia artificial desnuda"), categoriaSugerida: "CONTENIDO_GENERADO_IA" },

    // MASNNA / material de abuso
    { keyword: "porno infantil", regex: nfdPattern("porno infantil"), categoriaSugerida: "OTRO" },
    { keyword: "menor desnudo", regex: nfdPattern("menor desnudo"), categoriaSugerida: "OTRO" },
    { keyword: "nino desnudo", regex: nfdPattern("nino desnudo"), categoriaSugerida: "OTRO" },
    { keyword: "nina desnuda", regex: nfdPattern("nina desnuda"), categoriaSugerida: "OTRO" },
    { keyword: "material de abuso sexual menor", regex: nfdPattern("material de abuso sexual menor"), categoriaSugerida: "OTRO" },
    { keyword: "masnna", regex: nfdPattern("masnna"), categoriaSugerida: "OTRO" },

    // Grooming en juegos: propuestas de encuentro/noviazgo en contexto de juego
    {
        keyword: "roblox + encuentro",
        regex: /(?:roblox|free\s*fire|minecraft)\b[^.!?]{0,60}\b(?:encontr(?:ar|arnos)|quedar|salir|ver(?:nos|te|lo|la|emos|amos)|veamos|vemos|novio|novia|pareja)/iu,
        categoriaSugerida: "SOLICITUD_ENCUENTRO",
    },
    {
        keyword: "juego + fotos",
        regex: /(?:roblox|free\s*fire|minecraft)\b[^.!?]{0,60}\b(?:fotos?|videos?|desnud|intim)/iu,
        categoriaSugerida: "SOLICITUD_MATERIAL",
    },

    // Secretismo / aislamiento
    { keyword: "no le digas a nadie", regex: /no\s+le\s+dig(?:as|a)\s+a\s+nadie/iu },
    { keyword: "es nuestro secreto", regex: nfdPattern("es nuestro secreto") },
    { keyword: "borra los mensajes", regex: /borr(?:a|e)\s+(?:los|el)\s+mensajes?/iu },
    { keyword: "no le cuentes", regex: nfdPattern("no le cuentes") },
    { keyword: "no digas nada", regex: /no\s+dig(?:as|a)\s+nada/iu },
    { keyword: "entre tu y yo", regex: nfdPattern("entre tu y yo") },

    // DOXING no capturado / intención de publicar datos personales
    { keyword: "publicar su direccion", regex: nfdPattern("publicar su direccion"), categoriaSugerida: "DOXING" },
    { keyword: "publicar su numero", regex: nfdPattern("publicar su numero"), categoriaSugerida: "DOXING" },
    { keyword: "publicar datos personales", regex: nfdPattern("publicar datos personales"), categoriaSugerida: "DOXING" },
    { keyword: "filtrar datos", regex: nfdPattern("filtrar datos"), categoriaSugerida: "DOXING" },
    { keyword: "doxear", regex: nfdPattern("doxear"), categoriaSugerida: "DOXING" },

    // Fronteras S3: difusión no consentida
    { keyword: "fotos mias circulan", regex: nfdPattern("fotos mias circulan"), categoriaSugerida: "DIFUSION_NO_CONSENTIDA" },
    { keyword: "se filtraron fotos", regex: nfdPattern("se filtraron fotos"), categoriaSugerida: "DIFUSION_NO_CONSENTIDA" },
    { keyword: "difundieron video intimo", regex: nfdPattern("difundieron video intimo"), categoriaSugerida: "DIFUSION_NO_CONSENTIDA" },
    { keyword: "compartieron fotos mias", regex: nfdPattern("compartieron fotos mias"), categoriaSugerida: "DIFUSION_NO_CONSENTIDA" },

    // Fronteras S3: contacto insistente
    { keyword: "no deja de escribirme", regex: nfdPattern("no deja de escribirme"), categoriaSugerida: "CONTACTO_INSISTENTE" },
    { keyword: "me molesta todo el tiempo", regex: nfdPattern("me molesta todo el tiempo"), categoriaSugerida: "CONTACTO_INSISTENTE" },
    { keyword: "me escribe constantemente", regex: nfdPattern("me escribe constantemente"), categoriaSugerida: "CONTACTO_INSISTENTE" },
];

export function detectarKeywordsRiesgo(texto: string): KeywordsRiesgoResult {
    const normalizado = normalizar(texto);
    const keywords: string[] = [];
    const categorias = new Set<string>();

    for (const rule of RULES) {
        if (rule.regex.test(normalizado)) {
            keywords.push(rule.keyword);
            if (rule.categoriaSugerida) {
                categorias.add(rule.categoriaSugerida);
            }
        }
    }

    // Quitar duplicados preservando orden
    const uniqueKeywords = Array.from(new Set(keywords));

    return {
        tieneMatch: uniqueKeywords.length > 0,
        keywords: uniqueKeywords,
        categoriaSugerida: categorias.size === 1 ? Array.from(categorias)[0] : undefined,
    };
}
