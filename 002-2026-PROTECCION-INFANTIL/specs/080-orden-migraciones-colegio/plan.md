# Implementation Plan: Spec 080 — Corrección del orden de migraciones (I-04)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/080-orden-migraciones-colegio/spec.md`

## Summary

Renombrar la carpeta de la migración `20260721001700_add_departamento` a un timestamp anterior a `20260720214140_add_colegio` (p. ej. `20260720210000_add_departamento`), sin tocar el contenido de `migration.sql`. Prisma aplica migraciones en orden lexicográfico de nombre de carpeta, por lo que `Departamento` pasará a existir antes de que `add_colegio` cree la FK `Colegio.departamentoId`. El esquema final no cambia (FR-003); solo cambia el orden de aplicación.

## Technical Context

**Language/Version**: TypeScript 5 (strict) — sin cambios de código aplicativo
**Primary Dependencies**: Prisma 5.22.0 (`migrate deploy` / `migrate dev` / `migrate reset`)
**Storage**: PostgreSQL 16 (Docker, contenedor `002-2026-proteccion-infantil-db-1`, puerto 5433, imagen `pgvector/pgvector:pg16`)
**Testing**: validación por bootstrap desde cero (`migrate reset --force` + `db seed`) + gate estándar (`lint`, `test`, `build`, `tsc --noEmit`)
**Target Platform**: desarrollo local macOS; aplica a cualquier entorno que haga bootstrap desde cero
**Project Type**: web-service (Next.js 16 + Prisma)
**Constraints**:
- No modificar el SQL de ninguna migración (checksums estables).
- No cambiar el orden relativo de ninguna otra migración.
- Proyecto en fase DESARROLLO, sin producción ni datos irrecuperables.

## Constitution Check

*GATE: verificado contra `.specify/memory/constitution.md` y AGENTS.md.*

| Regla | Evaluación |
|-------|------------|
| Migraciones aditivas y no destructivas | **Excepción autorizada**: el brief de ZEUS (I-04) ordena validar con `prisma migrate reset --force` en desarrollo. No se destruye dato real (dataset vacío, sin producción). La corrección en sí (rename de carpeta) no altera SQL. |
| Secrets por variables de entorno | Sin impacto; no se toca configuración. |
| Restricciones de producto (solo texto, IA local, etc.) | Sin impacto; cambio puramente de infraestructura de datos. |
| Spec Kit obligatorio | Cumplido: esta spec + plan preceden a la implementación. |

Sin violaciones que justificar.

## Análisis de dependencias (Phase 0 — research)

Cadena relevante verificada el 2026-07-22:

```text
20260714105800_add_pais_ciudad        → crea Pais, Ciudad
...
20260720174150_add_simulacion_tables
20260720214140_add_colegio            → crea Colegio + FK a Departamento  ✗ (Departamento aún no existe)
20260721001700_add_departamento       → crea Departamento + Ciudad.departamentoId
20260721060000_add_colegio_cursos_alumnos
...
```

Dependencias de `add_departamento` (contenido íntegro revisado):

- Referencia `Pais` (`Departamento_paisId_fkey`) → creada en `20260714105800`. ✓ disponible antes del hueco.
- Altera `Ciudad` (`ADD COLUMN departamentoId` + índice + FK) → creada en `20260714105800`. ✓ disponible antes del hueco.
- **No referencia `Colegio` ni ninguna tabla de migraciones intermedias.** ✓

Conclusión: `add_departamento` puede ocupar cualquier posición entre `20260714111300_add_ciudad_unique` (su dependencia más reciente sobre `Ciudad`) y `20260720214140_add_colegio`. Se elige `20260720210000_add_departamento`: posterior a `20260720174150_add_simulacion_tables` e inmediatamente anterior a `add_colegio`, minimizando el desplazamiento.

### Alternativas consideradas

| Alternativa | Decisión | Motivo |
|-------------|----------|--------|
| Renombrar carpeta de `add_departamento` | **Elegida** | Esquema final idéntico, SQL intacto, una sola operación `git mv`. |
| Adelantar `add_colegio` después de `add_departamento` | Rechazada | `add_colegio` tiene migraciones posteriores que dependen de ella (`add_colegio_cursos_alumnos`, etc.); moverla desplazaría más piezas y aumenta el riesgo. |
| Editar SQL de `add_colegio` para crear `Departamento` inline y hacer `add_departamento` idempotente | Rechazada | Modifica dos migraciones (checksums), duplica DDL y es más invasiva; rompe FR-003. |
| Nueva migración correctiva al final | Rechazada | No puede arreglar el fallo: `add_colegio` falla antes de que cualquier migración nueva llegue a ejecutarse en una BD vacía. |

### Impacto en BD de desarrollo existentes

Las BD ya migradas tienen registrado `20260721001700_add_departamento` en `_prisma_migrations`. Tras el rename, Prisma la verá como "aplicada pero no encontrada en disco" y la nueva como "no aplicada". Recuperación (documentada en `quickstart.md`):

1. Opción A (recomendada, dataset vacío): `npx prisma migrate reset --force` y `npx prisma db seed`.
2. Opción B (si hubiera datos que conservar): `npx prisma migrate resolve --rolled-back 20260721001700_add_departamento` + ajuste manual del registro, o reset. No aplica hoy.

## Project Structure

### Documentation (this feature)

```text
specs/080-orden-migraciones-colegio/
├── spec.md              # Especificación (este paquete)
├── plan.md              # Este archivo
├── research.md          # Análisis de dependencias (resumen del Phase 0)
├── quickstart.md        # Validación desde cero + recuperación de BD dev
└── checklists/
    └── requirements.md  # Checklist de calidad de la spec
```

(Sin `data-model.md` ni `contracts/`: no hay cambios de esquema ni de API — FR-003.)

### Source Code (repository root)

```text
prisma/migrations/
├── 20260721001700_add_departamento/          # RENOMBRAR →
└── 20260720210000_add_departamento/          # mismo migration.sql, sin ediciones
```

**Structure Decision**: único cambio de archivos: `git mv prisma/migrations/20260721001700_add_departamento prisma/migrations/20260720210000_add_departamento`. No se toca `prisma/schema.prisma` ni código de `src/`.

## Plan de ejecución (tras aprobación de ZEUS)

1. `git mv` de la carpeta de migración (sin editar `migration.sql`).
2. Verificación estática: `grep -rn "Departamento" prisma/migrations/*/migration.sql` confirma que ninguna creación/alteración de `Departamento` queda después de `20260720214140_add_colegio` salvo las que ya dependían de ella.
3. Validación desde cero (comandos del brief):
   - `docker-compose up -d db`
   - `npx prisma migrate reset --force`
   - `npx prisma db seed`
   - `npx prisma migrate status` (cero pendientes/fallidas)
   - `npx prisma migrate dev --create-only` → sin migraciones nuevas (drift = 0)
4. Gate de calidad: `npm run lint && npm run test && npm run build && npx tsc --noEmit` (requiere `npm install` previo: `node_modules` no existe en el worktree actual).
5. Deploy limpio con `./scripts/dev-restart.sh` y healthcheck.
6. Documentación: `cierre.md` en la spec + sección Implementación en `spec.md` + actualización de `specs/README.md` (índice) y Status `CERRADA` tras ACTA-VALIDACION.
7. Commit único: `fix(migraciones): corrige orden add_departamento antes de add_colegio (spec 080, I-04)`.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| BD de desarrollo de otro agente queda desalineada | Procedimiento de recuperación en `quickstart.md`; dataset vacío y regenerable. |
| Otra migración con orden roto no detectada | La validación desde cero (paso 3) cubre la cadena completa; cualquier fallo nuevo se reporta como incidencia aparte. |
| `node_modules` ausente en el worktree | `npm install` antes del gate de calidad (paso 4). |

## Complexity Tracking

Sin violaciones de constitución que justificar.
