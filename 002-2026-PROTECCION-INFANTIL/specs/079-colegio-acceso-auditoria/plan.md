# Plan — Spec 079: Colegio acceso y auditoría

## Constitution Check

- **IA local sin terceros**: Sí, no se agregan servicios externos.
- **Lenguaje sin veredictos**: Sí, los mensajes de UI son neutrales y descriptivos.
- **Migraciones aditivas y no destructivas**: Sí, Parte 1 es fix de código; Partes 2 y 3 requieren `colegioId` nullable en `AuditLog` si se opta por esa estrategia.
- **Un solo worker**: Sí, no se toca el worker.
- **Cobertura Vitest**: Sí, cada endpoint nuevo tiene su `.test.ts`.

Verificación post-diseño: el plan no agrega lógica de clasificación ni modifica el modelo `Reporte`. El acceso a `AuditLog` es de solo lectura (con posible escritura de `colegioId`).

## Technical Context

### Componentes reutilizados

- `src/lib/colegio/vigencia.ts`: fix directo en `verificarVigenciaColegio`.
- `src/app/api/admin/operadores/[id]/regenerar-password/route.ts` y `.../reenviar-email/route.ts`: patrón para Parte 2.
- `src/app/dashboard/admin/operadores/auditoria/page.tsx` y `src/app/dashboard/admin/comite/auditoria/page.tsx`: patrón de vista para Parte 3.
- `src/components/modules/AuditLogViewer.tsx`: componente reutilizable para Parte 3.
- `src/lib/audit-actions.ts`: agregar `COLEGIO_AUDIT_ACTIONS` para Parte 3.
- `src/app/api/admin/audit-logs/route.ts`: endpoint base; para Parte 3 se necesita un nuevo endpoint `/api/colegio/auditoria` con filtro por colegio.

### Modelo de datos actual

- `Usuario.colegioId` nullable, único, FK a `Colegio`.
- `Colegio` tiene `estado`, `inicioServicio`, `finServicio`.
- `AuditLog` tiene `usuarioId`, `recursoId`, `accion`, pero **no tiene `colegioId`**.

## Complexity Tracking

| Item | Complejidad | Riesgo | Notas |
|---|---|---|---|
| Fix de vigencia | Baja | Ninguno | Comparación de fechas a medianoche. |
| Restablecer contraseña | Media | Bajo | Reutiliza patrón de operadores. Riesgo: exponer temporal más de una vez. |
| Reenviar email | Media | Bajo | Reutiliza email de operadores. |
| Auditoría del colegio | Alta | Medio | Decisión de aislamiento de `AuditLog`. |

## Decisiones técnicas pendientes

### [NEEDS CLARIFICATION] Aislamiento de auditoría del colegio

Hay dos opciones válidas para garantizar que un SCHOOL_ADMIN vea solo auditoría de su colegio:

**Opción A — Filtrar por `usuarioId` del SCHOOL_ADMIN** (sin cambio de schema)
- Cada acción `COLEGIO_*` se registra con `usuarioId` del SCHOOL_ADMIN (en operaciones que él hace) o con `usuarioId` del admin (en operaciones que el admin hace sobre el colegio).
- Problema: acciones que realiza el admin en nombre del colegio aparecerían con `usuarioId` del admin, no del colegio.
- Requeriría un campo adicional en `metadatos` para guardar `colegioId` y filtrar por él, pero es frágil.

**Opción B — Agregar `colegioId` nullable a `AuditLog`** (migración aditiva)
- Se agrega `colegioId String?` a `AuditLog` con relación a `Colegio` (onDelete: SetNull).
- Todas las acciones `COLEGIO_*` se registran con `colegioId` del colegio afectado.
- El endpoint `/api/colegio/auditoria` filtra por `colegioId` del usuario autenticado.
- Ventaja: aislamiento estricto y explícito. Desventaja: migración aditiva mínima.

**Recomendación**: Opción B. Es explícita, verificable y no depende de quién ejecutó la acción. Marcar como `[NEEDS CLARIFICATION]` para aprobación humana.

## Tareas de implementación (resumen)

### Parte 1 (fix)
- T001: Corregir `verificarVigenciaColegio` en `src/lib/colegio/vigencia.ts`.
- T002: Tests unitarios en `src/lib/colegio/vigencia.test.ts`.

### Parte 2 (gestión de acceso)
- T003: Endpoint `POST /api/admin/colegios/[id]/regenerar-password`.
- T004: Endpoint `POST /api/admin/colegios/[id]/reenviar-email`.
- T005: UI de contraseña temporal en creación/restablecimiento de colegio.
- T006: Tests de endpoints y UI.

### Parte 3 (auditoría)
- T007: Migración aditiva `AuditLog.colegioId` (Opción B).
- T008: Poblar `colegioId` en acciones `COLEGIO_*` existentes.
- T009: Endpoint `GET /api/colegio/auditoria` con filtro y paginación.
- T010: Vista `/dashboard/colegio/auditoria` con `AuditLogViewer`.
- T011: Tests de aislamiento entre colegios.

## Definition of Done (para cierre del spec)

- Spec-Kit completo.
- Commit por User Story + uno de docs.
- Deploy limpio `./scripts/dev-restart.sh`.
- `tsc --noEmit`, `lint`, `vitest run`, `build` OK.
- Quickstart probado.
- Sección Implementation en spec.md + cierre.md + deuda técnica.
- Status `CERRADA`.
