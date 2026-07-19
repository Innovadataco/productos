# Implementation Plan: Auditoría de Operadores y Comité

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/038-auditoria-operadores-comite/spec.md`

---

## Summary

Extender el endpoint `/api/admin/audit-logs` con filtros multiselect, búsqueda de usuario y `recursoId`; crear un componente `AuditLogViewer` reutilizable; integrarlo como pestaña "Auditoría" en `/dashboard/admin/operadores` y `/dashboard/admin/comite`. No se crean nuevas tablas ni se modifica la lógica central de los specs 035–037.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Dependencies** | Next.js 16.2.10, Prisma 5.22.0, Zod, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ (existente) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Project Type** | Web application (full-stack Next.js) |
| **Constraints** | Sin migraciones destructivas; reutilizar endpoint existente |

---

## Project Structure

### Documentation (this feature)

```text
specs/038-auditoria-operadores-comite/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── audit-actions.ts       # Constantes de acciones OPERADOR_* / COMITE_*
│   └── validators.ts          # Esquema auditLogsQuerySchema extendido
├── app/
│   ├── api/
│   │   └── admin/
│   │       └── audit-logs/
│   │           ├── route.ts          # GET extendido
│   │           └── route.test.ts     # Tests de integración
│   └── dashboard/
│       └── admin/
│           ├── operadores/
│           │   └── auditoria/
│           │       └── page.tsx      # Vista auditoría operadores
│           │   └── components/
│           │       └── OperadoresSubNav.tsx  # + pestaña Auditoría
│           └── comite/
│               └── auditoria/
│                   └── page.tsx      # Vista auditoría comité
│               └── components/
│                   └── ComiteSubNav.tsx      # + pestaña Auditoría
└── components/
    └── modules/
        └── AuditLogViewer.tsx       # Componente reutilizable
```

---

## Implementation Strategy

1. **Phase 0**: Crear spec-kit y constantes de acciones.
2. **Phase 1**: Extender validación y endpoint `/api/admin/audit-logs`.
3. **Phase 2**: Crear `AuditLogViewer` con filtros, tabla y paginación.
4. **Phase 3**: Integrar en páginas de operadores y comité y actualizar subnavegación.
5. **Phase 4**: Tests de integración para el endpoint.
6. **Phase 5**: Verificación, documentación de cierre, commits y deploy.

---

## Complexity Tracking

No se introducen nuevas dependencias ni modelos de datos. La complejidad principal es la UI de filtros multiselect, implementada con controles nativos para evitar agregar librerías de iconos.
