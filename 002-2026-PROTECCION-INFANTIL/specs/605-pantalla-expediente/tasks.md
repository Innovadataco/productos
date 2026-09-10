# Tasks · SPEC-605 — Pantalla madre del EXPEDIENTE

**Status**: IMPLEMENTADO · Convención: `TNNN [P]` · orden por dependencias.

## Fase 1 — DAL: el DTO del expediente

- [x] T001 Exportar `SEVERIDAD_CATEGORIA` en `src/lib/riesgo-consulta.ts` (una sola fuente de severidad con la consulta pública). (FR-002)
- [x] T002 Crear `src/lib/dal/services/expediente-detalle.ts`: `listarExpedientesPadreConUrgencia` (urgencia + contadores + hijo), `detalleExpedientePadre` (5 bloques: semáforo, línea de tiempo unificada, evidencia, análisis + tendencia, ficha), `estadoFrescoExpediente`; helpers `codigoExpediente`/`urgenciaDeCategoria`; «no míos» con OR explícito (anónimo incluido); plataforma desde el reporte que abrió la cadena. (FR-001, FR-002, FR-003, FR-005, FR-006, FR-007, FR-009)

## Fase 2 — API: «Consultar estado»

- [x] T003 `src/app/api/padre/expedientes/[id]/estado/route.ts` (GET; PARENT dueño; solo estados y fechas; no viola el candado SPEC-340 del `GET [id]` borrado). (FR-006)

## Fase 3 — UI: pantalla madre y lista

- [x] T004 `src/components/modules/padre/ExpedienteMadreClient.tsx`: los 5 bloques en orden (cabecera con chip del menor + pill En proceso/Procesado + «Consultar estado» con refetch real · línea de tiempo unificada con nota de privacidad · evidencia con `TextoSensible` intacto · análisis con ficha + «¿Qué significa?» + tendencia · acciones con `AgregarEvento`, «Llevar a un profesional» `?expedienteId=` y canales oficiales). (FR-001…FR-006, FR-009)
- [x] T005 Reescribir `src/app/dashboard/padre/expedientes/[id]/page.tsx` sobre `detalleExpedientePadre` (serialización ISO).
- [x] T006 Reescribir `src/components/modules/padre/ExpedientesListClient.tsx`: tarjetas por urgencia (barra rubí/ámbar/menta/gris, chip del menor, EXP/id, semáforo, «N eventos tuyos · M familias más reportaron», última actividad, [Abrir] [+ Reportar evento]) + botón global «+ Reportar una situación»; conserva `AutoSuggestExpediente`; fuera los filtros de estado (derogación parcial documentada). (FR-007)
- [x] T007 Reescribir `src/app/dashboard/padre/expedientes/page.tsx` sobre `listarExpedientesPadreConUrgencia`.

## Fase 4 — Tests

- [x] T008 `src/lib/dal/services/expediente-detalle.test.ts` (10): hijo por `hijoId` con edad + fallback `IdentificadorHijo`; línea de tiempo mezclada y ordenada con grupo «2 familias más» y candado sin texto; SPAM fuera; tendencia subiendo/estable; análisis manual + semáforo con presunción de inocencia; dominante solo comunitaria → confianza `null` (nunca 0 % falso); estado EN_PROCESO→PROCESADO + titularidad; lista por urgencia con cerrados al final y contadores. (FR-001…FR-009)
- [x] T009 [P] `src/app/api/padre/expedientes/[id]/estado/route.test.ts` (2): refresco EN_PROCESO→PROCESADO con candado sin texto; 401/403/404. (FR-006)

## Fase 5 — Artefactos y gate

- [x] T010 Artefactos `specs/605-pantalla-expediente/` (spec.md con «Impacto en arquitectura:» — FR-008, plan.md, tasks.md, quickstart.md, checklists/requirements.md) + `specs/README.md` regenerado con `scripts/specs/generar-readme.ts`.
- [x] T011 Gate: `npx tsc --noEmit` · `npm run lint` · tests en 6 shards secuenciales · `npm run test:unit` · `npm run build` · `npm run arch:check` (VERDE sin regenerar: SPEC-487).

## Deuda técnica registrada

- `ExpedienteVivo.tsx` (mapa + reproducción + informes PDF de SPEC-340) queda SIN ruta que lo renderice (el mockup §2 no lo incluye); el archivo, su test unitario y los endpoints `lectura`/`analisis`/`pdf` siguen vivos. Reubicar o retirar: decisión de la siguiente ola (con ZEUS).
- `ExpedienteDetalleClient.tsx` (componente viejo sin consumidores desde antes de esta spec) sigue en disco; barrerlo en la limpieza de la siguiente ola.
