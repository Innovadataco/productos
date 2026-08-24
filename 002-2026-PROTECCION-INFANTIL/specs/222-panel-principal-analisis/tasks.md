# Tasks: SPEC-222 — Panel principal Análisis (Dinero vs Valor)

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/222-panel-analisis.md` de `specs/222-panel-principal-analisis/`.

**Hallazgos de arranque (contra el árbol real, 2026-08-24)**:

- H-1: SPEC-218 ya ocupa la ruta `/dashboard/admin/estadisticas/dinero-vs-valor` (page + tab en `EstadisticasSubNav`). FR-001 (tab) ya está cumplido; esta spec EXTIENDE esa página con los 5 bloques del panel sin tocar los 4 widgets ni los KPIs de pagos de SPEC-218 (convivencia, §2.2 del plan).
- H-2: SPEC-221 ya entregó `POST /api/admin/analisis/recomendaciones/[id]/resolver` con body `{ estado, motivo? }` + TX + AuditLog `RECOMENDACION_RESUELTA` (ya existe en `AccionAudit`; cero migraciones). Esta spec lo reutiliza y lo extiende de forma aditiva para aceptar también `accion` (contrato FR-004).
- H-3: Modelos `ScoreCliente`, `Recomendacion`, `Anomalia` ya están en el schema. Guard de tabla ausente de anomalías se mantiene como defensa (FR-010).

## Fase 1 — Helpers puros y schemas (TDD unitario, sin BD)

- [x] T001 [P] Helpers puros `src/lib/analisis/panel-calculos.ts`: `mediana`, `calcularCuadrante` (estables/riesgo/oportunidad/atencion), `calcularSemaforo` (pino/ambar/rubi por variación % y umbral), `clasificarCanal` (precedencia referido → bono → freemium_convertido → directo, FR-018), `deltaPct` (null sin base), `resolverRangoPeriodo` (mes/trimestre/anio/custom en America/Bogota), `periodoScoreDeRango` ("YYYY-MM" Bogotá), `mesesDeDuracionCanonico` (delega en `src/lib/pagos/freemium-calculos.ts`).
- [x] T002 [P] Tests unitarios `src/lib/analisis/panel-calculos.test.ts` (cada helper, bordes: empates de mediana, variación 0, caída > umbral, canal con varias señales, rango custom invertido lo rechaza el schema no el helper). Registrar en `vitest.unit.includes.ts` con comentario `// SPEC-222:`.
- [x] T003 [P] Schemas Zod `src/lib/schemas/analisis-panel.ts`: query de `dinero-vs-valor` (granularidad/periodo/desde/hasta/estado/tipoTitular/paisId/ciudadId/colegioId/page/pageSize; `desde<=hasta` o 400; custom exige desde+hasta), query de `dispersion`, query de `kpis`, query de `anomalias` (severidad/page/pageSize). Tests unitarios `src/lib/schemas/analisis-panel.test.ts` registrados con `// SPEC-222:`.

## Fase 2 — DAL (repositorio + servicio)

- [x] T004 Repositorio `src/lib/dal/repositories/analisis-panel-repository.ts` (frontera Q-3, único import de `@/lib/prisma` del dominio):
  - `listarTopDecisiones(ahora)`: `Recomendacion` PENDIENTE con `expiraEn > ahora`, `prioridad DESC, generadaEn ASC`, take 5 (FR-003).
  - `listarBaseSuscripciones(filtros, rango, periodoScore)`: UNA query `findMany` con includes tipados (colegio+pais+ciudad, usuario, planActual, pagos AUTORIZADO con `fechaAutorizacion` en rango, scoreClientes del período, bonosAplicados take 1) — sin N+1.
  - `sumarRecaudoPorSuscripcion(suscripcionIds, desde, hasta)`: `pago.groupBy` (suma `montoNetoUSD`, AUTORIZADO) para variación vs período anterior.
  - `listarAnomaliasNoResueltas({severidad, page, pageSize})`: orden severidad ALTA→MEDIA→BAJA (orden en servicio vía mapa de pesos; Prisma ordena por `detectadaEn`) con guard de tabla ausente (P2021/P2022 → `null`).
  - `contarMau(rango)`, `listarSuscripcionesActivas()`, `contarCanceladas(rango)`, `contarActivasAlInicio(fecha)`, `sumarLtvPorSuscripcion()`, `listarPagosAutorizados(rango)` + `primerPagoPorSuscripcion()`, `contarFreemium()`, `contarFreemiumConvertidas()`, `contarReferidos()` (totales y con `fechaActivacion`).
- [x] T005 Servicio `src/lib/dal/services/analisis-panel.ts` (`AnalisisPanelService`): orquesta repositorio + helpers puros + parámetros (`analisis.panel.umbral_monto_usd`, `analisis.panel.umbral_score`, `analisis.panel.dispersion_max_puntos`, `analisis.anomalias.crecimiento_pct_umbral` para el semáforo) vía `getParametroSistemaValor`. Métodos: `topDecisiones()`, `dineroVsValor(query)` (7 granularidades + drill + paginación `{items, pagination, totales}` + `sinScore`), `dispersion(query)` (puntos + cortes + truncado determinístico por `suscripcionId`), `kpis(query)` (7 KPIs + deltas), `anomalias(query)` (`disponible: false` si guard). Score promedio excluye filas sin snapshot (nunca 0 silencioso). Bucket "Sin ciudad" para padres en granularidad ciudad.
- [x] T006 Tests de integración del repositorio/servicio `src/lib/dal/services/analisis-panel.test.ts` (dataset semilla conocido: 2 países/3 ciudades, 4 cuadrantes, canales, cohortes; SC-003 diferencia de recaudo = 0). Bajo `src/**`; NO correr localmente (BD compartida, la corre el coordinador).

## Fase 3 — Endpoints (patrón `src/app/api/admin/estadisticas/route.ts`)

- [x] T007 [P] `GET /api/admin/analisis/top-decisiones/route.ts` — verifyAuth → assertModulo("estadisticas") → rol ADMIN → rate limit `admin_read` → servicio. Deriva `contacto` de `datosContexto` (tel/email si existen).
- [x] T008 [P] `GET /api/admin/analisis/dinero-vs-valor/route.ts` — idem + Zod query; responde `{ items, pagination, totales }`.
- [x] T009 [P] `GET /api/admin/analisis/dispersion/route.ts` — idem; responde `{ puntos, cortes, truncado, totalSuscripciones, sinScore }`.
- [x] T010 [P] `GET /api/admin/analisis/kpis/route.ts` — idem; responde `{ kpis, periodo }`.
- [x] T011 [P] `GET /api/admin/analisis/anomalias/route.ts` — idem; `200` con `disponible: false` si el modelo no está desplegado (nunca 500, FR-010).
- [x] T012 Extensión ADITIVA del resolver de SPEC-221 (`src/app/api/admin/analisis/recomendaciones/[id]/resolver/route.ts`): el body acepta `accion` (contrato FR-004) como alias de `estado` (exactamente uno requerido); comportamiento 200/400/403/404/409 intacto.
- [x] T013 [P] Tests de ruta (integración, NO correr local): `top-decisiones/route.test.ts`, `dinero-vs-valor/route.test.ts` (validación Zod 400, paginación, rol 403), `recomendaciones/[id]/resolver/route.test.ts` (200/400/403/409 con `accion` y con `estado`), `anomalias/route.test.ts`, `dispersion/route.test.ts`, `kpis/route.test.ts`. Patrón `src/app/api/admin/estadisticas/dinero-vs-valor/route.test.ts` (mock `next/headers` cookies + token real).

## Fase 4 — UI (tokens, tono neutral, querystring persistente)

- [x] T014 Página `src/app/dashboard/admin/estadisticas/dinero-vs-valor/page.tsx`: MANTIENE el contenido de SPEC-218 (KpiPagosCards + 4 widgets) y añade encima el panel SPEC-222 en Suspense: Top 5 → KPIs base → dispersión → granularidad → anomalías. Server Component con la verificación actual (verifyAuth ADMIN + assertModulo).
- [x] T015 [P] `DineroVsValorPanelClient.tsx` + componentes en `src/app/dashboard/admin/estadisticas/dinero-vs-valor/components/`: `TopDecisiones.tsx` (cards grandes, acciones aplicada/ignorar vía endpoint resolver con `accion`, enlaces `tel:`/`mailto:` desde `contacto`, estado vacío "Sin decisiones pendientes hoy", refresh tras resolver y ante 409), `KpiTiles.tsx` (7 tiles + delta con signo, "—" sin datos), `MatrizDispersion.tsx` (recharts `ScatterChart`, ReferenceLine en cortes, colores pino/ambar/rubi/neutral por cuadrante, tooltip cliente+monto+score, click → `/dashboard/admin/pagos/cliente/[id]`, nota "N clientes sin score calculado"), `FiltrosGlobales.tsx` (periodo/desde/hasta/estado/tipoTitular en querystring), `TablaGranularidad.tsx` (7 granularidades, semáforo, drill por `drill.params`, paginación), `BreadcrumbDrill.tsx` (`Todos → país → ciudad`), `PanelAnomalias.tsx` (badges rubi/ambar/pino, "Revisar" al sujeto, estado vacío).
- [x] T016 [P] Test unitario de UI (sin BD) `TopDecisiones.test.tsx` (render de cards, orden, estado vacío, click resolver llama fetch con `accion`) registrado en `vitest.unit.includes.ts` con `// SPEC-222:`.

## Fase 5 — Seed y cierre

- [x] T017 Seed aditivo en `prisma/seed.ts` con ancla `// ── SPEC-222:`: `analisis.panel.umbral_monto_usd` (FLOAT, "" vacío = mediana), `analisis.panel.umbral_score` (FLOAT, ""), `analisis.panel.dispersion_max_puntos` (INTEGER, 500); upsert por `clave`, `update: {}`, invocado desde `main()` y exportado.
- [x] T018 Gate local: `npx tsc --noEmit`, tests unitarios propios (`npm run test:unit -- panel-calculos analisis-panel.test TopDecisiones`), `npm run tokens:check` (0 aportes propios). Actualizar checklist `checklists/requirements.md` y sección Implementación de `spec.md`.

## Dependencias

- T001-T003 (puros) antes que T005; T004 antes que T005; T005 antes que T007-T011; T012 independiente; T014-T016 tras T007-T011 (contratos); T017 independiente.
- Sin migraciones propias: `AccionAudit.RECOMENDACION_RESUELTA` ya existe (SPEC-221). Sin cambios en `prisma/schema.prisma`.
- Proxy: `/dashboard/admin/**` y `/api/admin/**` ya permiten roles internos; la restricción ADMIN-only se hace en página/rutas (patrón existente). No se toca `src/lib/proxy.ts`.
