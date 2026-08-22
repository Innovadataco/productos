# Checklist de requisitos — SPEC-205

## Funcionales

- [ ] FR-001: 5 tarjetas KPI en `/dashboard/admin/usuarios` (Padres, Rectores, Operadores, Comité, Admins).
- [ ] FR-002: KPI y total de sub-tab provienen del mismo query agregado.
- [ ] FR-003: 6 sub-tabs (Padres, Rectores, Operadores, Comité de convivencia, Comité de validación, Admins); KPI Comité agrega ambos.
- [ ] FR-004: Tabla Padres con columnas correctas.
- [ ] FR-005: Tabla Rectores con columnas correctas.
- [ ] FR-006: Tabla Operadores con columnas correctas y conteos idénticos a `/operadores/asignar`.
- [ ] FR-007: Tabla Comité de convivencia con columnas correctas.
- [ ] FR-008: Tabla Comité de validación con columnas correctas.
- [ ] FR-009: Tabla Admins con columnas correctas.
- [ ] FR-010: Detalle específico por rol con acciones útiles.
- [ ] FR-011: Listado de operadores reutiliza `OperadorService.panelAsignacion()`.
- [ ] FR-012: Endpoints validan `ADMIN` + `usuarios_admin`.
- [ ] FR-013: Paginación y rate-limit en listados.
- [ ] FR-014: Terminología en criollo en UI.
- [ ] FR-015: Campos vacíos muestran "—" o motivo explícito.
- [ ] FR-016: No tocar motor, rate-limit ni migraciones existentes.

## No funcionales

- [ ] NFR-001: Dashboard carga < 1 s; detalle operador < 500 ms.
- [ ] NFR-002: Cero PII de reportes en agregados.
- [ ] NFR-003: Tests cubren conteos, KPI, detalle por rol, filtros.
- [ ] NFR-004: Gate local completo verde.

## Criterios de éxito

- [ ] SC-001: `/dashboard/admin/usuarios` carga KPI + sub-tab.
- [ ] SC-002: Totales KPI coinciden con sub-tabs.
- [ ] SC-003: Cero divergencia operadores.
- [ ] SC-004: Detalle por rol renderiza con acciones.
- [ ] SC-005: Gate local completo verde.
- [ ] SC-006: CI 6/6 verde.

## Revisión de seguridad

- [ ] No se expone texto de reporte.
- [ ] No se expone identificador de menor.
- [ ] No se expone denunciante en agregados.
- [ ] Solo ADMIN con módulo `usuarios_admin` accede.
