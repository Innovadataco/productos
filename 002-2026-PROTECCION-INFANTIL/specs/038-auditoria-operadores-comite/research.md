# Research: Auditoría de Operadores y Comité

**Date**: 2026-07-19
**Feature**: specs/038-auditoria-operadores-comite/spec.md

---

## Guardrail Verification: `/api/admin/audit-logs`

Se verificó el archivo `src/app/api/admin/audit-logs/route.ts`.

- **Campos requeridos**: El endpoint incluye en la respuesta `accion`, `tipoRecurso`, `recursoId`, `usuario { nombre, email }`, `creadoEn` y `valorNuevo` mediante:

```typescript
include: { usuario: { select: { nombre: true, email: true } } }
```

- **Acciones `OPERADOR_*` y `COMITE_*`**: El enum `AccionAudit` en `prisma/schema.prisma` define valores como `OPERADOR_CREADO`, `OPERADOR_ACTIVADO`, `OPERADOR_DESACTIVADO`, `OPERADOR_ASIGNADO`, `OPERADOR_REASIGNADO`, `OPERADOR_PASSWORD_REGENERADA`, `OPERADOR_EMAIL_REENVIADO`, `COMITE_CREADO`, `COMITE_ACTIVADO`, `COMITE_DESACTIVADO`, `COMITE_PASSWORD_REGENERADA`, `COMITE_EMAIL_REENVIADO`, `COMITE_INTEGRANTE_CREADO`, `COMITE_INTEGRANTE_ACTUALIZADO`, `COMITE_INTEGRANTE_INACTIVADO`. Estos valores se almacenan en `AuditLog.accion` y son retornados por el endpoint.

- **Conclusión del guardrail**: El endpoint **sí** cumple con los campos requeridos para las acciones de operadores y comité.

## Gaps Identified

1. **Filtro por acciones múltiples**: El esquema actual (`auditLogsQuerySchema`) solo permite una acción (`accion`). El spec requiere multiselect de `OPERADOR_*` / `COMITE_*`.
2. **Búsqueda por usuario**: No existe parámetro `q` para buscar por `nombre` o `email` del usuario.
3. **Filtro por `recursoId`**: No existe parámetro `recursoId` en la consulta.

## Decisions

### D1: Extender el endpoint existente aditivamente

**Decision**: Añadir parámetros `acciones` (lista separada por comas), `q` y `recursoId` al esquema de validación y al handler de `/api/admin/audit-logs`, manteniendo el parámetro legacy `accion`.

**Rationale**: Cumple con el requisito de no duplicar endpoints y de realizar cambios aditivos.

### D2: UI de multiselect nativo

**Decision**: Implementar el multiselect de acciones con checkboxes agrupadas por prefijo, sin agregar librerías de iconos.

**Rationale**: El proyecto no tiene `@heroicons/react` ni `lucide-react` en `package.json`. El design system prohíbe emojis y recomienda SVG inline. Los checkboxes nativos cumplen la función y mantienen el bundle sin cambios.

### D3: Sin migraciones ni nuevas tablas

**Decision**: No crear migraciones ni modelos nuevos. `AuditLog` ya contiene todos los campos necesarios.

**Rationale**: Cumple con la regla de migraciones aditivas y no destructivas, y evita riesgo sobre datos existentes.

## Open Questions / Debt

- **Deuda técnica 1**: Si en el futuro se requiere búsqueda de texto libre dentro de `valorNuevo` o `metadatos`, será necesario evaluar un índice de texto completo en PostgreSQL. Esto está fuera del alcance de este spec.
- **Deuda técnica 2**: El campo `valorNuevo` se muestra como texto plano/JSON. Si alguna acción futura almacena datos sensibles, se deberá implementar un permiso de desenmascaramiento por campo.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Crear endpoints separados `/api/admin/operadores/auditoria` y `/api/admin/comite/auditoria` | Viola el requisito de reutilizar `/api/admin/audit-logs` |
| Agregar `@heroicons/react` o `lucide-react` | Agrega dependencia sin necesidad; el proyecto usa SVG inline |
| Modificar el esquema `AuditLog` para añadir un campo `modulo` | Cambio destructivo innecesario; el prefijo de la acción ya indica el módulo |
