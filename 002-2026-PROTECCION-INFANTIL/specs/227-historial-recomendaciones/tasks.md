# Tasks: SPEC-227 — Historial de recomendaciones y métricas de tuning

**Input**: `specs/227-historial-recomendaciones/` (spec.md, plan.md, research.md, data-model.md, contracts/).
**Prerrequisito**: SPEC-221 implementada en la rama (modelos `ReglaRecomendacion`/`Recomendacion`, enum `EstadoRecomendacion`) — verificado: `prisma/schema.prisma:2435-2530`, tabla `recomendaciones` con columnas camelCase citadas.

## Formato

`[P]` = paralelizable (archivos distintos, sin dependencia entre sí). Tests junto al código bajo `src/**`; unitarios sin BD se registran en `vitest.unit.includes.ts` con comentario `// SPEC-227:`.

## Fase 1 — Setup (seed, permisos, navegación, entorno)

- [x] T001 [P] Sembrar parámetros `analisis.recomendaciones.tasa_ignorada_alerta_pct` (FLOAT, "70") y `analisis.recomendaciones.export_max_filas` (INTEGER, "5000") en `prisma/seed.ts` (función `seedParametrosHistorialRecomendaciones` con ancla `// ── SPEC-227:`, upsert `update: {}`, llamada en `main()` y export).
- [x] T002 [P] Registrar módulo `analisis_recomendaciones` ("Análisis · Historial de sugerencias", categoria admin, primer nivel — SPEC-222 no registró padre `analisis` al implementar) en `src/lib/permisos-catalogo.ts` con comentario `// SPEC-227:`; el backfill de `prisma/seed-modulos-grants.ts` lo otorga solo a `ADMIN` (ADMIN recibe todo el catálogo).
- [x] T003 [P] Añadir entrada `{ href: "/dashboard/admin/analisis/recomendaciones", label: "Sugerencias", modulo: "analisis_recomendaciones" }` a `ADMIN_NAV_ITEMS` en `src/lib/nav-items.ts` (`// SPEC-227:`) e icono en `src/components/modules/AdminNav.tsx`.
- [x] T004 [P] Documentar `ANALISIS_EXPORT_SALT` en `.env.example` (sin valor real, regla I-22).

## Fase 2 — Dominio puro y DAL

- [x] T005 [P] `src/lib/analisis/filtros-historial.ts`: schema Zod `filtrosHistorialSchema` (estado enum, reglaId, categoria, sujetoTipo enum, sujetoId, ejecutadaAutomatica "true"/"false", desde/hasta `YYYY-MM-DD`) + `resolverRangoBogota(desde, hasta)` (día calendario `America/Bogota` → instantes UTC, desde 00:00:00, hasta 23:59:59.999) + tipo `FiltrosHistorial` resuelto (fechas ya en UTC). Sin Prisma (puro).
- [x] T006 [P] `src/lib/analisis/pseudonimizar.ts`: `pseudonimizarSujeto(sujetoId, sal)` = SHA-256(`sujetoId` + sal) truncado a 16 hex; lanza si la sal está vacía (fail-closed, nunca exporta id crudo); `null` si `sujetoId` es null. Puro.
- [x] T007 [P] `src/lib/analisis/historial-csv.ts`: `COLUMNAS_EXPORT` exactas del contrato, `toCsv(filas)` con escape (patrón `ia/simulaciones/[id]/export/route.ts`), `construirFilasExport(recomendaciones, sal)` (hash por fila, `tiempo_resolucion_horas` desde `resueltaEn - generadaEn`, sin título/descripcion/datosContexto) y `nombreArchivoExport(ahora)` (`recomendaciones-YYYYMMDD-HHmm.csv`). Puro.
- [x] T008 `src/lib/dal/repositories/analisis-recomendaciones-repository.ts`: repositorio DAL (frontera Q-3) — `findPaginadasConTotal(where, skip, take)` (include regla `{id, clave, nombre}`, orderBy `generadaEn` desc), `conteoPorEstado(where)` (groupBy), `promedioResolucionHorasGlobal(filtros)` y `promedioResolucionHorasPorRegla(filtros)` (`$queryRaw` con `Prisma.sql` parametrizado, columnas fijas citadas, enum con cast `::"EstadoRecomendacion"`, `resueltaEn IS NOT NULL`), `conteoPorReglaYEstado(where)` (groupBy compuesto), `findParaExport(where)` y `listarReglasParaFiltro()`.
- [x] T009 `src/lib/dal/services/analisis-recomendaciones.ts`: servicio que compone el repositorio + `ParametroRepository` — `listar(filtros, page, pageSize)` → `{ items, pagination }`; `metricas(filtros)` → totales por estado, tasas sobre resueltas (`null` si denominador 0), promedio, `umbralAlertaIgnoradaPct` desde parámetro, `porRegla` ordenado por tasa de ignorada desc con `sobreUmbralAlerta`; `prepararExport(filtros)` → count vs `export_max_filas` (AppError 413 `PAYLOAD_TOO_LARGE`), filas; `registrarAuditoriaExport(usuarioId, filtros, filas, ip, userAgent)` (AuditLog `RECOMENDACIONES_EXPORT_CSV`, sin contenido).

## Fase 3 — Endpoints

- [x] T010 [P] `src/app/api/admin/analisis/recomendaciones/route.ts`: GET lista — `verifyAuth(ADMIN)` → `assertModulo(user, "analisis_recomendaciones")` → rate limit `admin_read` → Zod (filtros + `page`/`pageSize` máx 100) → servicio → `{ items, pagination }`; `errorToResponse`.
- [x] T011 [P] `src/app/api/admin/analisis/recomendaciones/metricas/route.ts`: GET métricas con los mismos filtros (sin paginación) → contrato `metricas` (rango, totales, tasas, `porRegla`).
- [x] T012 [P] `src/app/api/admin/analisis/recomendaciones/export/route.ts`: GET CSV — mismos guards/filtros; `prepararExport` (413 si excede); fail-closed `500` si falta `ANALISIS_EXPORT_SALT`; serializa con `historial-csv.ts`; AuditLog; `text/csv` + `Content-Disposition: attachment`.

## Fase 4 — Vista

- [x] T013 `src/app/dashboard/admin/analisis/recomendaciones/page.tsx`: Server Component — `verificarAccesoPagina("analisis_recomendaciones")` → `SinAccesoModulo`; carga reglas para el select vía servicio; renderiza el componente cliente.
- [x] T014 `src/app/dashboard/admin/analisis/recomendaciones/components/HistorialRecomendaciones.tsx`: cliente — filtros (regla, estado, categoría, sujeto tipo/id, rango de fechas, ejecutada automática), tabla paginada (badges Pendiente/Aplicada/Ignorada/Expirada, distintivo "ejecutada sola"), KPIs glass (total, tasa aplicación/ignorada, tiempo promedio, "—" sin resueltas), bloque "Por regla" con fila `rubi` + "revisar umbral" sobre umbral, botón "Exportar CSV". Tokens Tailwind (glass/tinta/text-body/text-muted/ambar/pino/rubi), terminología "Sugerencia", tono neutral.

## Fase 5 — Tests

- [x] T015 [P] `src/lib/analisis/filtros-historial.test.ts` (unitario): parse válido/400, frontera Bogotá (hasta incluye 23:59:59.999), combinaciones.
- [x] T016 [P] `src/lib/analisis/pseudonimizar.test.ts` (unitario): hash estable, 16 hex, distinto por sujeto, lanza sin sal, null → null.
- [x] T017 [P] `src/lib/analisis/historial-csv.test.ts` (unitario): columnas exactas del contrato, escape de comas/comillas, sin título/descripción, hash aplicado, tiempo en horas.
- [x] T018 [P] `src/app/dashboard/admin/analisis/recomendaciones/components/HistorialRecomendaciones.test.tsx` (unitario, fetch mockeado): render de estados/badges, KPIs con "—", fila sobre umbral destacada.
- [x] T019 Registrar T015-T018 en `vitest.unit.includes.ts` con `// SPEC-227:`.
- [x] T020 [P] `src/lib/dal/services/analisis-recomendaciones.test.ts` (integración, NO correr — BD compartida): tasas con denominador de resueltas (8 ignoradas/2 aplicadas → 20%/80%), frontera Bogotá, orden porRegla, tope 413, AuditLog.
- [x] T021 [P] `src/app/api/admin/analisis/recomendaciones/route.test.ts` (integración, NO correr): 200 lista + filtros + paginación, 400 filtro inválido, 401 sin sesión, 403 rol no-ADMIN.
- [x] T022 [P] `src/app/api/admin/analisis/recomendaciones/metricas/route.test.ts` (integración, NO correr): 200 contrato métricas, 401/403, 400.
- [x] T023 [P] `src/app/api/admin/analisis/recomendaciones/export/route.test.ts` (integración, NO correr): 200 CSV columnas exactas, hash estable entre exports, sin PII, 413 sobre tope, AuditLog registrado, 401/403.

## Fase 6 — Validación

- [x] T024 Gate: `npx tsc --noEmit` limpio en archivos de la spec; `npm run test:unit -- <tests de la spec>` verde; `npm run tokens:check` sin aportes crudos de la spec.

## Dependencias

- T008/T009 dependen de T005 (tipos de filtros); T010-T012 de T005-T009; T013/T014 de T010-T012 (contrato); T020-T023 de T008-T012.
- Sin migraciones, sin worker, sin advisory lock, sin cambios en `src/lib/ai/**` ni en el motor de reglas (FR-014).
