# Tasks: Cierre de blindaje + saneamiento

**Input**: Design documents from `/specs/041-cierre-blindaje-saneamiento/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Manual verification with `npm run db:verify:hnsw`; unit tests for `procesar` and `fallback` routes.

**Organization**: Tasks grouped by user story and phase.

---

## Phase 1 — Verificación y análisis

- [P] T001 Ejecutar `npm run db:verify:hnsw` y confirmar índices.
- [P] T002 Revisar `package.json` y `scripts/*` para confirmar ausencia de `migrate dev`/`reset`/`db push`.
- [P] T003 Revisar `src/app/api/reportes/procesar/route.ts` y `src/app/api/reportes/fallback/route.ts` para identificar `processingError` crudo.
- [P] T004 Revisar tests de `fallback` para actualizar expectativas.

**Checkpoint**: Índices OK, scripts OK, puntos de cambio identificados.

---

## Phase 2 — US1: Confirmar índices HNSW y documentar despliegue (P1)

- T011 Ejecutar `npm run db:verify:hnsw` y capturar salida.
  - Archivo: `scripts/verify-hnsw-indexes.ts`.
- T012 Documentar en `cierre.md` que `prisma migrate deploy` es el único método de despliegue.
  - Archivos: `docs/cierre-041.md`, `AGENTS.md` (si aplica).
- T013 Verificar que `package.json` usa `prisma migrate deploy` en `db:migrate`.
  - Archivo: `package.json`.
- T014 Verificar que `scripts/*` no contiene `migrate dev`/`reset`/`db push`.

**Checkpoint**: US1 validado y documentado.

---

## Phase 3 — US2: Sanitizar `processingError` (P1)

- T021 En `procesar/route.ts`, cambiar `processingError: errMsg` por mensaje genérico con `errorCode`.
  - Archivo: `src/app/api/reportes/procesar/route.ts`.
- T022 En `fallback/route.ts`, extraer `errorCode` del body (con fallback a `INTERNAL_ERROR`), cambiar `processingError` y `motivo` a genéricos, y guardar `errorCode` en metadatos.
  - Archivo: `src/app/api/reportes/fallback/route.ts`.
- T023 Actualizar `fallback/route.test.ts` para esperar mensaje genérico.
  - Archivo: `src/app/api/reportes/fallback/route.test.ts`.

**Checkpoint**: `processingError` ya no contiene mensajes crudos.

---

## Phase 4 — Tests y validación

- [P] T031 Ejecutar `npm run db:verify:hnsw`.
- [P] T032 Ejecutar `npx tsc --noEmit`.
- [P] T033 Ejecutar `npm run lint`.
- [P] T034 Ejecutar `npm run test`.
- [P] T035 Ejecutar tests específicos de `procesar` y `fallback`.
- [P] T036 Ejecutar `rm -rf .next && npm run build`.
- [P] T037 Ejecutar `./scripts/dev-restart.sh` y healthcheck.

---

## Phase 5 — Cierre

- T041 Actualizar `spec.md` con sección Implementación.
  - Archivo: `specs/041-cierre-blindaje-saneamiento/spec.md`.
- T042 Crear `docs/cierre-041.md`.
  - Archivo: `docs/cierre-041.md`.
- T043 Validar checklist de requisitos.
  - Archivo: `specs/041-cierre-blindaje-saneamiento/checklists/requirements.md`.
- T044 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies.
- **Phase 2**: Depends on Phase 1.
- **Phase 3**: Depends on Phase 1.
- **Phase 4**: Depends on Phase 2 and Phase 3.
- **Phase 5**: Depends on Phase 4.

### Within Each User Story

- **US1**: Verificar → Documentar.
- **US2**: Identificar → Modificar endpoints → Actualizar tests → Validar.

### Parallel Opportunities

- T011-T014 (US1) se pueden ejecutar en paralelo con T021-T023 (US2).
- T031-T037 (tests) son paralelos entre sí, salvo que requieren el build previo.

---

## Implementation Strategy

### MVP First

1. Phase 1: verificar estado actual.
2. Phase 2: US1 — documentar HNSW y despliegue.
3. Phase 3: US2 — sanitizar `processingError`.
4. Phase 4: validación completa.
5. Phase 5: cierre y push.

---

## Notes

- No se requieren cambios en el modelo de Prisma.
- El script `verify-hnsw-indexes.ts` ya existe; si falla, el deploy debe abortarse y se debe crear una migración aditiva para recrear los índices.
- El cambio en `fallback` es backward compatible con callers que no envíen `errorCode`; se usa fallback a `INTERNAL_ERROR`.
