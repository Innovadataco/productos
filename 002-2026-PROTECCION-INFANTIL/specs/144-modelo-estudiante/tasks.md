# Tasks: SPEC-144 — Modelo `Estudiante` expandido

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

> **STUB — compuerta §4.** Se detalla con `/speckit.tasks` después de que ZEUS apruebe
> spec+plan y resuelva D1–D4. Orden previsto (dependencias):

## Fase 1 — Schema y migración (US1, US2)

- [ ] T001 Rename `Alumno → Estudiante` + `@@map`/`@map` en `prisma/schema.prisma`
- [ ] T002 Rename `IdentificadorAlumno → IdentificadorEstudiante` + enum
      `EtiquetaRelacionEstudiante` + relaciones (`Colegio`, `Curso`, `AlertaColegio`,
      `Plataforma`)
- [ ] T003 Campos nuevos (`apellidos`, `documentoTipo`, `documentoNumero`) + modelo
      `AcudienteEstudiante` (si D1=A) + migración aditiva
- [ ] T004 Verificar `migrate reset && migrate deploy && db seed` en BD de test

## Fase 2 — Cascada DAL y lib (US1)

- [ ] T005 [P] Repos: `estudiante.ts`, `identificador-estudiante.ts`,
      `alerta-colegio.ts` (+ tests)
- [ ] T006 [P] Lib colegio: `alertas.ts`, `patrones.ts`, `permisos.ts`
- [ ] T007 Carga: `parser/validator/importer/sesion-roster` + columna `apellidos` (D4)

## Fase 3 — Rutas API + validación de alta (US3)

- [ ] T008 `estudianteBodySchema` en `src/lib/schemas` (apellidos requerido, set
      `documentoTipo`, máx 2 acudientes)
- [ ] T009 [P] Endpoints colegio + tests A/B tenant actualizados (fortalecer, no
      debilitar)
- [ ] T010 Endpoints admin colegios + tests

## Fase 4 — Componentes, arch y cierre

- [ ] T011 [P] Componentes/páginas: tipos y props renombrados
- [ ] T012 Regenerar `docs/architecture/01-modelo-datos.md` + `arch:check` verde
- [ ] T013 Quickstart completo + gate (tsc/lint/test:coverage/build/arch:check) +
      `dev-restart.sh`
