/**
 * SPEC-017 — Índice maestro del módulo de documentación navegable (3 capas).
 * Deriva del índice aprobado en `specs/017-documentacion/plan.md`: cada tema
 * apunta SOLO a documentos reales del repo (no se inventa contenido; el viewer
 * los renderiza tal cual). La capa decide el acceso:
 *   1 = semi-público (sin login, sin PII) · 2 = autenticado · 3 = ADMIN/SCHOOL_ADMIN.
 */

export type CapaDocs = 1 | 2 | 3;

export interface DocumentoDocs {
    /** Ruta relativa al root del producto (allowlist del lector). */
    ruta: string;
    titulo: string;
}

export interface TemaDocs {
    slug: string;
    titulo: string;
    descripcion: string;
    capa: CapaDocs;
    documentos: DocumentoDocs[];
}

export const INDICE_DOCS: TemaDocs[] = [
    // ── Capa 1 — Qué y por qué (público general, aliados, prensa) ────────────
    {
        slug: "que-y-por-que",
        titulo: "Qué es y por qué existe",
        descripcion:
            "La barrera de denuncia frente al grooming y la propuesta de valor: un registro agregado, anónimo y verificable que detecta patrones sin exponer a las víctimas.",
        capa: 1,
        documentos: [
            { ruta: "README.md", titulo: "Introducción del proyecto" },
            { ruta: "specs/003-frontend-publico/spec.md", titulo: "Motivación y público objetivo (SPEC-003)" },
        ],
    },
    {
        slug: "marco-legal",
        titulo: "Marco normativo y prudencia jurídica",
        descripcion:
            "Menores de edad, datos sensibles y responsabilidad de plataforma: por qué no se publican contenidos de reportes ni datos personales.",
        capa: 1,
        documentos: [
            { ruta: "specs/006-paginas-legales/spec.md", titulo: "Páginas legales (SPEC-006)" },
        ],
    },
    {
        slug: "funcionalidades",
        titulo: "Catálogo de funcionalidades",
        descripcion:
            "Qué hace cada funcionalidad de la plataforma: reportar, consulta pública, clasificación IA, visibilidad, apelaciones y panel de administración.",
        capa: 1,
        documentos: [
            { ruta: "specs/README.md", titulo: "Índice maestro de especificaciones" },
            { ruta: "IMPLEMENTATION-REPORT.md", titulo: "Reporte global de implementación" },
        ],
    },

    // ── Capa 2 — Cómo funciona (usuarios autenticados) ───────────────────────
    {
        slug: "flujo-reporte",
        titulo: "Flujo de un reporte de punta a punta",
        descripcion:
            "Del formulario a la cola, el pipeline de IA (embedding, deduplicación, clasificación, guardas), la revisión humana y la visibilidad pública.",
        capa: 2,
        documentos: [
            { ruta: "docs/ARCHITECTURE.md", titulo: "Arquitectura del sistema (flujo de un reporte)" },
            { ruta: "specs/010-rediseño-clasificador-ia/spec.md", titulo: "Clasificador IA (SPEC-010)" },
            { ruta: "specs/015-anti-abuso/spec.md", titulo: "Anti-abuso (SPEC-015)" },
        ],
    },
    {
        slug: "panel-admin",
        titulo: "Módulos del panel de administración",
        descripcion:
            "Cómo operar cada módulo del panel: configuración del sistema, centro de control IA, anti-abuso, estadísticas y círculo de confianza.",
        capa: 2,
        documentos: [
            { ruta: "docs/configuracion/parametros-sistema.md", titulo: "Referencia de parámetros del sistema" },
            { ruta: "specs/011-centro-control-ia/spec.md", titulo: "Centro de Control IA (SPEC-011)" },
            { ruta: "specs/016-circulo-confianza/spec.md", titulo: "Círculo de Confianza (SPEC-016)" },
        ],
    },

    // ── Capa 3 — Por dentro (equipo técnico, DevOps, auditoría) ──────────────
    {
        slug: "arquitectura",
        titulo: "Arquitectura y stack",
        descripcion:
            "Next.js + Prisma + PostgreSQL/pgvector + pg-boss + Ollama local: estructura del código, modelo de datos y línea base generada.",
        capa: 3,
        documentos: [
            { ruta: "docs/ARCHITECTURE.md", titulo: "Arquitectura del sistema" },
            { ruta: "docs/architecture/00-INDICE.md", titulo: "Línea base de arquitectura (índice)" },
            { ruta: "docs/architecture/01-modelo-datos.md", titulo: "Modelo de datos (generado)" },
            { ruta: "docs/architecture/06-stack.md", titulo: "Stack y despliegue (generado)" },
        ],
    },
    {
        slug: "despliegue",
        titulo: "Despliegue y operación",
        descripcion:
            "Checklist de despliegue, variables de entorno críticas, app + worker, rollback por paso y jobs de mantenimiento.",
        capa: 3,
        documentos: [
            { ruta: "docs/despliegue.md", titulo: "Procedimiento de despliegue" },
            { ruta: "docs/despliegue-v2-checklist.md", titulo: "Checklist de despliegue v2" },
            { ruta: "docs/runbook.md", titulo: "Runbook operativo" },
        ],
    },
    {
        slug: "deuda-tecnica",
        titulo: "Deuda técnica y decisiones conscientes",
        descripcion:
            "Inventario de deuda técnica: qué se acepta, por qué, y qué necesita spec futura.",
        capa: 3,
        documentos: [
            { ruta: "docs/deuda-tecnica.md", titulo: "Deuda técnica clasificada" },
        ],
    },
];

const RUTAS_PERMITIDAS = new Map<string, { tema: TemaDocs; documento: DocumentoDocs }>();
for (const tema of INDICE_DOCS) {
    for (const documento of tema.documentos) {
        RUTAS_PERMITIDAS.set(documento.ruta, { tema, documento });
    }
}

/** Allowlist del lector: solo las rutas declaradas en el índice son leíbles. */
export function buscarDocumentoPermitido(ruta: string) {
    return RUTAS_PERMITIDAS.get(ruta) ?? null;
}

/** Capas visibles para un rol (null = anónimo). */
export function capasVisibles(rol: string | null | undefined): CapaDocs[] {
    if (rol === "ADMIN" || rol === "SCHOOL_ADMIN") return [1, 2, 3];
    if (rol) return [1, 2];
    return [1];
}

export function temasVisibles(rol: string | null | undefined): TemaDocs[] {
    const capas = new Set(capasVisibles(rol));
    return INDICE_DOCS.filter((t) => capas.has(t.capa));
}
