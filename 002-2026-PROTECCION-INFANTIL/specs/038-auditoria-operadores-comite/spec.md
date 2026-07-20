# Feature Specification: Auditoría de Operadores y Comité

**Feature Branch**: `feature/001-scaffolding`

**Spec directory**: `specs/038-auditoria-operadores-comite/`

**Created**: 2026-07-19

**Status**: CERRADA

**Input**: Crear submódulo de auditoría con vista y filtros de búsqueda sobre `AuditLog` para acciones `OPERADOR_*` y `COMITE_*`, integrado en `/dashboard/admin/operadores` y `/dashboard/admin/comite`.

---

## User Story

**Como** administrador de la plataforma  
**quiero** consultar el registro de auditoría de las acciones realizadas sobre operadores y comité de validación  
**para** trazar quién ejecutó cada acción, sobre qué recurso y cuándo, garantizando responsabilidad y trazabilidad.

---

## Acceptance Scenarios

### Scenario 1 — Auditoría de operadores (Priority: P1)

1. **Given** un usuario autenticado con rol `ADMIN`, **When** navega a `/dashboard/admin/operadores/auditoria`, **Then** el sistema muestra una tabla con las acciones `OPERADOR_*` registradas en `AuditLog`.
2. **Given** la tabla de auditoría de operadores, **When** el admin aplica filtros de tipo de acción, fecha, usuario o recursoId, **Then** la tabla se actualiza mostrando solo los registros que coinciden.
3. **Given** un registro de auditoría con `valorNuevo`, **When** el admin expande la fila, **Then** el sistema muestra el valor nuevo de forma legible.

### Scenario 2 — Auditoría del comité (Priority: P1)

1. **Given** un usuario autenticado con rol `ADMIN`, **When** navega a `/dashboard/admin/comite/auditoria`, **Then** el sistema muestra una tabla con las acciones `COMITE_*` registradas en `AuditLog`.
2. **Given** la tabla de auditoría del comité, **When** el admin aplica filtros, **Then** el sistema responde con los resultados paginados y ordenados por fecha descendente.

### Scenario 3 — Reutilización del endpoint (Priority: P1)

1. **Given** que existen acciones `OPERADOR_*` y `COMITE_*` en `AuditLog`, **When** el cliente consulta `/api/admin/audit-logs`, **Then** el endpoint retorna `accion`, `tipoRecurso`, `recursoId`, `usuario { nombre, email }`, `creadoEn` y `valorNuevo`.
2. **Given** el endpoint `/api/admin/audit-logs`, **When** se le envían filtros de acciones múltiples, usuario o recursoId, **Then** retorna solo los registros que coinciden, sin duplicar lógica de consulta.

---

## Edge Cases

- **Sin resultados**: la tabla muestra un mensaje neutro indicando que no hay registros para los filtros aplicados.
- **Usuario sin permisos**: un usuario no `ADMIN` que intente acceder al endpoint o a la página recibe un error `403`.
- **Filtro con texto parcial**: la búsqueda por usuario (`q`) coincide con `nombre` o `email` usando búsqueda parcial.
- **Paginación**: si hay más registros que el tamaño de página, se habilitan controles de anterior/siguiente.
- **Datos sensibles**: `valorNuevo` se muestra tal cual se almacenó; para este módulo los valores son metadatos de operador/comité y son visibles para `ADMIN`.

---

## Requirements

### Functional Requirements

- **FR-038-01**: El sistema DEBE exponer el endpoint `/api/admin/audit-logs` para usuarios con rol `ADMIN`.
- **FR-038-02**: El endpoint DEBE soportar filtros: acciones múltiples (`acciones`), fecha desde/hasta (`fechaDesde`, `fechaHasta`), búsqueda de usuario (`q`) y `recursoId`.
- **FR-038-03**: El endpoint DEBE retornar los campos: `accion`, `tipoRecurso`, `recursoId`, `usuario { nombre, email }`, `creadoEn`, `valorNuevo`.
- **FR-038-04**: El sistema DEBE proporcionar una vista de auditoría en `/dashboard/admin/operadores/auditoria` con las acciones `OPERADOR_*` preseleccionadas.
- **FR-038-05**: El sistema DEBE proporcionar una vista de auditoría en `/dashboard/admin/comite/auditoria` con las acciones `COMITE_*` preseleccionadas.
- **FR-038-06**: La vista DEBE permitir multiselección de tipos de acción, rango de fechas, búsqueda por usuario y filtro por `recursoId`.
- **FR-038-07**: La tabla DEBE mostrar paginación y permitir expandir el campo `valorNuevo`.
- **FR-038-08**: El sistema NO DEBE duplicar el endpoint de auditoría; ambas pestañas deben usar `/api/admin/audit-logs`.

### Key Entities

- **AuditLog**: registro inmutable. Campos relevantes: `accion`, `tipoRecurso`, `recursoId`, `usuarioId`, `valorNuevo`, `creadoEn`.
- **Usuario**: relación opcional con `AuditLog`. Campos expuestos: `nombre`, `email`.

---

## Success Criteria

- **SC-038-01**: Un `ADMIN` puede ver auditoría de operadores y comité en menos de 2 segundos bajo condiciones normales.
- **SC-038-02**: El 100% de las acciones `OPERADOR_*` y `COMITE_*` consultadas retornan los campos requeridos.
- **SC-038-03**: Los filtros de la UI se reflejan en la consulta al endpoint y actualizan la tabla.
- **SC-038-04**: `npm run test`, `npm run lint` y `npx tsc --noEmit` pasan sin errores.
- **SC-038-05**: `./scripts/dev-restart.sh` levanta la aplicación y el healthcheck responde correctamente.

---

## Assumptions

- El modelo `AuditLog` y la relación `Usuario` ya existen en el esquema de Prisma.
- Las acciones `OPERADOR_*` y `COMITE_*` ya están definidas en el enum `AccionAudit`.
- El endpoint `/api/admin/audit-logs` ya existe y se extiende de forma aditiva.
- No se requiere almacenar nuevo texto sensible; la vista muestra datos ya existentes en auditoría.

---

## Implementación

### Objetivo alcanzado

Se implementó el submódulo de auditoría para operadores y comité, reutilizando el endpoint `/api/admin/audit-logs` y agregándolo como pestaña en las secciones administrativas correspondientes.

### Decisiones de diseño

- **Extensión aditiva del endpoint**: se agregaron los query params `acciones` (lista separada por comas), `q` (búsqueda por nombre/email) y `recursoId`, manteniendo el parámetro legacy `accion` para compatibilidad.
- **Componente reutilizable**: `AuditLogViewer` centraliza la tabla, los filtros y la paginación; se parametriza con `defaultActions` para operadores (`OPERADOR_*`) y comité (`COMITE_*`).
- **Sin nuevas tablas ni migraciones**: se usa el modelo `AuditLog` existente.
- **UI nativa**: multiselect con checkboxes y SVG inline, sin agregar librerías de iconos.

### Endpoints y componentes afectados

- `src/app/api/admin/audit-logs/route.ts` — filtros extendidos.
- `src/components/modules/AuditLogViewer.tsx` — visor reutilizable.
- `src/app/dashboard/admin/operadores/auditoria/page.tsx` — vista de auditoría de operadores.
- `src/app/dashboard/admin/comite/auditoria/page.tsx` — vista de auditoría del comité.
- `src/app/dashboard/admin/operadores/components/OperadoresSubNav.tsx` — pestaña "Auditoría".
- `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx` — pestaña "Auditoría".
- `src/lib/audit-actions.ts` — constantes de acciones.
- `src/lib/validators.ts` — schema de validación extendido.
- `src/app/api/admin/audit-logs/route.test.ts` — tests de integración.

### Tests

- `src/app/api/admin/audit-logs/route.test.ts` (7 tests).
- Todo el suite: `npm run test` — 419 tests pasaron.

### Verificación

- `npx tsc --noEmit` — sin errores.
- `npm run lint` — 0 errores (1 warning preexistente en `src/app/dashboard/admin/comite/gestion/page.tsx`, no tocado).
- `./scripts/dev-restart.sh` — build limpio, healthcheck `ok`.
- Escenarios de `quickstart.md` verificados con curl.

### Deuda técnica

- Búsqueda de texto libre dentro de `valorNuevo`/`metadatos` queda fuera de alcance.
- `valorNuevo` se muestra en texto plano; si alguna acción futura almacena datos sensibles, se requerirá control de desenmascaramiento.
