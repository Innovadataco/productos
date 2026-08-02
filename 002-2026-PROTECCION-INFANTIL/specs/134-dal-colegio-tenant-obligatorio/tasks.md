# Tasks: SPEC-134 — DAL del módulo colegio con tenant obligatorio

**Input**: plan.md + spec.md (compuerta §4 APROBADA por ZEUS 2026-08-01, condiciones O-1..O-4)
**Condiciones**: O-1 (query sin filtro tenant donde debería = hueco real → PARAR y reportar,
no arreglar en silencio) · O-2 (suite + journeys verdes SIN cambiar expectativas; tocar un
test = cambio de comportamiento → PARAR) · O-3 (commits por fase, allowlist en el mismo
commit) · O-4 (tests del guard: id de otro colegio = 0 filas → 404; filtros tipados).

## Fase 1 — Repos base + tests (FR-001/FR-002/FR-004)

- [x] T001 `repositories/colegio.ts` + test (obtener/vigencia; tenant = propio id)
- [x] T002 `repositories/curso.ts` + test (listar/crear/obtener/actualizar/estado; O-4)
- [x] T003 `repositories/alumno.ts` + test (por curso+tenant; O-4)
- [x] T004 `repositories/identificador-alumno.ts` + test (O-4)
- [x] T005 `repositories/alerta-colegio.ts` + test (O-4)
- [x] T006 `repositories/carga-roster-sesion.ts` + test (crear/leer/consumir/purgar, D2)

## Fase 2 — Migrar `src/lib/colegio/` (FR-003)

- [x] T007 `carga/sesion-roster.ts` e `importer.ts` → repo (purga single-use en la tx, D2)
- [x] T008 `alertas.ts` → repo (lógica queda en el módulo; solo acceso a datos migra)
- [x] T009 `estadisticas.ts` + `vigencia.ts` + `permisos.ts` → repos (firmas públicas intactas)
- [x] T010 Allowlist: sacar los 6 módulos EN EL MISMO commit (O-3)

## Fase 3 — Migrar rutas (FR-003)

- [x] T011 cursos + cursos/[id] (+/alumnos, +/estado) → repos; allowlist mismo commit
- [x] T012 alumnos/[id] (+/estado, +/identificadores) + identificadores/[id] (+/estado);
      allowlist mismo commit
- [x] T013 alertas + auditoria + me/colegio; allowlist mismo commit
- [x] T014 carga/validar + carga/confirmar; allowlist mismo commit (allowlist queda en 50)

## Fase 4 — Gates y cierre

- [x] T015 Suite completa + journeys SPEC-133 verdes SIN cambiar expectativas (O-2);
      tsc + lint + build + arch:check
- [x] T016 Piso de cobertura Q-2 revisado (solo sube)
- [x] T017 Cierre documental: spec.md (Status + §Implementación), checklist, specs/README.md
