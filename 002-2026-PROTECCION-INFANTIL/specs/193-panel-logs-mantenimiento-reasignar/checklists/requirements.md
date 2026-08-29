# Specification Quality Checklist: SPEC-193 — Panel de Logs + Mantenimiento + Reasignar Operador

**Purpose**: Validate specification completeness and quality before proceeding to planning.  
**Created**: 2026-08-21  
**Feature**: [spec.md](../spec.md)

---

## Content Quality

- [x] No implementation details beyond anchors del BRIEF (WorkerLog, helper, endpoints, modal).
- [x] Focused on user value (diagnosticar, configurar, mantener, reasignar).
- [x] Written for non-technical stakeholders (oraciones claras, sin código de producto).
- [x] All mandatory sections completed.

---

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain.
- [x] Requirements are testable and unambiguous.
- [x] Success criteria are measurable.
- [x] Success criteria are technology-agnostic en lo posible.
- [x] All acceptance scenarios are defined.
- [x] Edge cases are identified.
- [x] Scope is clearly bounded.
- [x] Dependencies and assumptions identified.

---

## Functional Requirements Traceability

| ID | Requirement | Status |
|----|-------------|--------|
| FR-001 | Tabla `WorkerLog` con índices | ✅ Especificado en `data-model.md` |
| FR-002 | Helper `workerLogger` con child | ✅ Especificado |
| FR-003 | Escritura siempre a stdout | ✅ Especificado |
| FR-004 | Sink a BD condicional a params | ✅ Especificado |
| FR-005 | No bloqueo si BD falla | ✅ Especificado |
| FR-006 | Parámetros sembrados en seed | ✅ Especificado en `data-model.md` |
| FR-007 | `GET /api/admin/monitoreo/logs` | ✅ Contratado |
| FR-008 | Query params y respuesta `{items,total}` | ✅ Contratado |
| FR-009 | Orden `creadoEn DESC` | ✅ Contratado |
| FR-010 | Sub-tab Logs en operación | ✅ Especificado |
| FR-011 | Sección Monitoreo → Logs en configuración | ✅ Especificado |
| FR-012 | Instrumentar 4 workers | ✅ Especificado |
| FR-013 | Sección Mantenimiento en configuración | ✅ Especificado |
| FR-014 | Formulario purga con validaciones | ✅ Especificado |
| FR-015 | Conteo previo antes de purgar | ✅ Especificado |
| FR-016 | `DELETE /api/admin/monitoreo/logs` | ✅ Contratado |
| FR-017 | `AuditLog` tras purga | ✅ Especificado |
| FR-018 | `PATCH /api/admin/operadores/reasignar` | ✅ Contratado |
| FR-019 | Validaciones de reasignación | ✅ Contratado |
| FR-020 | Timeline + AuditLog de reasignación | ✅ Contratado |
| FR-021 | Componente `ReasignarModal` reusable | ✅ Especificado |
| FR-022 | `WorkerLog` solo para ADMIN | ✅ Especificado |
| FR-023 | No modificar Reporte/Usuario | ✅ Especificado |
| FR-024 | No tocar `src/lib/ai/**` | ✅ Especificado |

---

## Success Criteria Traceability

| ID | Criterion | Status |
|----|-----------|--------|
| SC-001 | Consulta < 1 s para 100 registros | ✅ Medible |
| SC-002 | < 5 % de mensajes persistidos con WARN default | ✅ Medible |
| SC-003 | 100 % de fallos de BD absorbidos | ✅ Medible |
| SC-004 | 100 % de purgas con AuditLog | ✅ Medible |
| SC-005 | 100 % de reasignaciones con traza | ✅ Medible |
| SC-006 | Endpoints protegidos para no-ADMIN | ✅ Medible |
| SC-007 | Migración aditiva | ✅ Verificable |
| SC-008 | 4 workers emiten logs mínimos | ✅ Verificable |

---

## Tests Traceability (se completarán en implementación)

| ID | Test | Phase |
|----|------|-------|
| T-001 | `workerLogger` persiste solo si enabled + nivel >= mínimo | Implementación |
| T-002 | `workerLogger` no falla si BD caída | Implementación |
| T-003 | `GET /api/admin/monitoreo/logs` devuelve `{items,total}` filtrado | Implementación |
| T-004 | `GET /api/admin/monitoreo/logs` rechaza no-ADMIN | Implementación |
| T-005 | `DELETE /api/admin/monitoreo/logs` borra y genera AuditLog | Implementación |
| T-006 | `DELETE /api/admin/monitoreo/logs` rechaza `hasta` >= hoy | Implementación |
| T-007 | `PATCH /api/admin/operadores/reasignar` actualiza operador y traza | Implementación |
| T-008 | `PATCH /api/admin/operadores/reasignar` rechaza estados inválidos | Implementación |
| T-009 | `PATCH /api/admin/operadores/reasignar` rechaza operador destino inválido | Implementación |
| T-010 | Playwright: flujo completo de reasignación desde UI | Implementación |
| T-011 | Playwright: consulta y purga de logs desde UI | Implementación |

> En la fase actual (spec+plan), los tests se marcan como pendientes de implementación.

---

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria.
- [x] User scenarios cover primary flows.
- [x] Feature meets measurable outcomes defined in Success Criteria.
- [x] No implementation details leak into specification.

---

## Notes

- Se respeta el candado de no tocar `src/lib/ai/**`.
- Se respeta el candado de no agregar campos a `Reporte`/`Usuario`.
- Se respeta la decisión CEO de no purga automática.
- Migración aditiva (`CREATE TABLE WorkerLog` + índices + valores enum); cero `DROP`.
- El BRIEF usa el nombre `ReporteTimeline`; el esquema existente es `TransicionReporte`. Se usará la tabla existente sin crear una nueva.
