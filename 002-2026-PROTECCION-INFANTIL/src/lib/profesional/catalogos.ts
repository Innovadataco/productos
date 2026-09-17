/**
 * SPEC-685 · Catálogos cerrados de la ficha del profesional (REPORTE-061): profesión
 * (única), áreas de atención (múltiple, agrupadas) y rango etario (múltiple). Se
 * SIEMBRAN como parámetro del sistema para que el administrador los ajuste sin tocar
 * código; el runtime los lee del parámetro y, si falta o está corrupto, cae al DEFAULT
 * de acá (evita el «parámetro ausente → 500»). La API valida contra estas claves —
 * no basta el `<select>` (PR2).
 *
 * Lo que se guarda en `PerfilProfesional` son las CLAVES (`psicologo`, `ansiedad`,
 * `6-11`), no los nombres visibles: el nombre se puede editar sin romper los datos.
 * La taxonomía de áreas es de PRODUCTO (sin fuente gremial que la cierre) y por eso
 * vive en un parámetro editable — REPORTE-061 la marca pendiente de visto clínico.
 *
 * Este módulo es DATOS PUROS (constantes + semillas + helpers de claves): lo importa
 * el seed sin arrastrar Prisma. Los LECTORES contra el parámetro y el validador de la
 * API van en el PR2 (la ficha usa el catálogo y la API rechaza fuera de catálogo).
 */

export interface OpcionCatalogo {
    clave: string;
    nombre: string;
}
export interface GrupoAreas {
    grupo: string;
    items: OpcionCatalogo[];
}

/** Claves de parámetro del sistema (las edita el admin). */
export const CLAVE_CAT_PROFESION = "catalogo.profesion";
export const CLAVE_CAT_AREAS = "catalogo.areas_atencion";
export const CLAVE_CAT_RANGO_ETARIO = "catalogo.rango_etario";

/** DEFAULT · Catálogo 1 (REPORTE-061): núcleo inequívoco para la consulta del padre. */
export const PROFESION_DEFAULT: OpcionCatalogo[] = [
    { clave: "psicologo", nombre: "Psicólogo/a" },
    { clave: "psiquiatra", nombre: "Médico Psiquiatra" },
];

/** DEFAULT · Catálogo 2 (REPORTE-061): ~20 áreas en 6 grupos, multi-selección. */
export const AREAS_ATENCION_DEFAULT: GrupoAreas[] = [
    {
        grupo: "Estado emocional / ánimo",
        items: [
            { clave: "ansiedad", nombre: "Ansiedad" },
            { clave: "depresion_animo", nombre: "Depresión y estado de ánimo" },
            { clave: "manejo_emociones", nombre: "Manejo de emociones" },
        ],
    },
    {
        grupo: "Conducta y desarrollo",
        items: [
            { clave: "conducta", nombre: "Problemas de conducta" },
            { clave: "tdah", nombre: "TDAH y atención" },
            { clave: "tea", nombre: "Espectro autista (TEA)" },
            { clave: "aprendizaje", nombre: "Dificultades de aprendizaje" },
        ],
    },
    {
        grupo: "Eventos difíciles / trauma",
        items: [
            { clave: "duelo", nombre: "Duelo y pérdida" },
            { clave: "maltrato_abuso", nombre: "Maltrato o abuso" },
            { clave: "tept", nombre: "Estrés postraumático" },
            { clave: "violencia_intrafamiliar", nombre: "Violencia intrafamiliar" },
        ],
    },
    {
        grupo: "Escuela y vida social",
        items: [
            { clave: "acoso_escolar", nombre: "Acoso escolar (bullying / ciberacoso)" },
            { clave: "habilidades_sociales", nombre: "Habilidades sociales" },
            { clave: "pantallas", nombre: "Uso problemático de pantallas" },
        ],
    },
    {
        grupo: "Familia y crianza",
        items: [
            { clave: "crianza", nombre: "Orientación a padres y pautas de crianza" },
            { clave: "cambios_familiares", nombre: "Cambios familiares (separación)" },
        ],
    },
    {
        grupo: "Alta sensibilidad (riesgo)",
        items: [
            { clave: "autolesion_ideacion", nombre: "Autolesión / ideación suicida" },
            { clave: "conducta_alimentaria", nombre: "Conducta alimentaria" },
            { clave: "consumo_sustancias", nombre: "Consumo de sustancias" },
        ],
    },
];

/** DEFAULT · Rango etario (REPORTE-061): reemplaza a «Niños». Múltiple. */
export const RANGO_ETARIO_DEFAULT: OpcionCatalogo[] = [
    { clave: "0-5", nombre: "Primera infancia (0–5)" },
    { clave: "6-11", nombre: "Niñez (6–11)" },
    { clave: "12-17", nombre: "Adolescencia (12–17)" },
];

/** Todas las claves válidas de un catálogo plano. */
export const clavesDe = (opciones: OpcionCatalogo[]): Set<string> => new Set(opciones.map((o) => o.clave));
/** Todas las claves válidas de un catálogo agrupado (aplana los grupos). */
export const clavesDeAreas = (grupos: GrupoAreas[]): Set<string> =>
    new Set(grupos.flatMap((g) => g.items.map((i) => i.clave)));

/**
 * Semillas para `prisma/seed.ts` y el sembrado de test: el DEFAULT como JSON. El admin
 * las edita después; el seed solo garantiza que existan (upsert que NO pisa el valor
 * editado — `update: {}`).
 */
export const SEMILLAS_CATALOGO_PROFESIONAL = [
    { clave: CLAVE_CAT_PROFESION, valor: JSON.stringify(PROFESION_DEFAULT), descripcion: "SPEC-685 · profesiones habilitadas (única). Editable por admin." },
    { clave: CLAVE_CAT_AREAS, valor: JSON.stringify(AREAS_ATENCION_DEFAULT), descripcion: "SPEC-685 · áreas de atención (múltiple, agrupadas). Editable por admin." },
    { clave: CLAVE_CAT_RANGO_ETARIO, valor: JSON.stringify(RANGO_ETARIO_DEFAULT), descripcion: "SPEC-685 · rango etario (múltiple). Editable por admin." },
] as const;
