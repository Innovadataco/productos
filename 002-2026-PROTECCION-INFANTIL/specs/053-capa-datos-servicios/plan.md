# Implementation Plan: Capa de datos / servicios (DAL)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-capa-datos-servicios/spec.md`

---

## Summary

Entregar una capa de datos (DAL) incremental sobre Prisma que aísle al ORM de las rutas API. Se comienza por el módulo Reporte (mayor superficie y complejidad de negocio), se continúa con Consulta pública y se establece un patrón replicable para Configuración, Autenticación, Apelaciones, Alertas, Círculo de confianza, Operadores, IA y Estadísticas. No se implementan cambios de esquema ni se tocan SPEC-050 ni SPEC-060.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, PostgreSQL 16+ |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Sin impacto negativo en tiempos de respuesta; solo reorganización de código |
| **Constraints** | Sin nuevas dependencias; sin cambios destructivos en esquema; sin tocar SPEC-050/060 |
| **Scale/Scope** | Refactor estructural; módulo Reporte, Consulta pública y patrón replicable para el resto |

---

## Constitution Check

*GATE: Must pass before planning Phase 0. Re-check after design of Phase 1 (Reporte).*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | El DAL no introduce capacidades multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No modifica el lenguaje de consultas ni de reportes |
| §1.4 Umbral parametrizable en BD | ✅ Pass | Los repositorios consultan `ParametroSistema` a través de la abstracción existente |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual, no NextAuth) | ✅ Pass | Se mantiene Prisma; solo se agrega una capa de abstracción |
| §2.2 Roles (ADMIN, SCHOOL_ADMIN, PARENT, Anónimo) | ✅ Pass | Los repositorios no alteran lógica de roles; la autorización permanece en rutas y `verifyAuth` |
| §2.3 Multi-tenant | ✅ Pass | Los repositorios respetan `tenantId` como parte de los DTOs; no se elimina aislamiento |
| §2.4 Modelo SaaS | ✅ Pass | No se alteran tablas de Plan/Subscription/BillingCycle |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | DTOs y repositorios se tipan con interfaces y tipos de Prisma, sin `any` |
| §3.4 Códigos HTTP correctos | ✅ Pass | Los códigos HTTP permanecen en las rutas; el DAL devuelve resultados o errores de dominio |
| §3.5 Logs y auditoría | ✅ Pass | `AuditLog` sigue escribiéndose a través de `src/lib/audit.ts` |
| §3.6 Límites de tamaño | ✅ Pass | La validación de input se mantiene en las rutas; no se delega al DAL |
| §4.1 Singletons (Prisma, pg-boss) | ✅ Pass | PrismaClient sigue siendo singleton en `src/lib/prisma.ts`; repositorios lo reciben o inyectan `tx` |
| §4.2 Rutas API individuales | ✅ Pass | Cada endpoint conserva su `route.ts`; no se fusionan archivos |
| §4.3 Paginación estándar | ✅ Pass | Los repositorios de listado devuelven `{ items, pagination }` siguiendo el patrón existente |
| §5.1 Testing | ✅ Pass | Los tests existentes se mantienen; se agregan tests de repositorio donde aporten valor |
| §6.1 JWT en cookie httpOnly | ✅ Pass | Sin cambios en autenticación en esta fase |
| §6.2 Validación de inputs | ✅ Pass | Validación sigue en rutas; servicios validan reglas de dominio |
| §6.3 Datos sensibles encriptados | ✅ Pass | Cifrado de texto de reporte y parámetros secretos permanece en su lugar |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/053-capa-datos-servicios/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Plan-only tasks
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/
│   ├── app/
│   │   └── api/              # Rutas permanecen, pero sin acceso directo a prisma
│   ├── lib/
│   │   ├── dal/              # Nueva capa de datos
│   │   │   ├── types/        # DTOs e interfaces de dominio
│   │   │   ├── repositories/ # Repositorios por agregado
│   │   │   ├── services/     # Servicios de flujo / casos de uso
│   │   │   └── unit-of-work.ts   # Helper para compartir tx
│   │   ├── prisma.ts         # Singleton PrismaClient (sin cambios)
│   │   ├── audit.ts          # Servicio de auditoría (sin cambios)
│   │   ├── parametros.ts     # Servicio de parámetros (sin cambios)
│   │   ├── reporte-lifecycle.ts  # Se migra/re-exporta desde DAL
│   │   ├── reporte-transiciones.ts
│   │   ├── scoring.ts
│   │   ├── visibility.ts
│   │   └── ...
│   └── ...
├── prisma/
│   └── schema.prisma         # Sin cambios destructivos
└── ...
```

**Structure Decision**: Se crea un directorio dedicado `src/lib/dal` para mantener visible la nueva capa, evitar dispersión y facilitar la revisión de dependencias. Los servicios de dominio existentes en `src/lib/` se migran o re-exportan progresivamente.

---

## Design Decisions

### D1: Patrón Repository + Service + DTO

**Decision**: Cada agregado tiene un repositorio con operaciones CRUD tipadas; los flujos de negocio (creación, procesamiento, ciclo de vida) se encapsulan en servicios que orquestan repositorios. Las rutas reciben y devuelven DTOs de dominio.

**Rationale**: Reduce el acoplamiento a Prisma en las rutas, facilita los tests y mantiene la lógica de negocio centralizada. Los repositorios siguen siendo delgados (no reimplementan ORM).

### D2: Inyección de cliente transaccional

**Decision**: Cada repositorio y servicio acepta un cliente transaccional opcional (`tx?: Prisma.TransactionClient`). Si no se provee, se usa `prisma`.

**Rationale**: Preserva la atomicidad de operaciones que hoy usan `prisma.$transaction`. Evita anidar transacciones innecesarias y permite Unit of Work explícita.

### D3: Raw queries en adaptadores dedicados

**Decision**: Las consultas `pgvector`, `pg-boss` y rate-limit permanecen en repositorios/infraestructura especializados (`EmbeddingRepository`, `QueueRepository`, `RateLimitRepository`), no en rutas ni en servicios de dominio genéricos.

**Rationale**: Esos accesos dependen de extensiones de PostgreSQL y no se pueden abstraer con un ORM estándar. Encapsularlos evita que el conocimiento del schema raw se disperse.

### D4: Migración incremental por módulo

**Decision**: Se comienza por Reporte, se sigue con Consulta pública y se extiende el patrón a los demás módulos. No se hace un big-bang.

**Rationale**: Reporte concentra el mayor impacto y ya tiene servicios parciales; su migración primero permite validar el patrón antes de escalarlo.

### D5: Sin cambios de esquema

**Decision**: El Spec 053 no introduce modificaciones al schema de Prisma. Solo se reorganiza el código de acceso a datos.

**Rationale**: Mantener el refactor puro reduce el riesgo de pérdida de datos y evita migraciones adicionales.

---

## Complexity Tracking

No constitution violations. No complexity justification needed.
