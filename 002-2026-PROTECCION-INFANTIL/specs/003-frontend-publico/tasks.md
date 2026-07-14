# Tasks: Frontend Público y Flujo de Reporte

**Input**: Design documents from `/specs/003-frontend-publico/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-api.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Adaptar proyecto existente para soportar fuentes, glassmorphism, y componentes base

- [x] T001 Configurar `tailwind.config.ts`: añadir fuentes Plus Jakarta Sans + DM Mono, keyframes floatUp, paleta oklch del prototipo
- [x] T002 Actualizar `src/app/layout.tsx`: importar fuentes vía `next/font/google`, aplicar a body
- [x] T003 [P] Crear componentes base UI en `src/components/ui/`: `GlassCard.tsx`, `Input.tsx`, `Button.tsx`, `Select.tsx`

**Checkpoint**: `npm run build` pasa; fuentes cargadas sin layout shift

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura compartida que DEBE estar lista antes de cualquier user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Crear `src/lib/hooks/useApi.ts`: fetch nativo con loading, error, retry; envía cookie automáticamente (`credentials: include`)
- [x] T005 Crear `src/lib/contexts/AuthContext.tsx`: estado de usuario autenticado, `login`, `logout`, `checkSession` (llama `GET /api/me`)
- [x] T006 Crear `src/components/modules/CanalesOficiales.tsx`: Línea 141, CAI Virtual, Te Protejo — visible en consulta y reporte
- [x] T007 [P] Crear `src/components/modules/ConsultaForm.tsx`: formulario de búsqueda con identificador + plataforma
- [x] T008 [P] Crear `src/components/modules/ConsultaResultado.tsx`: muestra estadísticas agregadas o mensaje neutro

**Checkpoint**: useApi funcional, AuthContext responde a /api/me, CanalesOficiales renderiza

---

## Phase 3: User Story 1 — Consultar identificador de riesgo (Priority: P1) 🎯 MVP

**Goal**: Página de inicio con búsqueda y resultado de consulta pública

**Independent Test**: Escenario A del quickstart: buscar identificador → ver estadísticas o "Sin reportes registrados"

### Implementation for User Story 1

- [x] T009 [US1] Reemplazar `src/app/page.tsx` con página de inicio: hero + ConsultaForm + CanalesOficiales
- [x] T010 [US1] Integrar ConsultaResultado en `src/app/page.tsx`: conectar a `GET /api/consulta` vía useApi
- [x] T011 [US1] Implementar estado de carga y error en consulta (spinner, mensajes amigables)
- [x] T012 [US1] Responsive mobile-first: input grande, botón prominente, resultado apilado

**Checkpoint**: Escenario A pasa (consulta con/sin reportes)

---

## Phase 4: User Story 2 — Crear reporte comunitario (Priority: P1) 🎯 MVP

**Goal**: Flujo de 4 pasos para crear reporte (anónimo o autenticado) con confirmación

**Independent Test**: Escenario B del quickstart: completar wizard → recibir RPT-XXXXXX

### Implementation for User Story 2

- [x] T013 [US2] Crear `src/components/modules/ReporteWizard.tsx`: contenedor con state step 1-4, barra de progreso
- [x] T014 [P] [US2] Crear `src/components/modules/ReporteStepPlataforma.tsx`: selección de plataforma (Select con logos/nombres)
- [x] T015 [P] [US2] Crear `src/components/modules/ReporteStepUbicacion.tsx`: ciudad, país, fechaIncidente
- [x] T016 [P] [US2] Crear `src/components/modules/ReporteStepDescripcion.tsx`: textarea 20-5000 chars, contador, sin input de archivo
- [x] T017 [US2] Crear `src/components/modules/ReporteStepConfirmar.tsx`: resumen + checkbox obligatorio + botón enviar
- [x] T018 [US2] Conectar wizard a `POST /api/reportes` vía useApi; manejar 201 y 429 (duplicado)
- [x] T019 [US2] Crear `src/components/modules/ConfirmacionReporte.tsx`: mostrar número seguimiento, botón copiar, link a seguimiento
- [x] T020 [US2] Implementar `src/app/reportar/page.tsx`: renderiza ReporteWizard + CanalesOficiales

**Checkpoint**: Escenario B pasa (wizard completo, confirmación con RPT-XXXXXX)

---

## Phase 5: User Story 3 — Autenticación de padres (Priority: P2)

**Goal**: Registro con verificación por email, login, logout

**Independent Test**: Escenario C del quickstart: registrar → verificar → login → /api/me responde

### Implementation for User Story 3

- [x] T021 [P] [US3] Crear `src/components/modules/RegistroForm.tsx`: email, nombre, password
- [x] T022 [P] [US3] Crear `src/components/modules/VerificacionForm.tsx`: código 6 dígitos + password + nombre
- [x] T023 [P] [US3] Crear `src/components/modules/LoginForm.tsx`: email + password
- [x] T024 [US3] Implementar `src/app/registro/page.tsx`: RegistroForm → solicitar código → VerificacionForm
- [x] T025 [US3] Implementar `src/app/login/page.tsx`: LoginForm + link a registro
- [x] T026 [US3] Integrar AuthContext en layout: verificar sesión al cargar, mostrar nombre/logout en nav
- [x] T027 [US3] Conectar `POST /api/auth/login`, `POST /api/auth/verificar/solicitar`, `POST /api/auth/verificar/completar`, `POST /api/auth/logout`

**Checkpoint**: Escenario C pasa (registro completo, login funcional, logout limpia cookie)

---

## Phase 6: User Story 4 — Panel "Mis reportes" (Priority: P2)

**Goal**: Listado de reportes del usuario autenticado con estados visuales amigables

**Independent Test**: Escenario D del quickstart: GET /api/reportes/mis-reportes → lista con estadoVisual

### Implementation for User Story 4

- [x] T028 [US4] Crear `GET /api/reportes/mis-reportes/route.ts`: lista reportes del usuario autenticado, paginado, sin textoOriginal
- [x] T029 [US4] Crear `src/components/modules/MisReportesList.tsx`: tabla/cards con identificador, plataforma, estadoVisual, fecha
- [x] T030 [US4] Implementar `src/app/mis-reportes/page.tsx`: MisReportesList + useApi a /api/reportes/mis-reportes
- [x] T031 [US4] Mapeo de estado técnico → estadoVisual: "Recibido", "En procesamiento", "Procesado", "En revisión", "En revisión de privacidad", "Vinculado a reporte existente"
- [x] T032 [US4] Proteger ruta: redirigir a /login si no autenticado

**Checkpoint**: Escenario D pasa (lista con estados amigables, sin PII)

---

## Phase 7: User Story 5 — Seguimiento de reporte por número (Priority: P3)

**Goal**: Consulta pública de estado por número de seguimiento

**Independent Test**: Escenario E parcial: ingresar RPT-XXXXXX → ver estado amigable

### Implementation for User Story 5

- [x] T033 [US5] Crear `src/components/modules/SeguimientoForm.tsx`: input de número + botón consultar
- [x] T034 [US5] Implementar `src/app/seguimiento/page.tsx`: SeguimientoForm + resultado con estadoVisual
- [x] T035 [US5] Conectar a `GET /api/reportes/seguimiento/[numero]` vía useApi; manejar 404 amigable

**Checkpoint**: Escenario E parcial pasa (seguimiento con número válido e inválido)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validación final, accesibilidad, build

- [x] T036 [P] Verificar accesibilidad: labels en todos los inputs, foco visible, contraste 4.5:1
- [x] T037 [P] Verificar que ninguna pantalla de reporte incluya input de archivo, imagen, audio, video
- [x] T038 [P] Revisar lenguaje en toda UI: "N reportes registrados", nunca "peligroso", "culpable", "depredador"
- [x] T039 Verificar que CanalesOficiales aparece en page.tsx, reportar/page.tsx, y seguimiento/page.tsx
- [x] T040 Ejecutar `npm run build` — debe compilar sin errores de TypeScript
- [x] T041 Ejecutar escenarios del quickstart.md (A-E) y registrar salidas

**Checkpoint**: Build OK, quickstart validado, reglas duras verificadas

---

## Phase 9: Refinamiento de Reporte (FR-022 a FR-026)

**Purpose**: Mejorar usabilidad y consistencia del paso de reporte (US2)

**Depends on**: Phase 4 (US2) — el wizard base ya existe

### Database & Backend

- [ ] T042 [P] Ampliar `prisma/schema.prisma`: agregar modelos `Pais` y `Ciudad` (catálogos globales, sin `tenantId`); agregar a `Reporte` los campos `paisId`, `ciudadId`, `otraPlataforma`
- [ ] T043 Ejecutar `npx prisma migrate dev --name add_pais_ciudad` (no `db push`)
- [ ] T044 [P] Crear/actualizar `prisma/seed.ts`: seed de 18 países latinoamericanos + ~8-10 ciudades principales por país (capitales + grandes)
- [ ] T045 Crear `src/app/api/plataformas/route.ts`: `GET` devuelve plataformas activas ordenadas por nombre, `"otro"` al final
- [ ] T046 Crear `src/app/api/paises/route.ts`: `GET` devuelve países activos ordenados por nombre
- [ ] T047 Crear `src/app/api/ciudades/route.ts`: `GET` filtra por `?paisId=`, devuelve ciudades activas ordenadas + opción virtual `"Otra ciudad o municipio"` (`id="otra"`)
- [ ] T048 Actualizar `src/app/api/reportes/route.ts`: aceptar `paisId`, `ciudadId`, `otraPlataforma`; validar `fechaIncidente ≤ hoy` (Zod); mapear plataforma `"otro"` si aplica

### Frontend — Refactor Wizard

- [ ] T049 Refactor `src/components/modules/ReporteStepUbicacion.tsx`: 
  - fecha incidente con `max={new Date().toISOString().split('T')[0]}` (FR-022)
  - país desde `GET /api/paises` (Select)
  - ciudad en cascada desde `GET /api/ciudades?paisId=` (Select)
  - opción `"Otra ciudad o municipio"` habilita input libre (FR-024)
- [ ] T050 Refactor `src/components/modules/ReporteStepPlataforma.tsx`:
  - plataformas desde `GET /api/plataformas` (FR-026)
  - opción `"Otra"` habilita input libre (FR-025)
- [ ] T051 Actualizar `src/components/modules/ReporteWizard.tsx`: pasar `paisId`, `ciudadId`, `otraPlataforma` en el body de `POST /api/reportes`; manejar ciudad `"otra"` (sin FK) y plataforma `"otro"`
- [ ] T052 Actualizar `src/components/modules/ReporteStepConfirmar.tsx`: mostrar país/ciudad/plataforma resueltos (incluyendo "Otra")

### Validación

- [ ] T053 `npm run build` pasa sin errores TypeScript
- [ ] T054 Verificar end-to-end: crear reporte con "Otra" plataforma y "Otra ciudad" → confirma que `POST /api/reportes` guarda `otraPlataforma` y `ciudad` (string)
- [ ] T055 Verificar que fecha futura es rechazada por el input (max) y por el backend (Zod)

**Checkpoint**: Wizard de reporte usa datos dinámicos, fecha futura bloqueada, campos libres funcionan

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends on | Bloquea |
|-------|-----------|---------|
| Phase 1 (Setup) | Nada | Phase 2 |
| Phase 2 (Foundational) | Phase 1 | Phase 3-7, 9 |
| Phase 3 (US1) | Phase 2 | Nada |
| Phase 4 (US2) | Phase 2 | Phase 9 |
| Phase 5 (US3) | Phase 2 | Phase 6 (US4 requiere auth) |
| Phase 6 (US4) | Phase 2 + US3 | Nada |
| Phase 7 (US5) | Phase 2 | Nada |
| Phase 8 (Polish) | Todas las anteriores | Nada |
| Phase 9 (Refinamiento) | Phase 4 (US2) | Nada |

### Within Each User Story

- Componentes UI antes de integración con APIs
- Core implementation antes de polish

### Parallel Opportunities

- Phase 1: T001-T003 en paralelo
- Phase 2: T004-T008 en paralelo
- Phase 3+ (post-foundational): US1, US2, US3, US5 pueden desarrollarse en paralelo
- Phase 6 (US4) depende de US3 (auth funcional)

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1: Setup
2. Phase 2: Foundational (CRITICAL - blocks all stories)
3. Phase 3: US1 — Consultar identificador
4. Phase 4: US2 — Crear reporte
5. **STOP and VALIDATE**: Escenarios A, B del quickstart
6. Deploy/demo if ready

### Incremental Delivery

7. Phase 5: US3 — Autenticación
8. Phase 6: US4 — Mis reportes
9. Phase 7: US5 — Seguimiento
10. Phase 8: Polish
11. Phase 9: Refinamiento de Reporte (FR-022 a FR-026)

---

## Notes

- Total tasks: 55 (T001-T055 completas, T001-T041 implementadas, T042-T055 pendientes de Phase 9)
- Tasks por fase: P1=4, P2=8, P3=4, P4=8, P5=7, P6=5, P7=3, P8=6, P9=14
- Sin tareas de test explícitas (no fueron solicitadas en spec)
- Reglas duras a verificar en cada fase:
  - Sin inputs de archivo/multimedia (FR-021)
  - Presunción de inocencia en lenguaje (§1.3)
  - Canales oficiales visibles (§1.1)
  - Cookie httpOnly, no localStorage (§6.1)
  - Fecha del incidente nunca futura (FR-022)
  - Plataformas y ubicaciones desde BD, no hardcodeadas (FR-023, FR-026)
