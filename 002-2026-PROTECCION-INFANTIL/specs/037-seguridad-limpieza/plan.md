# Implementation Plan: Fixes de seguridad y limpieza

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/037-seguridad-limpieza/spec.md`

---

## Summary

Aplicar hardening aditivo a endpoints administrativos que aún no usan el limitador existente y sanitizar el mensaje de error que se persiste en las transiciones de fallback del worker de procesamiento de reportes.

No se crean nuevos endpoints, no se modifican migraciones ni seed, y no se altera la lógica central de negocio de specs 035/036.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Sin regresión de latencia en endpoints admin |
| **Constraints** | Cambios aditivos; no destructive; no alterar seed/middleware/worker |
| **Scale/Scope** | ~8 archivos de rutas admin + 1 worker |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | No se añade multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública |
| §2.1 Stack heredado | ✅ Pass | Reutiliza `checkRateLimit` existente |
| §3.4 Códigos HTTP correctos | ✅ Pass | `429` con headers al exceder límite |
| §3.5 Logs y auditoría | ✅ Pass | Se sanitiza traza de auditoría |
| §4.1 Singletons | ✅ Pass | Sin cambios en Prisma/logger |
| §6.4 Rate limiting | ✅ Pass | Se cierra brecha en endpoints admin |

**Re-check post-design**: No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/037-seguridad-limpieza/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (sin cambios)
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output
```

### Source Code (affected files)

```text
src/app/api/admin/
├── operadores/route.ts
├── operadores/[id]/route.ts
├── operadores/[id]/regenerar-password/route.ts
├── operadores/[id]/reenviar-email/route.ts
├── operadores/[id]/reactivar/route.ts
├── comite/integrantes/route.ts
├── comite/integrantes/[id]/route.ts
└── reportes-revision/[id]/reasignar/route.ts
src/app/api/reportes/procesar/route.ts
```

---

## Complexity Tracking

No constitution violations. No complexity justification needed.
