# Tasks: Accesibilidad (WCAG 2.2)

**Input**: Design documents from `/specs/049-accesibilidad-wcag/`

**Tests**: Vitest + scripts de contraste + auditoría manual

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Crear artefactos Spec-Kit y scripts de auditoría

- [x] T001 Crear directorio `specs/049-accesibilidad-wcag/` con spec.md, plan.md, research.md, data-model.md, quickstart.md, checklists/requirements.md, tasks.md
- [x] T002 [P] Crear script `scripts/contrast_check.js` con fórmula de luminancia WCAG para colores y fondos glass del proyecto
- [x] T003 [P] Crear script `scripts/a11y_audit.js` para detectar botones con íconos sin label y SVGs sin `aria-hidden`

---

## Phase 2: User Story 1 — Iconos y controles con nombre accesible (Priority: P1)

**Goal**: Todos los botones de solo-ícono tienen nombre accesible; íconos decorativos ocultos; badges de riesgo no dependen solo del color.

**Independent Test**: `node scripts/a11y_audit.js` reporta 0 icon buttons sin label; RiskBadge se renderiza con texto/forma.

### Implementation for User Story 1

- [ ] T004 [P] [US1] Agregar `aria-label` a botones de solo-ícono (`NavHeader.tsx` user dropdown, `AuditLogViewer.tsx` Ver/Ocultar, y otros detectados)
- [ ] T005 [P] [US1] Agregar `aria-hidden="true"` a íconos decorativos en `AdminNav.tsx`, `LandingHero.tsx`, `LandingFeatures.tsx`, `CanalesOficiales.tsx`, `ConfirmacionReporte.tsx`, `Select.tsx`, `IaDocsPanel.tsx`, `dataset-entrenamiento/page.tsx`, `offline/page.tsx`, `NavHeader.tsx` (iconos internos), `ScoreDisplay.tsx`
- [ ] T006 [US1] Mejorar `RiskBadge.tsx` para que el punto de color tenga alternativa textual (texto visible + `span` con `aria-hidden` o `sr-only`) y no dependa solo del color
- [ ] T007 [P] [US1] Agregar/verificar tests de renderizado para `RiskBadge` y `ThemeToggle`

**Checkpoint**: `node scripts/a11y_audit.js` muestra 0 icon buttons sin label; los íconos decorativos están ocultos.

---

## Phase 3: User Story 2 — Contraste del glassmorphism medido y ajustado (Priority: P1)

**Goal**: Cada combinación de texto/fondo usada cumple 4.5:1 (texto normal) / 3:1 (texto grande) en normal, hover y focus.

**Independent Test**: `node scripts/contrast_check.js` no reporta fallos en las combinaciones usadas.

### Implementation for User Story 2

- [ ] T008 [P] [US2] Ajustar `text-accent` en modo claro si falla contraste (sky-600 → sky-700)
- [ ] T009 [P] [US2] Ajustar `text-subtle` en modo oscuro si falla contraste (slate-500 → slate-400)
- [ ] T010 [P] [US2] Ajustar colores de fondo de botones `primary`, `secondary`, `danger` para que texto blanco alcance 4.5:1
- [ ] T011 [P] [US2] Ajustar `Badge` variant `warning` si el texto sobre el fondo ámbar falla contraste
- [ ] T012 [P] [US2] Ajustar estados `:hover` y `:focus-visible` de botones y enlaces para mantener contraste
- [ ] T013 [P] [US2] Re-ejecutar `scripts/contrast_check.js` y documentar resultados

**Checkpoint**: Todas las combinaciones medidas pasan los ratios; build sin errores.

---

## Phase 4: User Story 3 — Navegación por teclado, foco visible y touch targets (Priority: P2)

**Goal**: Todos los controles interactivos son operables con teclado, tienen foco visible y targets táctiles adecuados.

**Independent Test**: Navegación con Tab/Shift+Tab, foco visible en todos los controles, áreas táctiles ≥ 44×44 px.

### Implementation for User Story 3

- [ ] T014 [P] [US3] Asegurar `focus-visible` en todos los `<button>` nativos y `<a>` interactivos (agregar `ring-accent` o equivalente en `globals.css` y componentes)
- [ ] T015 [P] [US3] Agregar `min-h-[44px] min-w-[44px]` a botones de solo-ícono y controles compactos
- [ ] T016 [P] [US3] Verificar operación con `Escape` en `NavHeader.tsx` (dropdown de usuario y menú móvil) — ya implementado, validar
- [ ] T017 [P] [US3] Verificar que `Link` de Next.js y botones nativos reciban foco visible; agregar utilidad global si falta
- [ ] T018 [P] [US3] Agregar tests de `Button` para verificar foco y target size

**Checkpoint**: Navegación con teclado funciona; foco visible en todos los controles; targets táctiles cumplen.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validación final, documentación y cierre.

- [ ] T019 [P] Ejecutar `npx tsc --noEmit`
- [ ] T020 [P] Ejecutar `npm run lint`
- [ ] T021 [P] Ejecutar `npm run test`
- [ ] T022 [P] Ejecutar `node scripts/contrast_check.js` y `node scripts/a11y_audit.js`
- [ ] T023 [P] Ejecutar `quickstart.md` (build, navegación con teclado, touch targets)
- [ ] T024 [P] Deploy limpio con `./scripts/dev-restart.sh`
- [ ] T025 [P] Escribir `specs/049-accesibilidad-wcag/cierre.md` con evidencia y sección Implementación en `spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (US1)**: Depends on Phase 1 (scripts de auditoría).
- **Phase 3 (US2)**: Depends on Phase 1; puede ejecutarse en paralelo con US1.
- **Phase 4 (US3)**: Depends on Phase 1; puede ejecutarse en paralelo con US1/US2.
- **Phase 5 (Polish)**: Depends on all user stories.

### Parallel Opportunities

- T004-T006 (US1 impl): T004 y T005 en paralelo; T006 depende de ninguno.
- T008-T013 (US2 impl): Todos en paralelo.
- T014-T018 (US3 impl): Todos en paralelo.

### Within Each User Story

- US1: detectar → agregar labels → ocultar íconos decorativos → testear.
- US2: medir → ajustar color → re-medir → documentar.
- US3: verificar foco → ajustar estilos → verificar targets → testear.

---

## Implementation Strategy

### MVP First (US1 + US2, P1)

1. Completar scripts de auditoría.
2. Corregir nombres accesibles e íconos decorativos.
3. Medir y ajustar contrastes fallidos.
4. **STOP and VALIDATE**: `a11y_audit.js` y `contrast_check.js` limpios.

### Incremental Delivery

1. US1 → test → commit.
2. US2 → medir → ajustar → commit.
3. US3 → foco/targets → commit.
4. Polish → docs → commit.
