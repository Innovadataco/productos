// src/components/bi/geo/nombres-pais.ts · Traducción de nombres de país ES → EN
// Producto 006 · BI v2
//
// El catálogo "Pais" de la réplica guarda los nombres EN ESPAÑOL, pero el
// GeoJSON local del mapa (/geo/world-countries.json, técnica del dashboard
// público de PI) usa los nombres OFICIALES EN INGLÉS de cada feature
// (properties.name). Para pintar el choropleth hay que cruzar ambos mundos:
// este mapa traduce el nombre ES del ResultSet al nombre EN del GeoJSON.
//
// Copiado de 002-2026-PROTECCION-INFANTIL/src/components/modules/
// MapaUbicaciones.tsx (NOMBRE_PAIS_ES_EN + normalizarNombre): la misma
// réplica, el mismo catálogo y el mismo GeoJSON, así que el vocabulario
// ES → EN debe ser idéntico en ambos productos.

/**
 * Nombre ES normalizado → nombre EN del GeoJSON. Solo entran países cuyo
 * nombre difiere entre catálogo (español) y GeoJSON (inglés oficial); los
 * homónimos (Colombia, Brasil…) pasan directos por la normalización.
 */
export const NOMBRE_PAIS_ES_EN: Record<string, string> = {
    "estados unidos": "United States of America",
    mexico: "Mexico",
    espana: "Spain",
    brasil: "Brazil",
    argentina: "Argentina",
    colombia: "Colombia",
    peru: "Peru",
    chile: "Chile",
    venezuela: "Venezuela",
    ecuador: "Ecuador",
    bolivia: "Bolivia",
    paraguay: "Paraguay",
    uruguay: "Uruguay",
    "costa rica": "Costa Rica",
    panama: "Panama",
    guatemala: "Guatemala",
    honduras: "Honduras",
    "el salvador": "El Salvador",
    nicaragua: "Nicaragua",
    cuba: "Cuba",
    "republica dominicana": "Dominican Republic",
    "puerto rico": "Puerto Rico",
    haiti: "Haiti",
    jamaica: "Jamaica",
    canada: "Canada",
    "reino unido": "United Kingdom",
    francia: "France",
    alemania: "Germany",
    italia: "Italy",
    "paises bajos": "Netherlands",
    belgica: "Belgium",
    suiza: "Switzerland",
    austria: "Austria",
    portugal: "Portugal",
    suecia: "Sweden",
    noruega: "Norway",
    dinamarca: "Denmark",
    finlandia: "Finland",
    polonia: "Poland",
    "republica checa": "Czech Republic",
    hungria: "Hungary",
    rumania: "Romania",
    bulgaria: "Bulgaria",
    grecia: "Greece",
    turquia: "Turkey",
    ucrania: "Ukraine",
    rusia: "Russia",
    china: "China",
    japon: "Japan",
    "corea del sur": "South Korea",
    india: "India",
    indonesia: "Indonesia",
    filipinas: "Philippines",
    tailandia: "Thailand",
    vietnam: "Vietnam",
    malasia: "Malaysia",
    singapur: "Singapore",
    australia: "Australia",
    "nueva zelanda": "New Zealand",
    sudafrica: "South Africa",
    nigeria: "Nigeria",
    egipto: "Egypt",
    marruecos: "Morocco",
    argelia: "Algeria",
    tunisia: "Tunisia",
    libia: "Libya",
    "arabia saudita": "Saudi Arabia",
    "emiratos arabes unidos": "United Arab Emirates",
    israel: "Israel",
    "palestina estado de": "State of Palestine",
    qatar: "Qatar",
    kuwait: "Kuwait",
    irak: "Iraq",
    iran: "Iran",
    pakistan: "Pakistan",
    afganistan: "Afghanistan",
    bangladesh: "Bangladesh",
    nepal: "Nepal",
    myanmar: "Myanmar",
    "sri lanka": "Sri Lanka",
    camboya: "Cambodia",
    laos: "Laos",
    mongolia: "Mongolia",
    "corea del norte": "North Korea",
    kazajistan: "Kazakhstan",
    uzbekistan: "Uzbekistan",
    turkmenistan: "Turkmenistan",
    kirguistan: "Kyrgyzstan",
    tayikistan: "Tajikistan",
};

/** Normaliza un nombre de país para cruzar catálogo ↔ GeoJSON: sin tildes,
 *  minúsculas, separadores unificados. Presentación pura (no es un dato). */
export function normalizarNombrePais(nombre: string): string {
    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/**
 * Nombre del catálogo (español) → nombre de la feature del GeoJSON (inglés
 * oficial). Sin traducción conocida devuelve el nombre normalizado: si el
 * GeoJSON lo trae igual, el cruce funciona; si no, el país queda sin relleno
 * (nunca se inventa un conteo — candado 9).
 */
export function nombreGeoJsonPais(pais: string): string {
    const norm = normalizarNombrePais(pais);
    return NOMBRE_PAIS_ES_EN[norm] ?? norm;
}
