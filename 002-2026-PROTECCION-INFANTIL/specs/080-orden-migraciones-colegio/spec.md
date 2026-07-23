# Spec 080 — Corrección del orden de migraciones (incidencia I-04)

**Status**: `CERRADA` (ACTA-VALIDACION aprobada por ZEUS 2026-07-23)
**Rama**: `feature/001-scaffolding`
**Fase del programa**: Saneamiento / Infraestructura de datos
**Creado**: 2026-07-22
**Incidencia**: I-04

**Input**: "Corregir la cadena de migraciones para que aplique limpia desde cero. `add_colegio` referencia `Departamento` antes de que `add_departamento` la cree. El esquema final NO cambia; solo se corrige el orden."

## Contexto

En una base de datos nueva, `npx prisma migrate deploy` falla con **P3018**:

- La migración `20260720214140_add_colegio` crea la FK `Colegio.departamentoId → Departamento.id` (`prisma/migrations/20260720214140_add_colegio/migration.sql:49`).
- La tabla `Departamento` la crea `20260721001700_add_departamento`, que Prisma ejecuta **después** por orden lexicográfico de nombre de carpeta.

El orden de dependencia está roto y bloquea el arranque desde cero (bootstrap de entornos nuevos, CI, `prisma migrate reset` en desarrollo).

Verificación previa (2026-07-22, ODIN):

- `Pais` y `Ciudad` se crean en `20260714105800_add_pais_ciudad`, **anterior** a `add_colegio`. ✓
- `add_departamento` solo depende de `Pais` y `Ciudad` (crea `Departamento`, añade `Ciudad.departamentoId` con sus índices y FKs). **No referencia `Colegio` ni ninguna tabla creada por migraciones intermedias**, por lo que puede adelantarse sin más cambios.
- El esquema final resultante es idéntico: mismas tablas, columnas, índices y constraints.

## User Scenarios & Testing

### User Story 1 — Bootstrap de una BD nueva (Priority: P1)

**Como** desarrollador o agente de la fábrica que levanta el proyecto desde cero,
**quiero** que `prisma migrate deploy` aplique toda la cadena de migraciones sin errores sobre una base de datos vacía,
**para** poder inicializar entornos nuevos (desarrollo, CI, pre-producción) sin intervención manual.

**Why this priority**: es el bloqueo reportado en I-04; sin esto no hay arranque desde cero.

**Independent Test**: con el contenedor PostgreSQL limpio (`docker-compose up -d db` + volumen/BD vacía), `npx prisma migrate deploy` termina en estado `Database schema is up to date!` sin P3018, y `npx prisma migrate status` no reporta migraciones pendientes ni fallidas.

**Acceptance Scenarios**:

1. **Given** una BD PostgreSQL vacía, **When** se ejecuta `npx prisma migrate deploy`, **Then** todas las migraciones aplican en orden y la tabla `Departamento` existe antes de que `add_colegio` cree la FK `Colegio_departamentoId_fkey`.
2. **Given** la cadena migrada, **When** se inspecciona el esquema resultante, **Then** contiene exactamente las mismas tablas, columnas, índices, FKs y enums que el esquema actual (sin cambios funcionales).
3. **Given** la BD migrada, **When** se ejecuta `npx prisma db seed`, **Then** el seed completa sin errores (incluida la carga de países/departamentos/ciudades si aplica).

---

### User Story 2 — Coherencia con el schema de Prisma (Priority: P1)

**Como** desarrollador,
**quiero** que `prisma migrate dev` no proponga migraciones nuevas tras la corrección,
**para** garantizar que el reordenamiento no alteró el esquema final.

**Why this priority**: es la garantía de "el esquema final NO cambia"; sin ella la corrección podría introducir drift silencioso.

**Independent Test**: tras aplicar todas las migraciones sobre una BD limpia, `npx prisma migrate dev` (o `migrate diff` entre el `schema.prisma` y la BD) no genera ni propone ninguna migración adicional.

**Acceptance Scenarios**:

1. **Given** una BD recién migrada con la cadena corregida, **When** se ejecuta `npx prisma migrate dev --create-only`, **Then** Prisma responde que el esquema ya está sincronizado y no crea migración nueva.

---

### User Story 3 — Recuperación de BD de desarrollo existente (Priority: P2)

**Como** desarrollador con una BD de desarrollo ya migrada con el orden antiguo,
**quiero** un procedimiento documentado para alinear mi `_prisma_migrations` con la cadena renombrada,
**para** no quedar bloqueado por el cambio de nombre de una migración ya aplicada.

**Why this priority**: solo afecta a BD de desarrollo locales; el proyecto está en fase DESARROLLO con dataset vacío (commit `604e10bb`), así que el coste es bajo pero debe documentarse.

**Independent Test**: siguiendo el `quickstart.md`, una BD de desarrollo preexistente queda alineada (vía `prisma migrate reset --force` o `migrate resolve`) y `migrate status` queda limpio.

**Acceptance Scenarios**:

1. **Given** una BD de desarrollo con la migración `20260721001700_add_departamento` ya registrada bajo su nombre antiguo, **When** el desarrollador sigue el procedimiento documentado, **Then** la BD queda consistente con la cadena nueva sin pérdida de datos de negocio (dataset de desarrollo vacío o regenerable vía seed).

---

### Edge Cases

- **BD con datos de negocio reales ya migradas**: renombrar una migración aplicada invalida su registro en `_prisma_migrations`. Alcance: NO aplica — el proyecto está en fase DESARROLLO, sin producción y con dataset vacío; el plan documenta el procedimiento de recuperación solo para BD de desarrollo.
- **Migración intermedia que dependiera de `Departamento`**: se verificó que ninguna migración entre `20260720214140_add_colegio` y `20260721001700_add_departamento` (no hay ninguna) ni `add_colegio` misma crean la tabla `Departamento`; las migraciones posteriores (`20260721060000` en adelante) siguen ejecutándose después de ambas, sin cambio de orden relativo.
- **Checksums**: el contenido de `migration.sql` no se modifica, por lo que el checksum de la migración movida no cambia; solo cambia su nombre/posición.
- **CI / entornos efímeros**: cualquier pipeline que haga `migrate deploy` desde cero pasa a funcionar sin pasos extra.

## Requirements

### Functional Requirements

- **FR-001**: El sistema DEBE aplicar la cadena completa de migraciones con `prisma migrate deploy` sobre una base de datos vacía sin errores P3018.
- **FR-002**: La migración que crea la tabla `Departamento` DEBE ejecutarse antes que `20260720214140_add_colegio` (la que crea la FK `Colegio.departamentoId`).
- **FR-003**: La corrección NO DEBE modificar el contenido SQL de ninguna migración; el esquema final resultante DEBE ser idéntico al actual (mismas tablas, columnas, índices, constraints y enums).
- **FR-004**: El orden relativo de todas las demás migraciones NO DEBE cambiar.
- **FR-005**: El repositorio DEBE incluir un procedimiento documentado (quickstart) para alinear BD de desarrollo existentes con la cadena renombrada.
- **FR-006**: Tras la corrección, `npx prisma migrate dev` NO DEBE proponer migraciones nuevas (sin drift entre `schema.prisma` y la BD migrada).

### Key Entities

- **Migración de Prisma**: carpeta `prisma/migrations/<timestamp>_<nombre>/migration.sql`; Prisma las aplica en orden lexicográfico del nombre de carpeta y registra nombre + checksum en `_prisma_migrations`.
- **`Departamento`**: tabla creada por la migración a mover; referenciada por `Colegio.departamentoId` y `Ciudad.departamentoId`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `docker-compose up -d db` + `npx prisma migrate reset --force` (BD desde cero) completa sin errores en un solo intento.
- **SC-002**: `npx prisma migrate status` reporta todas las migraciones aplicadas, cero pendientes y cero fallidas.
- **SC-003**: `npx prisma migrate dev` no propone ninguna migración nueva tras el reset (drift = 0).
- **SC-004**: El gate de calidad completo pasa tras el cambio: `npm run lint`, `npm run test`, `npm run build` y `npx tsc --noEmit`.

## Assumptions

- El proyecto está en fase DESARROLLO: no existe ninguna base de datos de producción ni con datos irrecuperables; el dataset actual es vacío o regenerable vía seed (commit `604e10bb`).
- La regla de oro "migraciones siempre aditivas, nunca `migrate reset`" se relaja **excepcionalmente** para esta corrección: el reset solo se usa como herramienta de validación en desarrollo, autorizado explícitamente por ZEUS en el brief de I-04.
- Prisma aplica migraciones por orden lexicográfico de nombre de carpeta; renombrar la carpeta con un timestamp anterior a `20260720214140` (y posterior a `20260720174150`) es suficiente para reordenar.
- No hay ninguna otra migración con dependencias rotas; si la validación desde cero revelara otra incidencia de orden, se reporta como incidencia nueva fuera del alcance de esta spec.

## Implementación

**Fecha**: 2026-07-22 · **Cierre completo**: [`cierre.md`](./cierre.md)

- Cambio único: `git mv prisma/migrations/20260721001700_add_departamento prisma/migrations/20260720210000_add_departamento` (SQL intacto, checksums estables).
- Validación desde cero: 44 migraciones aplicadas sin P3018 (`migrate reset --force` + `migrate deploy` sobre BD de test nueva), seed idempotente, `migrate status` up to date.
- Drift: solo los 2 `DROP INDEX` HNSW preexistentes (deuda documentada en `quickstart.md` §B, no aplicada).
- Gate: lint OK · tsc OK · 716/716 tests · build limpio · `dev-restart.sh` con healthcheck OK y un solo worker.
- Commit: `fix(migraciones): corrige orden add_departamento antes de add_colegio (spec 080, I-04)`.
