/**
 * SPEC-619 (I-371 · D-131) · Superficie de GET que MUTAN — LISTA COMPARTIDA (una sola fuente).
 *
 * La consumen DOS cosas y por eso vive acá y no duplicada:
 *  1. el candado `scripts/arch/no-get-muta.ts` (ratchet: un GET-que-muta NUEVO fuera de esta lista → rojo);
 *  2. el futuro chequeo `Sec-Fetch-Site` (Artefacto 1 de SPEC-619) que cierra la clase por construcción.
 * Dos listas se desincronizan y la que se queda vieja es la del candado (CEO) — por eso, una sola.
 *
 * Contexto: bajo `SameSite=Strict` (D-131) estos GET NO son CSRF-able — Strict no manda el JWT en una
 * navegación top-level cross-site, así que un enlace malicioso no autentica la escritura. La lista
 * existe para que, el día que entre `Lax` + el chequeo `Sec-Fetch-Site`, la superficie esté ACOTADA y
 * auditada, y para que hoy un GET-que-muta nuevo no se cuele en silencio.
 *
 * Fuente: barrido de SPEC-617 (REPORTE-SPEC-617-barrido-GET-muta), verificado a mano en los tiers A/B
 * y los bordes, y cruzado contra el código por Dev 1 al mapear el puente.
 */
export type TierGetMuta = "A-crea-registro" | "B-lectura-audit" | "C-audit-log";

export interface EntradaGetMuta {
    /** Ruta relativa a la raíz del producto (002-…/). */
    archivo: string;
    tipo: "route-GET" | "page-render";
    tier: TierGetMuta;
    razon: string;
}

export const SUPERFICIE_GET_MUTA: readonly EntradaGetMuta[] = [
    // Tier A — CREAN registro de negocio en GET (olor de diseño; ver anexo de SPEC-619).
    { archivo: "src/app/api/padre/expedientes/[id]/pdf/route.ts", tipo: "route-GET", tier: "A-crea-registro", razon: "registrarInformePadre: crea un InformePadre por descarga" },
    { archivo: "src/app/api/colegio/onboarding/route.ts", tipo: "route-GET", tier: "A-crea-registro", razon: "onboardingColegio.create perezoso en el primer GET" },
    // (SPEC-647/D-136) el callback OAuth de Google — el único GET cross-site legítimo, tier oauth-exento —
    // se retiró con el login de Google; sin superficie exenta, el tier oauth-exento ya no existe.

    // Tier B — escriben LecturaReporte (descifrado con registro de lectura).
    { archivo: "src/app/api/reportes/acceso/ver/route.ts", tipo: "route-GET", tier: "B-lectura-audit", razon: "leerExpedienteConSesion → una LecturaReporte por evento (lectura externa del expediente por pase; SPEC-610)" },
    { archivo: "src/app/api/admin/spam/pendientes/route.ts", tipo: "route-GET", tier: "B-lectura-audit", razon: "descifrarCamposReporte → una LecturaReporte por reporte en cola" },
    { archivo: "src/app/api/admin/comite/consolidacion/[expedienteId]/route.ts", tipo: "route-GET", tier: "B-lectura-audit", razon: "obtenerDetalleConsolidacion descifra relatos → LecturaReporte (vía servicio read-named; NO detectable por scan)" },
    { archivo: "src/app/api/admin/reportes/[id]/expediente/route.ts", tipo: "route-GET", tier: "B-lectura-audit", razon: "?revelar=true: armarEtapas descifra + logAudit TEXTO_ORIGINAL_REVELADO" },

    // Tier C — escriben AuditLog en GET.
    { archivo: "src/app/api/colegio/reportes/pdf/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "logAudit al exportar PDF" },
    { archivo: "src/app/api/colegio/analisis/comparativa/excel/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "logAudit al exportar Excel" },
    { archivo: "src/app/api/colegio/estadisticas/pdf/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "logAudit al exportar" },
    { archivo: "src/app/api/colegio/confianza/protocolo/pdf/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "logAudit al exportar" },
    { archivo: "src/app/api/admin/reportes/[id]/forense/pdf/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "logAuditNuevaAccion al exportar forense" },
    { archivo: "src/app/api/admin/verificacion-profesionales/[id]/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "logAudit incondicional al abrir la ficha" },
    { archivo: "src/app/api/admin/colegios/[id]/cursos/[cursoId]/alumnos/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "logAuditNuevaAccion al acceder al roster" },
    { archivo: "src/app/api/admin/padres/[id]/circulo-confianza/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "logAuditNuevaAccion al acceder al círculo" },
    { archivo: "src/app/api/admin/analisis/recomendaciones/export/route.ts", tipo: "route-GET", tier: "C-audit-log", razon: "registrarAuditoriaExport → auditLog.create" },

    // Páginas (Server Components) que escriben al RENDERIZAR — solo auditan (no crean registro).
    { archivo: "src/app/reportar/layout.tsx", tipo: "page-render", tier: "C-audit-log", razon: "logAudit REPORTE_SIN_SUSCRIPCION al render" },
    { archivo: "src/app/dashboard/admin/verificacion/[id]/page.tsx", tipo: "page-render", tier: "C-audit-log", razon: "logAudit PROFESIONAL_VERIFICACION_CONSULTADO al render" },
] as const;

/** Índice por archivo, para el candado. */
export const ARCHIVOS_GET_MUTA: ReadonlySet<string> = new Set(SUPERFICIE_GET_MUTA.map((e) => e.archivo));
