# Feature Specification: SPEC-190 — Deploy ejecuta seed idempotente (002-PI-085)

**Feature Branch**: `work/002-pi-085`

**Created**: 2026-08-20

**Status**: PLANEADO

**Input**: 002-PI-085. `scripts/deploy-prod.sh` no ejecuta `prisma/seed.ts`. Consecuencia (I-67): los 13 parámetros del vigilante sembrados por SPEC-171 nunca llegaron a producción hasta intervención manual. Cualquier SPEC futura con parámetros o catálogos queda huérfana igual. Fix estructural de proceso.

Objetivo: hacer que el deploy de producción ejecute el seed de forma idempotente, respetando los valores custom que el CEO haya ajustado manualmente, y auditar `prisma/seed.ts` para garantizar que ninguna sección pisa esos valores sin justificación documentada.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Seed en el deploy (Priority: P1)

Como responsable de operaciones quiero que el deploy corra el seed idempotente automáticamente, para que los parámetros y catálogos nuevos lleguen a producción sin intervención manual.

**Why this priority**: evita huérfanos de configuración y cierra I-67.

**Independent Test**: ejecutar el deploy en un entorno limpio y verificar que el seed corre después de las migraciones y antes del sync de módulos.

**Acceptance Scenarios**:

1. **Given** un deploy limpio, **When** termina `prisma migrate deploy`, **Then** se ejecuta `node --import tsx prisma/seed.ts` dentro del contenedor `app`.
2. **Given** un parámetro faltante en `ParametroSistema`, **When** corre el deploy, **Then** el parámetro se crea con su valor por defecto.
3. **Given** un parámetro existente con valor custom del CEO, **When** corre el deploy, **Then** el valor custom se conserva.

### User Story 2 — Idempotencia real del seed (Priority: P1)

Como CEO quiero poder ajustar parámetros en producción sin que el próximo deploy me los pise.

**Why this priority**: SPEC-187/I-69 demostró que un seed pisador puede reactivar servicios que el operador decidió apagar.

**Independent Test**: correr el seed dos veces; entre medias cambiar manualmente un parámetro; verificar que el segundo seed respeta el cambio.

**Acceptance Scenarios**:

1. **Given** `monitoreo.enabled=false` ajustado manualmente, **When** se corre el seed, **Then** el valor sigue siendo `false`.
2. **Given** `monitoreo.ollama.smoke.modelo=llama-guard3:8b` ajustado manualmente, **When** se corre el seed, **Then** el valor sigue siendo `llama-guard3:8b`.
3. **Given** un parámetro nuevo que no existía, **When** se corre el seed, **Then** se crea con el default de la SPEC correspondiente.

### User Story 3 — Auditabilidad del seed (Priority: P2)

Como auditor quiero ver en los logs del deploy qué sembró y qué no.

**Why this priority**: facilita diagnóstico cuando algo no aparece o cuando un valor custom se conserva.

**Independent Test**: ejecutar el seed y verificar que imprime resúmenes por sección (params, plataformas, geografía, etc.).

**Acceptance Scenarios**:

1. **Given** el seed corriendo, **When** finaliza una sección, **Then** imprime una línea de resumen identificable.
2. **Given** un valor custom conservado, **Then** no se loguea como modificación (el seed respeta sin ruido).

## Edge Cases

- **Seed falla por dependencia de migración**: el seed corre DESPUÉS de `prisma migrate deploy`; si una migración rompe el schema, el seed no debe intentar correr.
- **Seed lento**: el contenedor `app` tiene `tsx`; el seed está optimizado para ser no-op cuando todo existe.
- **Parámetro nuevo que cambia de default en una SPEC posterior**: se documenta como excepción con `update: { valor, descripcion }` y comentario justificativo.
- **CEO quiere forzar un reset de un parámetro**: eso es una tarea manual o un script aparte, no responsabilidad del seed automático.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `scripts/deploy-prod.sh` DEBE ejecutar `node --import tsx prisma/seed.ts` en el contenedor `app` después de `prisma migrate deploy` y antes de `scripts/sync-modulos-grants.ts`.
- **FR-002**: El seed DEBE ser idempotente: correrlo múltiples veces no debe cambiar valores custom del CEO.
- **FR-003**: Toda sección de `prisma/seed.ts` que use `update: { valor, ... }` DEBE tener un comentario justificativo que explique por qué es semánticamente necesario pisar el valor.
- **FR-004**: Las secciones de parámetros "viejos" (ya existen en prod con posibles ajustes del CEO) DEBEN usar `update: {}` (ON CONFLICT DO NOTHING).
- **FR-005**: Las secciones de parámetros nuevos o cuyo default cambió por decisión de diseño de una SPEC DEBEN usar `update: { valor, descripcion }` y documentar la excepción.
- **FR-006**: El log del seed DEBE identificar qué sección terminó y, a alto nivel, qué se creó vs. qué ya existía.
- **FR-007**: No se DEBE cambiar código de app; solo `scripts/deploy-prod.sh` y comentarios/ajustes menores de `prisma/seed.ts`.
- **FR-008**: No se DEBE tocar `src/lib/ai/**`.

### Key Entities

- `ParametroSistema`: tabla de parámetros clave-valor.
- `Pais`, `Departamento`, `Ciudad`: catálogos geográficos.
- `Plataforma`: catálogo de plataformas para reportes.

## Success Criteria *(mandatory)*

- **SC-001**: `scripts/deploy-prod.sh` incluye y ejecuta el seed idempotente.
- **SC-002**: Simular dos deploys seguidos no pisa valores custom del CEO.
- **SC-003**: Un parámetro faltante se crea al correr el seed.
- **SC-004**: `prisma/seed.ts` tiene comentarios justificativos en toda sección con `update: { ... }`.
- **SC-005**: Gate local completo verde (tsc, lint --no-cache, arch:check, tests, build).

## Assumptions

- El contenedor `app` tiene `tsx` instalado (ya se usa en deploy para `sync-modulos-grants.ts`).
- `prisma/seed.ts` ya tiene el fix I-72 (`isMainModule()`) que permite importarlo en tests sin ejecutar `main()`.
- El CEO tiene acceso manual a la BD para forzar resets puntuales si los necesita.

## Decisiones de compuerta §4 (propuestas)

1. **Orden en deploy**: migraciones → seed → sync módulos/grants → geo-import. El seed sembrará params/catálogos; el sync de módulos se mantiene como paso separado por su naturaleza de grants.
2. **Excepciones permitidas**: solo los parámetros nuevos o cuyo default cambió por decisión explícita de una SPEC pueden pisar el valor. Todo lo demás usa `update: {}`.
3. **Geografía**: el seed actual actualiza `lat/lng/nombreNormalizado` de ciudades existentes. Se mantiene ese comportamiento porque es backfill de datos canónicos, no valor custom del CEO; se documenta con comentario.

## Implementación *(post-aprobación)*

- `scripts/deploy-prod.sh`: añadir llamada al seed entre migraciones y sync de módulos.
- `prisma/seed.ts`: auditar secciones, añadir comentarios justificativos donde `update` no esté vacío, asegurar logs identificables por sección.
- `specs/190-deploy-seed-idempotente/cierre.md`: documentar simulación de deploy doble y evidencia de valores custom conservados.
