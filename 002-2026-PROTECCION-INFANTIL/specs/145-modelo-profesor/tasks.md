# Tasks: SPEC-145 — Modelo `Profesor` mínimo

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Contracts**: [contracts/profesores.md](./contracts/profesores.md)

Compuerta §4 superada (ZEUS 2026-08-03, CUMPLE): D1=A (endpoints de curso aceptan
`profesorTitularId?` YA con validación same-tenant) · COND-1 test negativo
cross-tenant explícito · COND-2 baja suave del titular CONSERVA la asignación
(FR-014) · cuidado ADD VALUE (no usar el valor en la misma migración — no aplica).

Reglas: TDD en repo y rutas (test primero) · commits lógicos en español imperativo ·
cero tests debilitados (O-1/O-2 fortalecen/restauran) · gate completo antes de push.

## Fase 1 — Schema y migración (US1)

- [ ] T001 `prisma/schema.prisma`: modelo `Profesor` (nombre, apellidos, email?,
  telefono?, estado, colegioId, @@index) + `Curso.profesorTitularId String?` +
  relación `profesorTitular` + `Colegio.profesores` + enum `AccionAudit` +=
  `COLEGIO_PROFESOR_CREADO/EDITADO/DESACTIVADO` (FR-001/002/004)
- [ ] T002 Migración aditiva (`migrate diff` + shadow DB, TTY no disponible) —
  **INSPECCIÓN I-49 línea a línea: cero `DROP INDEX`/`DROP TABLE`/enum DROP**; si
  aparece uno: PARA y reporta. Aplicar a dev y test; `migrate reset --force &&
  migrate deploy && db seed` en test (quickstart §1-2)

## Fase 2 — DAL y validación (US2)

- [ ] T003 [P] `src/lib/dal/repositories/profesor.ts` (tenant-first: listar paginado
  con filtro estado, buscarPorNombreApellidosEnColegio para 409, obtenerPorId con
  colegioId → null si 0 filas, crear, actualizar, cambiarEstado) +
  `profesor.test.ts` A/B
- [ ] T004 [P] `profesorBodySchema` + `profesorPatchSchema` en `src/lib/schemas`
  (nombre+apellidos requeridos en create, email formato, estado ∈ activo|inactivo)
  + tests de schema
- [ ] T005 [P] `curso.ts` (repo) y endpoints de curso: `profesorTitularId?` en
  create/update con validación same-tenant (`null` desasigna) — D1=A

## Fase 3 — Rutas CRUD (US2)

- [ ] T006 `GET/POST /api/colegio/profesores` (patrón de
  `cursos/[id]/alumnos/route.ts`: auth, assertModulo, vigencia, rate limit, Zod,
  repo, audit) + `route.test.ts` A/B: lista solo propios, 201, 400 sin apellidos,
  400 email inválido, 409 duplicado, paginación + filtro estado
- [ ] T007 `GET/PATCH /api/colegio/profesores/[id]` + `route.test.ts` A/B: 404
  cross-tenant en ambos verbos, edición, **baja suave conserva fila**, audit con
  acciones nuevas
- [ ] T008 Tests de asignación (COND-1/COND-2): **negativo cross-tenant** (profesor
  de B a curso de A → 404/400 en POST y PATCH de curso) · **baja del titular
  conserva `profesorTitularId`** · `null` desasigna

## Fase 4 — Cargas, arch y cierre

- [ ] T009 [P] O-2: `src/components/ui/LuzAmbiental.test.tsx` (render por estado,
  token aplicado, aria-hidden, reduced-motion — patrón `PanelVidrio.test.tsx`)
- [ ] T010 [P] O-1: fixture `rubrica:M1+M2` + votos `modelo: "M2"` y aserciones
  `not.toContain("M1")`/`not.toContain("M2")` amplias en
  `mis-reportes/[id]/route.test.ts`
- [ ] T011 Regenerar `docs/architecture/01-modelo-datos.md` (+ oráculo 51→52 si
  aplica) + `arch:check` VERDE + `tokens:check` sin subir del piso (1166)
- [ ] T012 Quickstart completo + gate (tsc && lint && tokens:check && test:coverage
  && build && arch:check) + `./scripts/dev-restart.sh` + PR auto-merge + CI HEAD
  success + cierre.md

## Analyze (speckit.analyze, 2026-08-03)

- Cobertura: US1→T001-T002 · US2→T003-T008 · US3→T009-T010 · FR-012→T011 ·
  FR-003→T002 (I-49) · FR-009/014→T005/T008. Toda FR tiene tarea; FR-013 es
  invariante verificado en T012.
- Consistencia: D1+COND-1+COND-2 reflejadas en spec/research/contracts/checklist/
  tasks. Sin ambigüedades abiertas. Sin duplicados.
