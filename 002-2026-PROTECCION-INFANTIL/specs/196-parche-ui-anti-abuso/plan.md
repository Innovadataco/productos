# Plan SPEC-196 — Parche UI Anti-abuso

## Resumen

Parche de 4 fixes (I-83..I-86) sobre el módulo anti-abuso. Sin cambios de arquitectura. Un único commit de implementación al final.

## Fases

### Fase 1 — Especificación y diseño
- [x] T001: Redactar `spec.md` con US/AS/FR/NFR.
- [x] T002: Redactar `plan.md` con fases y tasks.
- [ ] T003: Validar spec+plan con ZEUS (compuerta §4).

### Fase 2 — Preparación
- [ ] T004: Crear rama `work/002-pi-090` desde `feature/001-scaffolding` actualizado.
- [ ] T005: Extender enum `AccionAudit` en `prisma/schema.prisma` y generar migración aditiva.

### Fase 3 — Fixes UI simulador (I-83, I-84, I-85)
- [ ] T006: F1 — limpiar nota al cambiar escenario en `AdminAntiAbusoSimulador.tsx`.
- [ ] T007: F2 — agregar columna ID con copiar en `AdminAntiAbusoSimuladorHistorial.tsx`.
- [ ] T008: F3 — corregir priorización array identificadores en `AdminAntiAbusoSimulador.tsx:iniciar()`.
- [ ] T009: Tests de integración para F1, F2 y F3.

### Fase 4 — Fixes operativos (I-86)
- [ ] T010: F4a — cambiar schema y endpoint `/api/admin/anti-abuso/bloquear` para aceptar IP en claro y hashear en backend.
- [ ] T011: Actualizar `AdminAntiAbusoOperativo.tsx` para enviar `ip` en lugar de `ipHash`.
- [ ] T012: F4b — extender schema `/api/admin/anti-abuso/desbloquear` con `motivo`.
- [ ] T013: Actualizar `AdminAntiAbusoOperativo.tsx:BotonDesbloquear` con modal de motivo.
- [ ] T014: Registrar `AuditLog` con `IP_DESBLOQUEADA_MANUAL` en `block-list.ts`.
- [ ] T015: Tests de integración para F4a y F4b.

### Fase 5 — Cierre
- [ ] T016: Gate local completo: typecheck, lint --no-cache, test, arch:check, build.
- [ ] T017: Actualizar `specs/README.md` con SPEC-196.
- [ ] T018: Commit único + push a `origin/work/002-pi-090`.
- [ ] T019: Abrir PR a `feature/001-scaffolding` y esperar CI verde.
- [ ] T020: Redactar `cierre.md` con evidencia.

## Decisiones de diseño

| Tema | Decisión | Razón |
|---|---|---|
| Hash de IP | Backend | Fuente única de verdad; evita discrepancias cliente/servidor |
| Validación IP | Zod + regex simple IPv4/IPv6 | No agregar dependencias nuevas |
| Acción de auditoría | Nuevo valor `IP_DESBLOQUEADA_MANUAL` | Distingue desbloqueo manual con motivo del automático |
| Commit | Único al final | Régimen D-54 |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Cambio de schema de enum rompe test data | Migración aditiva `ALTER TYPE ... ADD VALUE`; seed idempotente |
| Regresión en simulador | Tests de integración cubren array de identificadores y nota |
