# Tasks: 005-mantenimientos — **alcance 005-A** (D-016)

**Input**: spec.md (US1-US5 = 005-A; US6 = 005-B FUERA), plan.md (fases), data-model.md,
contracts/mantenimientos.md, research.md R1-R13.

**Orden de commits (ZEUS):** US5 guard → US4 envío inmediato → US1 individual → US2 masiva →
US3 cola/jobs. Un commit por User Story (`feat(003-USx)`). Tests obligatorios (constitución §5).

**Recordatorios innegociables:** migraciones ADITIVAS (nunca reset; `--create-only` + revisión);
guard en CADA endpoint de operación (I-09); alcance por rol server-side ignorando `nit` del
cliente (D-015); modo stub (cero APIs productivas); worker único.

---

## Phase 1: Setup (datos y dependencias)

- [x] T001 Añadir dependencias `exceljs` y `luxon` (+`@types/luxon` dev) en package.json (R5, R12/D11)
- [x] T002 Añadir `environmentMatchGlobs` (node para `src/lib/mantenimientos/**` y `src/app/api/mantenimientos/**`) en vitest.config.ts (R13/D12)
- [x] T003 Añadir los 6 modelos Prisma de data-model.md (ids externos en columnas separadas — gate B1; `tmt_usuario_id`/`nit` BigInt) en prisma/schema.prisma
- [x] T004 Generar migración ADITIVA `add_mantenimientos` con `npx prisma migrate dev --create-only`, revisar SQL (solo CREATE) y aplicar
- [x] T005 Seed: 4 tipos de mantenimiento + **7 módulos asignables** (D-018) + asignaciones por rol coherentes (§10.1/§10.8: rol 1 solo inicio) + demo mantenimientos/jobs en prisma/seed.ts
- [x] T006 [P] Añadir `COLA_MAX_REINTENTOS`/`COLA_BACKOFF_MIN` a .env.example (D-019b; `URL_MATENIMIENTOS` [sic] ya existe)

## Phase 2: Foundational (integración — bloquea todas las US)

- [x] T007 `construirCabecerasMantenimiento(identificacion, idRol, {conVigiladoId})` en src/lib/integracion/cabeceras.ts (R2: `Authorization`+`token`, `vigiladoId` solo detalle; nunca `documento`) + test en cabeceras.test.ts
- [x] T008 Extender interfaz `ClienteSupertransporte` con `postMantenimiento`/`getMantenimiento` en src/lib/integracion/cliente.ts
- [x] T009 Implementar stubs de mantenimiento (ids incrementales; placa `FALLA*` fuerza error; placas/historial/tipos demo) en src/lib/integracion/cliente-stub.ts + test cero-red en cliente-stub.test.ts
- [x] T010 [P] Implementar `postMantenimiento`/`getMantenimiento` reales (tras doble gate, base `URL_MATENIMIENTOS` [sic]) en src/lib/integracion/cliente-http.ts
- [x] T011 [P] `extraerIdMantenimientoExterno` (candidatos `id|mantenimientoId|mantenimiento_id|data.*`) REUSANDO src/lib/normalizar.ts (D13) + test en normalizar.test.ts
- [x] T012 [P] Tipos de dominio: `TIPOS_OPERABLES=[1,2]`, `TIPOS_IDENTIFICACION` (12, D-022 #5), `REGEX_HORA`, `REGEX_PLACA` en src/lib/mantenimientos/tipos.ts

## Phase 3: US5 — Guard de módulos D-017 (commit `feat(003-US5)`)

- [x] T013 [US5] Guard compartido `requiereModulo(usuario, modulo)` sobre cargarModulos en src/lib/guard-modulos.ts (403 sin módulo) + test en src/lib/guard-modulos.test.ts
- [x] T014 [US5] Aplicar guard `salidas` a src/app/api/integracion/despachos/route.ts y `llegadas` a src/app/api/integracion/llegadas/route.ts (+ rutas de reintento) — ajustar tests existentes que queden afectados
- [x] T015 [US5] Verificar seed T005: usuarios demo con módulos para que los 64 tests sigan verdes

## Phase 4: US4 — Envío inmediato 3 colas D-021 (commit `feat(003-US4)`)

- [x] T016 [US4] `COLA_MAX_REINTENTOS`/`COLA_BACKOFF_MIN` desde env (defaults 3/5) en src/lib/despachos/cola.ts y src/lib/llegadas/cola.ts (quitar hardcode) + tests de override
- [x] T017 [US4] Helper compartido de intento síncrono con caída a cola (envía; éxito → procesado+id externo; fallo → queda pendiente) reutilizable por las 3 colas
- [x] T018 [US4] Intento inmediato en POST src/app/api/integracion/despachos/route.ts (hoy solo encola) + test (stub OK → procesado; FALLA* → pendiente)
- [x] T019 [US4] Ídem en POST src/app/api/integracion/llegadas/route.ts + test; reintento manual conserva `reintentos=0`

## Phase 5: US1 — Registro individual (commit `feat(003-US1)`)

- [x] T020 [US1] Servicio: `guardarBase` (valida placa/tipo, desactiva previos, inmediato+caída a job `base`) y `guardarDetalle` (hora regex, tipoIdentificacion 1..12, id externo en columna separada, inmediato+caída) en src/lib/mantenimientos/servicio.ts + tests
- [x] T021 [US1] POST /api/mantenimientos (base; roles 1,3 + guard `mantenimientos`) en src/app/api/mantenimientos/route.ts + test (400/403/errores negocio Super tal cual)
- [x] T022 [P] [US1] POST /api/mantenimientos/preventivo y /correctivo en src/app/api/mantenimientos/preventivo/route.ts y correctivo/route.ts + tests
- [x] T023 [P] [US1] GET /api/mantenimientos/placas y /historial (proxy stub, NIT efectivo server-side) en src/app/api/mantenimientos/placas/route.ts e historial/route.ts + tests

## Phase 6: US2 — Carga masiva XLSX/CSV (commit `feat(003-US2)`)

- [x] T024 [US2] Validación por fila (columnas requeridas, "Fila N: ...", tipos, hora/placa regex, TODO-O-NADA §10.10) en src/lib/mantenimientos/validacion.ts + tests
- [x] T025 [US2] Lectura XLSX y CSV (exceljs, tolerancia `;`), normalización fecha/hora (luxon, formatos legacy) y generación de plantilla (10 columnas + hoja tipos_identificacion) en src/lib/mantenimientos/excel.ts + tests
- [x] T026 [US2] Masivo diferido transaccional (base+detalle por fila; todo-o-nada) en src/lib/mantenimientos/servicio.ts + tests
- [x] T027 [US2] Rutas bulk XLSX/CSV (4) en src/app/api/mantenimientos/bulk/{preventivo,correctivo}/{xlsx,csv}/route.ts + tests (400 columnas/filas/formato/5MB; 202)
- [x] T028 [P] [US2] GET plantilla en src/app/api/mantenimientos/plantillas/preventivo-correctivo/route.ts + GET exportar historial (con auth) en src/app/api/mantenimientos/historial/exportar/route.ts + tests

## Phase 7: US3 — Cola y jobs (commit `feat(003-US3)`)

- [x] T029 [US3] Cola: `crearJob`, `procesarLoteMantenimientos` (lote 20, env reintentos/backoff), `procesarJob` base/preventivo/correctivo (dependencia `MantenimientoPendienteError` sin consumir reintento; ids separados), reintentos en src/lib/mantenimientos/cola.ts + tests
- [x] T030 [US3] Acciones de reintento (`actualizar` resetea+corrige datos locales, `reprogramar` 409 al máximo, `marcarProcesado`; detalle→base fallido) en src/lib/mantenimientos/cola.ts + tests
- [x] T031 [US3] Rutas jobs: GET /jobs (paginado+filtros, alcance D-015 server-side, rol 3 = NIT admin), GET /jobs/fallidos, GET /jobs/[id], POST /jobs/[id]/reintentar en src/app/api/mantenimientos/jobs/** + tests
- [x] T032 [US3] Tercera pasada del worker único en scripts/worker.mjs (mismo advisory lock)

## Phase 8: Polish & cierre 005-A

- [x] T033 [P] Completar artefactos faltantes de specs/002-llegadas-doble-token/ (research.md, quickstart.md, checklists/) — I-11, commit docs aparte
- [x] T034 Gates: 64 tests previos + nuevos verdes; `tsc --noEmit`, `lint`, `build` limpios; smoke quickstart.md (secciones 005-A) en vivo
- [x] T035 Verificación en navegador en ventana privada + evidencia en commits; plan.md Status → IMPLEMENTADO

## Dependencies

Setup (T001-T006) → Foundational (T007-T012) → US5 (T013-T015) → US4 (T016-T019) →
US1 (T020-T023) → US2 (T024-T028) → US3 (T029-T032) → Polish (T033-T035).
US2 depende del servicio de US1 (T020); US3 procesa los jobs creados por US1/US2.

## Independent test criteria

- **US5**: usuario sin módulo → 403 en endpoints de despachos/llegadas; con módulo → 200.
- **US4**: registro web con stub OK → `procesado` en la misma respuesta; `FALLA*` → `pendiente`.
- **US1**: base+detalle preventivo/correctivo con ids externos en columnas separadas; rol 2 → 403.
- **US2**: XLSX/CSV válido → 202 y 2N jobs; una fila mala → 400 `exitosos: 0` y CERO jobs.
- **US3**: dependencia sin consumir reintento; 3 fallos → fallido; `actualizar` resetea a 0; alcance por NIT.

## MVP scope

US5+US4 (estructurales) + US1 (primer flujo de negocio completo). US2/US3 completan la paridad 005-A.

---

## Phase 9: 005-B — Pantalla, PDF del programa y modales (US6)

- [ ] T036 [US6] Interfaz de almacenamiento `guardarArchivo`/`leerArchivo` con raíz `ALMACENAMIENTO_DIR` (env, FUERA de la app — D-022 #2) en src/lib/almacenamiento.ts + test
- [ ] T037 [US6] Servicio del programa PDF (solo PDF, ≤4MB→413, roles CLIENTE; **el último cargado queda ACTIVO y desactiva los anteriores** §10.2; alcance D-015) en src/lib/mantenimientos/archivos.ts + test
- [ ] T038 [US6] Rutas: POST/GET /api/archivos-programas (subir rol 1,2 / listar 1,2,3) + GET /api/archivos-programas/[id]/descargar (streaming) — todas con guard `mantenimientos` (D-017) en src/app/api/archivos-programas/** + tests
- [ ] T039 [US6] `ALMACENAMIENTO_DIR` en .env.example (fuera del directorio de la app)
- [ ] T040 [US6] Pantalla /dashboard/mantenimientos: tabs Preventivos/Correctivos; card PDF del programa (roles 1-2: subir/listar/descargar, activo/inactivo); card Vehículos (roles 1-3: placas stub con estado 5/3, modal registro base+detalle con responsable rotulado, modal historial); cargue masivo XLSX/CSV + plantilla + modal resumen §10.10 + botón Descargar errores (.txt); tabla de sincronización con corregir-y-reenviar. Hereda breadcrumb del layout (I-14), no crea navegación propia. En src/app/dashboard/mantenimientos/page.tsx
- [ ] T041 Gates 005-B: 117 previos + nuevos verdes; tsc/lint/build; navegador en ventana privada (incluye PDF nuevo ACTIVO y el anterior Inactivo); cierre.md
