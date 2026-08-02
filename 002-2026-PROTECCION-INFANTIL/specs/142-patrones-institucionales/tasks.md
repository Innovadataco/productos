# Tasks: SPEC-142 — Patrones institucionales para colegios (F6)

**Estado**: PENDIENTE DE COMPUERTA §4 — tasks reales se generan con el flujo Spec-Kit
(`tasks`) SOLO tras el veredicto de ZEUS sobre `spec.md` + `plan.md`. NO implementar.

**Input**: plan.md + spec.md (sin aprobar todavía).

## Fases previstas (resumen de plan.md §Fases — referencia para el tasks real)

1. Modelo + DAL: migración aditiva (`PatronInstitucional` + `AlertaColegio.
   patronInstitucionalId`), repo con tenant obligatorio, include con `curso.grado`,
   parámetro `colegio.patrones.k_anonimato`.
2. Servicio de agregación: puerta `esReporteAprobado`, dedupe por (colegio, reporte),
   upsert + marcador en tx, reversa en baja. TDD (SC-001/SC-002).
3. Disparos: worker post-hook (fail-open), corrección admin, comité, baja.
4. Endpoint + regla de k (función pura) + página SCHOOL_ADMIN con estado vacío y
   tendencia. Tests cross-tenant (SC-003).
5. (P3) PDF con la misma regla de k.
6. Gates + cierre: suite, tsc, lint, build, `docs/architecture/` regenerado +
   `arch:check` verde (SPEC-126), `./scripts/dev-restart.sh`, quickstart.
