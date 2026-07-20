# Tasks: UX del comité y navegación del padre

**Input**: Design documents from `/specs/043-ux-comite-nav-padre/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Component tests para `NavHeader`, `ComiteBandeja`, `ComiteSolicitudDetalle`; tests de endpoint para `resolver`; verificación manual del copy.

**Organization**: Tasks grouped by user story and phase.

---

## Phase 1 — Investigación y diseño UX

- [P] T001 Revisar `NavHeader.tsx`, `DashboardUsuarioClient.tsx`, `ComiteBandeja.tsx`, `ComiteSolicitudDetalle.tsx`, `resolver/route.ts` y `circulo-confianza/page.tsx`.
  - Archivos: listados arriba.
- [P] T002 Consultar `/skill:ui-ux-pro-max` para patrones de navegación, listas unificadas y flujos de resolución.
  - Entrega: recomendaciones en `research.md`.
- [P] T003 Decidir estrategia de navegación para padre (`/dashboard` vs `/dashboard-publico`) y flujo de auto-asignación del comité.
  - Archivos: `plan.md`.

**Checkpoint**: Hallazgos documentados y decisiones de diseño tomadas.

---

## Phase 2 — US1: Acceso del padre a la consulta enriquecida (P1)

- T011 En `NavHeader.tsx`, condicionar el `href` del botón "Dashboard" según autenticación (`/dashboard` para `PARENT`, `/dashboard-publico` para anónimos).
  - Archivo: `src/components/modules/NavHeader.tsx`.
- T012 Añadir enlace "Mi panel" → `/dashboard` en el menú desplegable del `PARENT`.
  - Archivo: `src/components/modules/NavHeader.tsx`.
- T013 Añadir enlace a `/dashboard` en el menú móvil para `PARENT`.
  - Archivo: `src/components/modules/NavHeader.tsx`.
- T014 Agregar test de componente para verificar que el enlace de `PARENT` apunta a `/dashboard`.
  - Archivo: `src/components/modules/NavHeader.test.tsx` (crear si no existe).

**Checkpoint**: Padre autenticado puede navegar a `/dashboard`.

---

## Phase 3 — US2: Bandeja del comité en un solo submódulo (P1)

- T021 Eliminar estado `tab` y pestañas en `ComiteBandeja.tsx`.
  - Archivo: `src/components/modules/ComiteBandeja.tsx`.
- T022 Cambiar o fusionar endpoint para obtener todas las solicitudes del comité (p.ej. `/api/admin/comite/solicitudes` o combinar pendientes + mías).
  - Archivo: `src/app/api/admin/comite/solicitudes/route.ts` (si se crea) o `src/components/modules/ComiteBandeja.tsx`.
- T023 Implementar auto-asignación al abrir un caso `PENDIENTE` (llamar a `/api/admin/comite/${id}/asignar` antes de abrir el detalle).
  - Archivo: `src/components/modules/ComiteBandeja.tsx`.
- T024 Mostrar estado de carga mientras se asigna; manejar error si otro comité lo tomó.
  - Archivo: `src/components/modules/ComiteBandeja.tsx`.
- T025 Mostrar casos asignados a otro comité en modo solo lectura o con acción deshabilitada.
  - Archivo: `src/components/modules/ComiteBandeja.tsx` y/o `ComiteSolicitudDetalle.tsx`.
- T026 Agregar/actualizar test de componente para `ComiteBandeja`.
  - Archivo: `src/components/modules/ComiteBandeja.test.tsx` (crear si no existe).

**Checkpoint**: Bandeja unificada con auto-asignación funciona.

---

## Phase 4 — US3: Resolver simplificado (P1)

- T031 Eliminar radio buttons y estado `accion` en `ComiteSolicitudDetalle.tsx`.
  - Archivo: `src/components/modules/ComiteSolicitudDetalle.tsx`.
- T032 Cambiar título a "Resolver solicitud" y botón a "Resolver".
  - Archivo: `src/components/modules/ComiteSolicitudDetalle.tsx`.
- T033 Ajustar el body de la llamada a `resolver` para enviar solo `categoria` y `resolucion`.
  - Archivo: `src/components/modules/ComiteSolicitudDetalle.tsx`.
- T034 En `resolver/route.ts`, eliminar `accion` del schema y siempre usar `estadoNuevo = CORREGIDO`.
  - Archivo: `src/app/api/admin/comite/[id]/resolver/route.ts`.
- T035 Actualizar siempre `ClasificacionIA.categoria` y `confianza = 1.0` en el resolver.
  - Archivo: `src/app/api/admin/comite/[id]/resolver/route.ts`.
- T036 Actualizar mensaje de éxito del componente para reflejar `CORREGIDO`.
  - Archivo: `src/components/modules/ComiteSolicitudDetalle.tsx`.
- T037 Actualizar tests de `resolver` para esperar `CORREGIDO`.
  - Archivo: `src/app/api/admin/comite/[id]/resolver/route.test.ts`.
- T038 Agregar test de componente para `ComiteSolicitudDetalle` con el nuevo flujo.
  - Archivo: `src/components/modules/ComiteSolicitudDetalle.test.tsx` (crear si no existe).

**Checkpoint**: Resolver siempre deja el reporte en `CORREGIDO`.

---

## Phase 5 — US4: Copy del Círculo de Confianza (P2)

- T041 Reemplazar el texto en `src/app/dashboard/circulo-confianza/page.tsx` línea 364.
  - Archivo: `src/app/dashboard/circulo-confianza/page.tsx`.
- T042 Verificar contraste y legibilidad en modo claro/oscuro.
  - Archivo: `src/app/dashboard/circulo-confianza/page.tsx`.

**Checkpoint**: Copy claro y legible.

---

## Phase 6 — Tests, validación y cierre

- [P] T051 Ejecutar `npx tsc --noEmit`.
- [P] T052 Ejecutar `npm run lint`.
- [P] T053 Ejecutar `npm run test`.
- [P] T054 Ejecutar `rm -rf .next && npm run build`.
- [P] T055 Ejecutar `./scripts/dev-restart.sh` y healthcheck.
- [P] T056 Ejecutar `quickstart.md` de punta a punta.
- T061 Actualizar `specs/043-ux-comite-nav-padre/spec.md` con sección Implementación.
- T062 Crear `docs/cierre-043.md`.
- T063 Validar checklist de requisitos.
- T064 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies.
- **Phase 2**: Depends on Phase 1.
- **Phase 3**: Depends on Phase 1 and lightly on Phase 4.
- **Phase 4**: Depends on Phase 1.
- **Phase 5**: Depends on Phase 1.
- **Phase 6**: Depends on Phase 2, 3, 4 and 5.

### Parallel Opportunities

- Phase 2, Phase 3, Phase 4 and Phase 5 can run in parallel after Phase 1.
- T011-T013 (NavHeader) are sequential; T014 independent.
- T021-T026 (ComiteBandeja) are sequential; T031-T038 (ComiteSolicitudDetalle + resolver) are sequential.
- T051-T056 (Phase 6) are parallel except T055 requires T054.

---

## Implementation Strategy

### MVP First

1. Phase 1: análisis y decisiones.
2. Phase 2: navegación del padre.
3. Phase 3: bandeja unificada del comité.
4. Phase 4: resolver simplificado.
5. Phase 5: copy del círculo.
6. Phase 6: validación y cierre.

---

## Notes

- No se requieren migraciones de Prisma.
- No se modifica el modelo de datos.
- No se toca el clasificador/eval ni la lógica de privacidad.
- Se siguen las recomendaciones de UI/UX Pro Max: glassmorphism, colores rojo/alerta + azul/seguridad, Fira Sans, focus/hover/reduced-motion, listas unificadas.
- Si durante la implementación se descubre que se necesita un nuevo endpoint para listar todas las solicitudes del comité, se implementa con el mínimo cambio posible.
