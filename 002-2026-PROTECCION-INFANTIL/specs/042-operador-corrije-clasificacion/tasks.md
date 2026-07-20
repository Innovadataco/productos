# Tasks: Operador corrige la clasificación

**Input**: Design documents from `/specs/042-operador-corrije-clasificacion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Unit tests for `/api/admin/correcciones`; component or manual test for `AdminReporteDetalle`; manual quickstart.

**Organization**: Tasks grouped by user story and phase.

---

## Phase 1 — Investigación y análisis

- [P] T001 Revisar `src/components/modules/AdminReporteDetalle.tsx` para entender cuándo se muestra la corrección.
  - Archivo: `src/components/modules/AdminReporteDetalle.tsx`.
- [P] T002 Revisar `src/app/api/admin/correcciones/route.ts` para confirmar lógica de transición, permisos y estado final.
  - Archivo: `src/app/api/admin/correcciones/route.ts`.
- [P] T003 Revisar `src/lib/reporte-transiciones.ts` y `src/lib/operadores/permisos.ts` para confirmar mapeo de rol a responsable.
  - Archivos: `src/lib/reporte-transiciones.ts`, `src/lib/operadores/permisos.ts`.
- [P] T004 Revisar tests existentes de `correcciones` para identificar gaps.
  - Archivo: `src/app/api/admin/correcciones/route.test.ts`.

**Checkpoint**: Flujo actual mapeado; gaps de tests identificados.

---

## Phase 2 — US1: Verificar corrección y estado CORREGIDO (P1)

- T011 Agregar test: reporte asignado a operador → corrección → estado `CORREGIDO`.
  - Archivo: `src/app/api/admin/correcciones/route.test.ts`.
- T012 Agregar test: transición registrada con `responsableTipo = OPERADOR` y `responsableId` del operador.
  - Archivo: `src/app/api/admin/correcciones/route.test.ts`.
- T013 Agregar test: operador no asignado → 403.
  - Archivo: `src/app/api/admin/correcciones/route.test.ts`.
- T014 Agregar test: corrección duplicada → 409.
  - Archivo: `src/app/api/admin/correcciones/route.test.ts`.
- T015 Agregar test (edge): reporte dado de baja → 409 (o comportamiento documentado).
  - Archivo: `src/app/api/admin/correcciones/route.test.ts`.

**Checkpoint**: Tests de flujo pasan.

---

## Phase 3 — US2: UI del operador habilita la corrección (P1)

- T021 Verificar/revisar condición `puedeCorregir` en `AdminReporteDetalle`.
  - Archivo: `src/components/modules/AdminReporteDetalle.tsx`.
- T022 Agregar test de componente para `AdminReporteDetalle` si el proyecto tiene tests de componentes; si no, documentar verificación manual en `quickstart.md`.
  - Archivo: `src/components/modules/AdminReporteDetalle.tsx` o `quickstart.md`.

**Checkpoint**: UI muestra corrección en estados correctos.

---

## Phase 4 — US3: Documentar y probar flujo end-to-end (P2)

- T031 Ejecutar flujo manual: operador asignado → abre detalle → corrige → verifica estado, transición, dataset.
  - Archivos: `specs/042-operador-corrije-clasificacion/quickstart.md`, BD vía SQL/curl.
- T032 Completar `quickstart.md` con comandos y resultados esperados.
  - Archivo: `specs/042-operador-corrije-clasificacion/quickstart.md`.

**Checkpoint**: Quickstart reproducible.

---

## Phase 5 — Tests, validación y cierre

- [P] T041 Ejecutar `npx tsc --noEmit`.
- [P] T042 Ejecutar `npm run lint`.
- [P] T043 Ejecutar `npm run test`.
- [P] T044 Ejecutar tests específicos de `correcciones`.
- [P] T045 Ejecutar `rm -rf .next && npm run build`.
- [P] T046 Ejecutar `./scripts/dev-restart.sh` y healthcheck.
- T051 Actualizar `specs/042-operador-corrije-clasificacion/spec.md` con sección Implementación.
- T052 Crear `docs/cierre-042.md`.
- T053 Validar checklist de requisitos.
- T054 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies.
- **Phase 2**: Depends on Phase 1.
- **Phase 3**: Depends on Phase 1.
- **Phase 4**: Depends on Phase 2 and Phase 3.
- **Phase 5**: Depends on Phase 2, Phase 3 and Phase 4.

### Parallel Opportunities

- T011-T015 (Phase 2) son secuenciales entre sí (mismo archivo), pero independientes de T021-T022 (Phase 3).
- T041-T046 (Phase 5) son paralelos excepto T045 que debe preceder a T046.

---

## Implementation Strategy

### MVP First

1. Phase 1: entender el flujo actual.
2. Phase 2: completar tests de backend.
3. Phase 3: verificar UI.
4. Phase 4: documentar flujo manual.
5. Phase 5: validación completa y cierre.

---

## Notes

- No se requieren cambios de modelo de Prisma.
- Si durante la implementación se descubre que el endpoint no cumple algún requisito, se corrige el código mínimo necesario y se documenta.
- Si el flujo requiere un cambio sensible (ej. recalcular score público al corregir), se documenta como deuda técnica para revisión humana.
