# Tasks: SPEC-224 — Panel de reglas configurables

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/224-panel-reglas.md`.
**Base**: SPEC-221 ya integrada (`ReglaRecomendacion`, `Recomendacion`, `ModoRegla`, validador 221 en `ejecutor-sql.ts`, sandbox DAL `ejecutarQuerySoloLectura`).

## Fase 1 — Datos y catálogo

- [x] T001 `prisma/schema.prisma`: añadir 7 valores `AccionAudit` `REGLA_*` al final del enum (comentario SPEC-224); añadir `version Int @default(1)` + relación `historial` al final del bloque `ReglaRecomendacion`; añadir relación inversa en `Usuario`; crear modelo `ReglaRecomendacionHistorial` (aditivo, `@@map("regla_recomendacion_historial")`). Tras editar: `npx prisma generate`.
- [x] T002 `prisma/migrations/20260824150000_spec_224_panel_reglas/migration.sql`: migración aditiva manual — `ADD COLUMN IF NOT EXISTS version`, `CREATE TABLE IF NOT EXISTS regla_recomendacion_historial` + índices, `ALTER TYPE AccionAudit ADD VALUE` vía bloque `DO $$ ... pg_enum` (patrón de `20260824110000_spec_225_anomalias_indice_audit`). Cero DROP.
- [x] T003 `src/lib/permisos-catalogo.ts`: fila aditiva `analisis_admin` ("Análisis · Reglas", `admin`, `esCritico: true`, orden 76) con comentario `// SPEC-224:`.
- [x] T004 `src/lib/nav-items.ts`: ítem aditivo `{ href: "/dashboard/admin/analisis/reglas", label: "Análisis · Reglas", modulo: "analisis_admin" }` con comentario `// SPEC-224:`.
- [x] T005 `prisma/seed.ts`: bloque `// ── SPEC-224:` con `seedParametrosReglasAdmin()` (upsert `update: {}` de `analisis.reglas.test_timeout_ms` = 5000 y `analisis.reglas.test_max_filas` = 50, INTEGER/SYSTEM) + llamada en `main()` + export. El grant de `analisis_admin` a ADMIN lo cubre `syncModulosYGrants` (ADMIN recibe todo el catálogo).

## Fase 2 — Servicio (puro + DAL)

- [x] T006 [P] `src/lib/analisis/reglas/validar-sql.ts` + `validar-sql.test.ts`: validador estático FR-006 (TDD). Quita comentarios y literales (`'...'` con escape `''`); rechaza: no iniciar con `SELECT`/`WITH`, multi-sentencia (`;` + contenido), tokens de mutación (`INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE`). Test: válidas + ≥10 maliciosas/erróneas + literales con palabras reservadas (SC-002). Registrar test en `vitest.unit.includes.ts` (`// SPEC-224:`).
- [x] T007 [P] `src/lib/analisis/reglas/test-sql.ts` + `test-sql.test.ts` (puro): `envolverConLimit(sql, maxFilas)` (wrap como subconsulta si no hay `LIMIT` exterior o supera el máx; quita `;` final), `huellaQuery(sql)` (sha256[:16]), `extraerColumnas(filas)`, `acotarTimeoutMs`/`acotarMaxFilas` (1000..30000 / 1..200), `mensajeErrorPg(error)` (timeout 57014 → mensaje legible; resto → mensaje truncado sin stack). Registrar test en unit includes.
- [x] T008 [P] `src/lib/analisis/reglas/versionado.ts` + `versionado.test.ts` (puro): `CAMPOS_FUNCIONALES`, `construirSnapshot(regla)`, `diffCampos(antes, despues)`. Registrar test en unit includes.
- [x] T009 [P] `src/lib/analisis/reglas/types.ts`: DTOs del panel (`ReglaListItem`, `ResultadoTestSql`, `ItemHistorial`, etc.).
- [x] T010 [P] `src/lib/schemas/analisis-reglas.ts` + `analisis-reglas.test.ts` (TDD): `listaReglasQuerySchema` (page/pageSize/activa/q), `crearReglaSchema` (clave regex `^[a-z][a-z0-9_.-]{2,80}$`, nombre 3..150, sqlQuery 1..10000, plantilla 1..2000, prioridad int 0..100 default 50, frecuenciaMin int 5..10080 default 60, accionEjecutable enum opcional), `editarReglaSchema` (campos opcionales + `motivo` trim 10..500 obligatorio; sin `clave` ni `modo`), `cambiarModoSchema` (discriminado: EJECUTA exige `confirmacion: z.literal("EJECUTA")` + motivo trim 20..500; RECOMIENDA exige motivo trim 20..500), `testSqlSchema` (sqlQuery 1..10000, reglaId opcional). Registrar test en unit includes.
- [x] T011 `src/lib/dal/repositories/reglas-admin-repository.ts`: CRUD + conteo 7d (`recomendacion.groupBy` por `reglaId`, `generadaEn >= hace7d`); `crearConAuditoria` (TX: create + `REGLA_CREADA`); `actualizarConHistorial` (TX: leer → insert historial con snapshot + version previa + motivo + `cambiadoPorAdminId` → update `version+1` → audit `REGLA_ACTUALIZADA`/`REGLA_ACTIVADA`/`REGLA_DESACTIVADA`); `cambiarModoConAuditoria` (TX: update modo + audit `REGLA_PROMOVIDA_EJECUTA`/`REGLA_REVERTIDA_RECOMIENDA` con valorAnterior/valorNuevo + motivo en metadatos); `listarHistorial` (paginado, include `cambiadoPor`). Filtros tipados `Prisma.ReglaRecomendacionWhereInput`.
- [x] T012 `src/lib/dal/services/reglas-admin.ts`: servicio orquestador para las rutas — `listar`, `obtenerDetalle`, `crear` (409 si clave duplicada), `actualizar` (404/valida sqlQuery con T006/detecta cambio de `activa`), `cambiarModo` (409 si ya está en ese modo; advertencia si inactiva o sin `accionEjecutable`), `historial` (con `camposCambiados` calculado vía T008), `probarSql` (lee parámetros vía `ParametroRepository`, valida con T006, envuelve con T007, ejecuta con `ReglasRecomendacionRepository.ejecutarQuerySoloLectura`, audit `REGLA_SQL_TEST` solo con metadatos).

## Fase 3 — API (6 handlers)

- [x] T013 `src/app/api/admin/analisis/reglas/route.ts`: GET (paginación `{ items, pagination }`, orden `prioridad` desc, filtro `activa`/`q`) + POST (201; 409 clave duplicada). Guards: `verifyAuth("ADMIN")` + `assertModulo("analisis_admin")` + rate limit (`admin_read`/`admin_write`).
- [x] T014 `src/app/api/admin/analisis/reglas/route.test.ts`: integración — 401/403/400/409/200/201, shape del contrato, orden por prioridad, conteo 7d, `REGLA_CREADA` en AuditLog.
- [x] T015 `src/app/api/admin/analisis/reglas/[id]/route.ts`: GET detalle (404) + PATCH (400 si `modo` presente o `clave` distinta; validador estático en servidor si viene `sqlQuery`; versionado en TX).
- [x] T016 `src/app/api/admin/analisis/reglas/[id]/route.test.ts`: integración — edición con snapshot + version+1, `activa` true↔false con `REGLA_ACTIVADA`/`REGLA_DESACTIVADA`, rechazo de cambio de `clave`/`modo` (400), 404.
- [x] T017 `src/app/api/admin/analisis/reglas/[id]/modo/route.ts`: POST cambio de modo (Zod discriminado T010; 400 sin confirmación/motivo; 409 mismo modo; 200 con `advertencia`).
- [x] T018 `src/app/api/admin/analisis/reglas/[id]/modo/route.test.ts`: integración — promoción con/sin confirmación y motivo (SC-004), reversión, AuditLog con valorAnterior/valorNuevo + motivo.
- [x] T019 `src/app/api/admin/analisis/reglas/[id]/historial/route.ts`: GET historial paginado, orden versión desc, con admin, motivo y `camposCambiados`.
- [x] T020 `src/app/api/admin/analisis/reglas/test-sql/route.ts`: POST test SQL (200 con columnas/filas/filasMuestra/duracionMs/limitAplicado/timeoutMs; 400 validador/errores PG/timeout).
- [x] T021 `src/app/api/admin/analisis/reglas/test-sql/route.test.ts`: integración — query válida (`SELECT 1`), mutación rechazada (400 sin ejecutar), tabla inexistente (400 legible), audit `REGLA_SQL_TEST` sin filas. Incluir verificación SC-003: `ejecutarQuerySoloLectura` con `INSERT` → PostgreSQL rechaza (código 25006).

## Fase 4 — UI

- [x] T022 `src/app/dashboard/admin/analisis/reglas/page.tsx`: Server Component — `verificarAccesoPagina("analisis_admin")` + `SinAccesoModulo`, delega a `ReglasPanel` (cliente).
- [x] T023 `src/components/modules/analisis/ReglasPanel.tsx` + `ReglasTable.tsx`: tabla del catálogo (nombre, categoría, modo, frecuencia, estado, generadas 7d), orden prioridad desc; activar/desactivar inline (pide motivo); acciones: editar, historial, cambiar modo.
- [x] T024 `src/components/modules/analisis/ReglaEditor.tsx`: crear/editar — campos del contrato, preview del SQL, botón "Probar" → muestra (tabla + columnas + duración), verificación de `{{variables}}` vs columnas (advertencia no bloqueante), motivo obligatorio al editar; `clave` no editable en edición.
- [x] T025 `src/components/modules/analisis/ReglaModoDialog.tsx` + `ReglaModoDialog.test.tsx`: diálogo de confirmación fuerte (escribir `EJECUTA` + motivo ≥ 20, botón deshabilitado hasta cumplir; reversión solo motivo). Test de componente sin BD → unit includes.
- [x] T026 `src/components/modules/analisis/ReglaHistorial.tsx`: vista de solo lectura del historial (versión, fecha, admin, motivo, campos cambiados). Sin restauración (v1).

## Fase 5 — Gate

- [x] T027 `npx tsc --noEmit` limpio en archivos SPEC-224; tests unitarios de SPEC-224 en verde; `npm run tokens:check` (0 crudos aportados); actualizar sección Implementación de `spec.md`.

## Dependencias

- T001→T002 (schema antes de migración), T006/T007/T008/T010 → T011/T012 → T013..T021 → T022..T026 → T027.
- T006/T007/T008/T009/T010 en paralelo (archivos independientes).
- Integración (T014/T016/T018/T021): escribir bajo `src/**`, NO correr (BD compartida; las corre el coordinador).
