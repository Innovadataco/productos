# Tasks — SPEC-115: Catálogo geográfico real LATAM y Centroamérica

- [x] T001 Spec-Kit: spec.md, plan.md, research.md, data-model.md, checklists/requirements.md.
- [x] T002 Migración aditiva: columnas `Ciudad.geonameId/nombreNormalizado/poblacion`, índices (GIN trgm + btree), `CREATE EXTENSION IF NOT EXISTS pg_trgm` (`prisma/migrations/20260729130000_catalogo_geografico_latam/`).
- [x] T003 [P] `src/lib/normalizar.ts`: normalización NFD sin diacríticos (única fuente) + test unitario.
- [x] T004 Script idempotente `scripts/importar-geonames.ts` (descarga caché, filtro sede/pob>0 + capa municipal ADM2, dedupe por nombre, enriquecimiento de existentes, UPSERT por geonameId, departamentos admin1, reporte de volúmenes).
- [x] T005 Endpoint `GET /api/ciudades/buscar` (Zod, rate-limit scope `ciudades_buscar`, SQL con índice trgm) + scope en `src/lib/rate-limit.ts` + parámetros en seed.
- [x] T006 [P] Tests del endpoint: encuentra sin tildes, limita, respeta país y departamento, anónimo OK, rate-limit no rompe (headers en 200 y 429).
- [x] T007 `src/components/ui/CiudadSearchSelect.tsx` (debounce, dropdown, atribución, estado vacío/429) + test de componente.
- [x] T008 Integrar buscador en `ReporteStepDetalle.tsx` (el paso vivo del wizard; `ReporteStepUbicacion.tsx` es código muerto — sin tocar) y `NuevoColegioPageClient.tsx` (cascada intacta); actualizar `ReporteWizard.test.tsx`.
- [x] T009 Degradación honesta: `sinUbicacion` en `/api/estadisticas-publicas`, prop en `MapaUbicaciones`, wiring en `PublicDashboard` y `ConsultaEnriquecidaClient`; tests (endpoint + prop al mapa).
- [x] T010 Atribución CC-BY en `src/app/privacidad/page.tsx` + pie del buscador.
- [x] T011 Carga REAL en BD dev (puerto 5433): Colombia 73 → 1.155; total 187 → 92.548 ciudades (92.540 con coordenadas), 33 → 351 departamentos, 18 → 19 países (BZ nuevo). Idempotencia verificada (2ª y 3ª ejecución CO: 0 insertadas, 0 duplicados).
- [x] T012 Gate bajo candado: tsc + lint + tests tocados + build; suite completa `npm run test` 1081/1082 (1 skipped, 0 fallos).
- [x] T013 cierre.md + commits selectivos (sin push; NO tocar specs/README.md ni docs/cola-nocturna-041.md).
