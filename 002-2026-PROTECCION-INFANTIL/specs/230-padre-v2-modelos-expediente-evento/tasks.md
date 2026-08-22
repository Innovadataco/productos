# Tasks: Padre v2 · Modelos Expediente + Evento (SPEC-230 / 002-PI-130)

**Input**: Design documents from `/specs/230-padre-v2-modelos-expediente-evento/`

**Prerequisites**: plan.md, spec.md, data-model.md aprobados por ZEUS.

**Tests**: Tests unitarios/integración con Vitest; test de idempotencia del seed.

**Organization**: Tasks agrupados por fase: schema/migración, seed, repository, validación.

---

## Phase 1: Schema y migración aditiva

**Purpose**: Crear modelos, enums y migración sin DROP ni RENAME.

- [x] T001 [P] Editar `prisma/schema.prisma`:
  - Añadir `enum EstadoExpediente` (`ACTIVO`, `CONSOLIDANDO`, `PENDIENTE_COMITE`, `EN_APROBACION_PADRE`, `EN_ACLARACION`, `CERRADO`, `ESCALADO`).
  - Añadir `enum ScoreGravedad` (`VERDE`, `AMARILLO`, `ROJO`).
  - Añadir `enum TipoRevisionComite` (`REVISION_REPORTE`, `CONSOLIDACION_EXPEDIENTE`).
  - Añadir `model Expediente` con campos exactos del instructivo e índices.
  - Añadir `model EventoExpediente` con campos exactos e índices.
  - Añadir relaciones inversas mínimas: `Usuario.expedientes Expediente[]` y `Reporte.eventos EventoExpediente[]` (autorizado por ZEUS; no tocar nada más del bloque `Reporte`).
- [x] T002 [P] Generar migración aditiva (`npx prisma migrate dev --create-only --name padre_v2_expediente_evento`) y verificar que el SQL contiene `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`; no contiene `DROP`, `RENAME` ni `ALTER TABLE ... DROP COLUMN`.
- [x] T003 [P] Aplicar migración localmente (`npx prisma migrate dev`) y regenerar cliente (`npx prisma generate`).

**Checkpoint**: `npx prisma migrate status` verde; `npx prisma db pull` no detecta drift.

---

## Phase 2: Seed idempotente de parámetros `padre.*`

**Purpose**: Sembrar los 18 parámetros con upsert anti-I-100.

- [x] T004 [P] Añadir función `seedParametrosPadre()` en `prisma/seed.ts` con 18 upserts de `ParametroSistema` (tipos/categorías correctos, `esPublico = false`).
- [x] T005 [P] Crear `prisma/seed-padre.test.ts` que:
  - Ejecute el seed dos veces.
  - Verifique que no haya duplicados (`count = 18`).
  - Verifique que un valor modificado manualmente no se sobrescriba.
  - Verifique que un cambio de default en código se propague.

**Checkpoint**: `npm run test -- prisma/seed-padre.test.ts` pasa.

---

## Phase 3: Repository DAL

**Purpose**: Implementar `src/lib/dal/repositories/expediente-repository.ts` respetando frontera Q-3.

- [x] T006 [P] Crear `src/lib/dal/repositories/expediente-repository.ts` con:
  - `crearExpediente(data)`: crea expediente en estado `ACTIVO`, score `VERDE`.
  - `agregarEvento(data)`: transacción atómica que:
    - Rechaza si `expediente.estado = CERRADO` con `AppError`.
    - Bloquea la fila del expediente.
    - Calcula `ordenSecuencial = MAX + 1`.
    - Crea `Reporte` (si no se recibe `reporteId`) y `EventoExpediente`.
    - Incrementa `numEventos` y actualiza `ultimoEventoEn`.
  - `listarExpedientesDePadre(padreUsuarioId, paginacion)`: filtra por `padreUsuarioId`, ordena por `updatedAt DESC`, pagina.
  - `obtenerExpedientePorId(id, padreUsuarioId?)`: retorna expediente con eventos ordenados por `ordenSecuencial`; si se pasa `padreUsuarioId`, filtra por él.
- [x] T007 [P] Crear `src/lib/dal/repositories/expediente-repository.test.ts` con tests para:
  - Crear expediente.
  - Agregar eventos y verificar `ordenSecuencial` monotónico.
  - Rechazo de `agregarEvento` sobre expediente `CERRADO`.
  - `listarExpedientesDePadre` no cruza datos entre padres.
  - `obtenerExpedientePorId` con y sin filtro de padre.
  - Actualización de `numEventos` y `ultimoEventoEn` atómica.

**Checkpoint**: `npm run test -- src/lib/dal/repositories/expediente-repository.test.ts` pasa.

---

## Phase 4: Validación y cierre

**Purpose**: Gate de calidad local y documentación de cierre.

- [x] T008 [P] Ejecutar gate local:
  - `npx tsc --noEmit` verde.
  - `npm run lint --no-cache` verde (0 errores; warnings preexistentes).
  - `npm run test` verde para tests del SPEC; suite completa finalizada — ver resumen en cierre.md.
  - `npm run build` verde (warnings preexistentes de NFT/Turbopack).
  - `npm run arch:check` verde.
- [x] T009 [P] Actualizar `spec.md` sección **Implementación** con resumen de cambios, decisiones y tests.
- [x] T010 [P] Crear `cierre.md` en `specs/230-padre-v2-modelos-expediente-evento/` con evidencia de commits, tests y deuda técnica.
- [x] T011 [P] Rebase sobre `origin/feature/001-scaffolding` y push único de `work/002-pi-130`.

**Checkpoint**: Gate local verde; rama `work/002-pi-130` lista para auditoría de ZEUS.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (schema/migración) no tiene dependencias — bloquea Phase 2 y Phase 3.
- **Phase 2** (seed) depende de Phase 1.
- **Phase 3** (repository) depende de Phase 1; puede ejecutarse en paralelo con Phase 2.
- **Phase 4** (validación/cierre) depende de Phase 2 y Phase 3.

### Within Repository

- Definir tipos de entrada/salida antes de implementar métodos.
- Implementar `crearExpediente` antes de `agregarEvento`.
- Implementar tests junto a cada método (TDD).

---

## Implementation Strategy

1. Phase 1: schema + migración aditiva.
2. Phase 2: seed + test idempotencia.
3. Phase 3: repository + tests unitarios.
4. Phase 4: gate local, documentación de cierre, push único.

---

## Notes

- No tocar `src/lib/ai/**` ni la rúbrica.
- No implementar UI ni rutas `/dashboard/padre/*`.
- Todos los `DateTime` de momento usan `@db.Timestamptz(6)`.
- Frontera DAL Q-3: `expediente-repository.ts` es el único punto de acceso a Prisma para estas entidades.
