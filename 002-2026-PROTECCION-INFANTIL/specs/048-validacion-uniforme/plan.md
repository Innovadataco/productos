# Implementation Plan: Validación uniforme (zod)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/048-validacion-uniforme/spec.md`

---

## Summary

Estandarizar la validación de entradas en las rutas de mutación admin que aún no usan zod. Se creará un módulo central `src/lib/schemas` con esquemas reutilizables y un helper `withValidation` en `src/lib/validation.ts`. El helper se aplicará a las rutas admin identificadas sin modificar su lógica de negocio. Se añadirán tests unitarios para los esquemas y el helper.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, zod 4.4.3 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Validación < 1 ms por request; sin impacto perceptible en throughput |
| **Constraints** | Sin cambios de lógica de negocio; sin migraciones destructivas; sin tocar SPEC-050/SPEC-060 |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | No se maneja multimedia en este spec |
| §1.3 Presunción de inocencia | ✅ Pass | No se alteran mensajes públicos ni consultas |
| §1.4 Umbral parametrizable en BD | ✅ Pass | Se valida el parámetro, no se modifica su semántica |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual) | ✅ Pass | zod ya es dependencia del proyecto |
| §2.2 Roles | ✅ Pass | Solo se añade validación de entrada a rutas admin existentes |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | Esquemas zod son tipados; `unknown` para body crudo |
| §3.4 Códigos HTTP correctos | ✅ Pass | `400` para validación, `403` para worker secret |
| §3.5 Logs y auditoría | ✅ Pass | No se eliminan ni modifican logs de auditoría |
| §3.6 Límites de tamaño | ✅ Pass | Esquemas heredan límites existentes (max 4000 chars, etc.) |
| §6.2 Validación explícita | ✅ Pass | zod es la validación explícita canónica del proyecto |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/048-validacion-uniforme/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (sin cambios de modelo)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── admin-mutation-validation.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/
│   ├── lib/
│   │   ├── schemas/           # Esquemas zod reutilizables
│   │   │   └── index.ts
│   │   ├── validation.ts      # Helper withValidation y ValidationError
│   │   ├── validation.test.ts
│   │   └── schemas/index.test.ts
│   └── app/api/
│       ├── admin/ia/evals/route.ts
│       ├── admin/ia/evals/casos/[id]/desactivar/route.ts
│       ├── admin/ia/experimentos/[id]/preparar-activacion/route.ts
│       ├── admin/ia/ollama/probar/route.ts
│       ├── admin/ia/sandbox/route.ts
│       ├── admin/operadores/[id]/reactivar/route.ts
│       ├── admin/operadores/[id]/reenviar-email/route.ts
│       ├── admin/operadores/[id]/regenerar-password/route.ts
│       ├── admin/apelaciones/vencer/route.ts
│       └── config/parametros/[clave]/route.ts
```

**Structure Decision**: Esquemas centralizados por dominio en `src/lib/schemas`, helper genérico en `src/lib/validation.ts`. Se aplica in-place en cada route handler sin reestructurar endpoints.

---

## Complexity Tracking

No constitution violations. No complexity justification needed. El spec es un saneamiento horizontal de validación sin agregar funcionalidad de negocio.
