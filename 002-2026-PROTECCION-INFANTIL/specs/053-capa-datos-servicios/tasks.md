# Tasks: Planificación de la Capa de datos / servicios (DAL)

**Input**: Design documents from `/specs/053-capa-datos-servicios/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `checklists/requirements.md`

**Scope**: Planificación únicamente. No se escribe código de producción en este spec.

**Organization**: Tasks grouped by phase. Each task has a file path and dependency order.

---

## Phase 0: Análisis y convenciones

**Purpose**: Consolidar el entendimiento del estado actual y definir las reglas del DAL.

- [ ] T001 [P] Revisar y aprobar `research.md`: cuantificar uso directo de Prisma por módulo y validar riesgos. **Archivo**: `specs/053-capa-datos-servicios/research.md`
- [ ] T002 [P] Definir convenciones de nombres y ubicación del DAL en `plan.md`. **Archivo**: `specs/053-capa-datos-servicios/plan.md`
- [ ] T003 [P] Definir patrón de inyección de cliente transaccional (`tx ?? prisma`) y documentarlo en `data-model.md`. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T004 Definir límites entre DAL, infraestructura (`queue`, `rate-limit`, `email`) y autorización. **Archivo**: `specs/053-capa-datos-servicios/plan.md`

**Checkpoint**: Convenciones aprobadas y publicadas en `plan.md` y `data-model.md`.

---

## Phase 1: Diseño del módulo Reporte

**Purpose**: Diseñar los repositorios, servicios y DTOs del módulo con mayor impacto.

- [ ] T005 [P] Diseñar el agregado `Reporte` y sus DTOs (`ReporteDto`, `ReporteCreateInput`, `ReporteUpdateInput`, `ReporteListQuery`). **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T006 [P] Diseñar `ReporteRepository`: métodos, firmas y dependencias. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T007 [P] Diseñar `IdentificadorReportadoRepository`, `ClasificacionIARepository`, `TransicionReporteRepository` y `ReintentoReporteRepository`. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T008 Diseñar `EmbeddingRepository` como adaptador de infraestructura para `pgvector`. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T009 [P] Diseñar `ReporteCreationService`: validación, deduplicación, cifrado, persistencia y encolado. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T010 [P] Diseñar `ReporteProcessingService`: pipeline de IA con transacciones. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T011 [P] Diseñar `ReporteLifecycleService`: baja, reactivación, anonimización, fallback y purga de embeddings. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T012 Diseñar `ReporteQueryService`: listados, detalle y seguimiento con DTOs. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T013 Actualizar `quickstart.md` con escenarios de validación del módulo Reporte. **Archivo**: `specs/053-capa-datos-servicios/quickstart.md`

**Checkpoint**: Diseño del módulo Reporte completo y revisado.

---

## Phase 2: Diseño del módulo Consulta pública

**Purpose**: Diseñar el segundo módulo candidato, casi de solo lectura.

- [ ] T014 [P] Diseñar DTOs de consulta (`ConsultaResumenDto`, `ConsultaDetalleDto`, `NivelRiesgo`). **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T015 Diseñar `ConsultaPublicaService`: agregación de plataformas, ubicaciones y timeline. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T016 Diseñar `RiesgoConsultaService`: cálculo de nivel de riesgo a partir de parámetros. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T017 Actualizar `quickstart.md` con escenarios de validación de Consulta pública. **Archivo**: `specs/053-capa-datos-servicios/quickstart.md`

**Checkpoint**: Diseño de Consulta pública completo y alineado con el módulo Reporte.

---

## Phase 3: Diseño de módulos restantes

**Purpose**: Establecer el patrón para Configuración, Autenticación y futuras migraciones.

- [ ] T018 [P] Diseñar `ParametroRepository` y su relación con `src/lib/parametros.ts`. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T019 [P] Diseñar `UsuarioRepository`, `CodigoVerificacionRepository` y `TokenRecuperacionRepository`. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T020 [P] Diseñar repositorios de dominio para Apelaciones, Alertas, Círculo de confianza y Operadores. **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T021 [P] Diseñar repositorios de IA/Estadísticas (`EvalRunRepository`, `CasoEvalRepository`, `EstadisticasRepository`). **Archivo**: `specs/053-capa-datos-servicios/data-model.md`
- [ ] T022 Definir secuencia de migración por módulo y criterios de "listo para siguiente módulo". **Archivo**: `specs/053-capa-datos-servicios/plan.md`

**Checkpoint**: Patrón replicable documentado para todos los módulos candidatos.

---

## Phase 4: Revisión de calidad y alineación

**Purpose**: Validar que el plan cumple con Spec-Kit y la constitución antes de solicitar aprobación humana.

- [ ] T023 [P] Re-ejecutar Constitution Check en `plan.md` y actualizar si es necesario. **Archivo**: `specs/053-capa-datos-servicios/plan.md`
- [ ] T024 [P] Completar `checklists/requirements.md` y verificar que no queden ítems pendientes. **Archivo**: `specs/053-capa-datos-servicios/checklists/requirements.md`
- [ ] T025 Verificar que no se propongan cambios en SPEC-050 ni SPEC-060. **Archivo**: `specs/053-capa-datos-servicios/spec.md`
- [ ] T026 Revisar consistencia entre `spec.md`, `plan.md`, `data-model.md` y `tasks.md`. **Archivo**: `specs/053-capa-datos-servicios/`
- [ ] T027 Preparar resumen de aprobación para el agente padre / revisión humana. **Archivo**: `specs/053-capa-datos-servicios/spec.md`

**Checkpoint**: Plan listo para aprobación humana; status `PLANEADO`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0**: No dependencies. Must complete before Phase 1.
- **Phase 1 (Reporte)**: Depends on Phase 0. BLOCKS Phase 2 because it defines the base pattern.
- **Phase 2 (Consulta pública)**: Depends on Phase 1.
- **Phase 3 (Restantes)**: Depends on Phase 1 (base pattern).
- **Phase 4 (Quality)**: Depends on all prior phases.

### Parallel Opportunities

- T001-T004 (Phase 0): All parallel.
- T005-T012 (Phase 1): T005-T008 are parallel; T009-T012 depend on T005-T008.
- T014-T016 (Phase 2): Parallel after Phase 1.
- T018-T022 (Phase 3): All parallel after Phase 1.
- T023-T027 (Phase 4): T023-T024 parallel; T025-T027 depend on earlier phases.

---

## Notes

- All tasks are design/planning tasks. No implementation tasks are included because this spec stops at the plan phase.
- File paths follow the convention: design documents live in `specs/053-capa-datos-servicios/`; source-code paths are referenced in `data-model.md` and `plan.md` but are not modified until `/speckit.implement`.
- The next step after approval is to create implementation tasks (TNNN) for the first module and proceed with `/speckit.implement`.
