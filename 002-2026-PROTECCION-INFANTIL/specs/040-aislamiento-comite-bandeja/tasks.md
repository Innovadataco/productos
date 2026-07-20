# Tasks: Aislamiento del comité a su Bandeja

**Input**: Design documents from `/specs/040-aislamiento-comite-bandeja/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Manual validation with curl/browser; existing unit/E2E tests should not regress.

**Organization**: Tasks grouped by user story and phase.

---

## Phase 1 — Análisis y preparación

- [P] T001 Verificar que `ComiteSubNav` hardcodea las 3 pestañas sin filtrar por rol.
  - Archivo: `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx`.
- [P] T002 Verificar que `/dashboard/admin/comite/gestion` y `/dashboard/admin/comite/auditoria` no tienen guard server-side.
  - Archivos: `src/app/dashboard/admin/comite/gestion/page.tsx`, `src/app/dashboard/admin/comite/auditoria/page.tsx`.
- [P] T003 Confirmar que el proxy (`src/lib/proxy.ts`) cubre `/dashboard/admin/*` y puede redirigir a `COMITE_VALIDACION`.
  - Archivo: `src/lib/proxy.ts`.
- [P] T004 Decidir mecanismo de paso de rol a `ComiteSubNav` (prop desde server component vs `/api/me`).
  - Archivos: `specs/040-aislamiento-comite-bandeja/research.md`, `specs/040-aislamiento-comite-bandeja/plan.md`.

**Checkpoint**: Causa raíz documentada y estrategia de implementación definida.

---

## Phase 2 — US1: Aislar al comité a su Bandeja (P1)

- T011 Modificar `ComiteSubNav` para recibir `rol` como prop y filtrar pestañas.
  - Archivo: `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx`.
- T012 Actualizar `src/app/dashboard/admin/comite/page.tsx` para pasar el rol a `ComiteSubNav`.
  - Archivo: `src/app/dashboard/admin/comite/page.tsx`.
- T013 Actualizar `src/app/dashboard/admin/comite/gestion/page.tsx` para pasar el rol a `ComiteSubNav` (o manejar el rol en la página).
  - Archivo: `src/app/dashboard/admin/comite/gestion/page.tsx`.
- T014 Actualizar `src/app/dashboard/admin/comite/auditoria/page.tsx` para pasar el rol a `ComiteSubNav` (o manejar el rol en la página).
  - Archivo: `src/app/dashboard/admin/comite/auditoria/page.tsx`.
- T015 Agregar en `src/lib/proxy.ts` una lista de rutas admin-only dentro del módulo Comité y redirigir a `COMITE_VALIDACION` a `/dashboard/admin/comite`.
  - Archivo: `src/lib/proxy.ts`.
- T016 Verificar que `verifyAuth` sigue en endpoints y layouts (no modificar lógica, solo confirmar).
  - Archivos: `src/app/dashboard/admin/layout.tsx`, endpoints `/api/admin/**`.

**Checkpoint**: Comité solo ve "Bandeja"; admin-only sub-rutas redirigen al comité; admin/school_admin ven todo.

---

## Phase 3 — US2: Verificar flujo del comité (P2)

- T021 Reproducir el flujo: operador escala un caso → caso aparece en Pendientes de la bandeja del comité.
  - Archivos: `src/components/modules/ComiteBandeja.tsx`, `src/lib/...` (lógica de estados).
- T022 Reproducir: comité toma el caso → pasa a Míos.
  - Archivos: `src/components/modules/ComiteBandeja.tsx`.
- T023 Reproducir: comité finaliza el caso con decisión `CORREGIDO`.
  - Archivos: `src/components/modules/ComiteBandeja.tsx`, endpoints de transición.
- T024 Si el flujo falla y no es reparable con un cambio acotado, documentar el bug como deuda técnica.
  - Archivo: `docs/cierre-040.md`.

**Checkpoint**: Flujo de negocio funciona, o su fallo queda registrado como deuda.

---

## Phase 4 — Tests y validación

- [P] T031 Probar manualmente con curl que `COMITE_VALIDACION` es redirigido desde `/dashboard/admin/comite/gestion` y `/auditoria`.
- [P] T032 Probar manualmente con curl que el comité solo ve "Bandeja" en el SubNav (o validar con datos de prueba de render).
- [P] T033 Probar manualmente con curl que `ADMIN`/`SCHOOL_ADMIN` acceden a Gestión y Auditoría.
- [P] T034 Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- [P] T035 Ejecutar `rm -rf .next && npm run build`.
- [P] T036 Ejecutar `./scripts/dev-restart.sh` y probar con `quickstart.md`.

---

## Phase 5 — Cierre

- T041 Actualizar `spec.md` con sección Implementación.
  - Archivo: `specs/040-aislamiento-comite-bandeja/spec.md`.
- T042 Crear `docs/cierre-040.md`.
  - Archivo: `docs/cierre-040.md`.
- T043 Validar checklist de requisitos.
  - Archivo: `specs/040-aislamiento-comite-bandeja/checklists/requirements.md`.
- T044 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — can start immediately.
- **Phase 2**: Depends on Phase 1. T011-T014 (SubNav) are parallel with T015 (proxy). T016 is verification.
- **Phase 3**: Depends on Phase 2. P2 flujo no requiere cambios de código si funciona; solo validación.
- **Phase 4**: Depends on Phase 2 and Phase 3.
- **Phase 5**: Depends on Phase 4.

### Within User Story

- **US1**: Model → proxy → component → pages → UI tests.
- **US2**: Reproducir flujo → documentar deuda si falla.

### Parallel Opportunities

- T011-T014 (SubNav + pages) se pueden hacer juntas en un solo commit.
- T015 (proxy) se puede hacer en paralelo con T011-T014, pero ambos deben probarse juntos.
- T021-T024 (flujo) son secuenciales.
- T031-T036 son paralelos entre sí, salvo que requieren el deploy previo.

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1: análisis y decisión de mecanismo de rol.
2. Phase 2: implementar filtro de SubNav y protección perimetral de sub-rutas.
3. Phase 3: sanity check del flujo del comité.
4. Phase 4: validación manual y automática.
5. Phase 5: cierre y push.

---

## Notes

- No se requieren cambios en Prisma (data-model.md vacío de entidades nuevas).
- El cambio es mínimo y acotado a UI y proxy; no se rediseña la bandeja del comité.
- `ComiteSubNav` sigue siendo "use client" para `usePathname`; el rol se recibe como prop para evitar fetch adicional y parpadeo.
- El proxy se usa como defensa perimetral; el layout admin y los endpoints conservan su `verifyAuth`.
