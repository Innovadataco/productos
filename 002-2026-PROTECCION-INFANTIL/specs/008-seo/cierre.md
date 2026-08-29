# Cierre — Spec 008: SEO y Metadatos

> **Cierre retrospectivo** (auditoría Spec Kit 2026-07-27, §3.2a): esta spec quedó CERRADA
> sin documento de cierre. Se reconstruye desde su spec.md y el estado verificable del
> código actual. No existen métricas de la época; no se inventan.

**Fecha original de la spec**: 2026-07-14 · **Status**: CERRADA

## Alcance entregado (verificable en el código actual)

- **Metadatos** (FR-001, FR-002, FR-005, FR-006): `metadata` y `viewport` en
  `src/app/layout.tsx`, sobrescritura en las páginas públicas (`/`, `/reportar`,
  `/seguimiento`, `/terminos`, `/privacidad`, `/offline`), canonical URL y OpenGraph básico
  (title, description, url).
- **robots y sitemap** (FR-003, FR-004): `src/app/robots.ts` con reglas públicas/privadas
  y `src/app/sitemap.ts` con las URLs públicas, respetando `NEXT_PUBLIC_APP_URL` (NFR-002).
- **Estáticos** (NFR-001): metadatos estáticos o generados en build, sin llamadas de BD
  para páginas públicas.

## Evidencia disponible hoy

- Los artefactos existen y son servidos en producción (`/robots.txt`, `/sitemap.xml`,
  etiquetas OG/canonical en el HTML público). Verificado de nuevo en los despliegues de la
  SPEC-097 (headers y HTML público).

## Nota de honestidad documental

No se recuperaron evidencias de la verificación original. El cierre se limita a contrastar
el alcance contra el código vigente.
