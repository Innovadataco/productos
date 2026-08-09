# Tasks: SPEC-149 — Avisos por email configurables

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [ ] T001 Schema: `PreferenciaAlertaColegio` + `RegistroAvisoColegio` +
      `AccionAudit` ×2 + migración aditiva (diff+shadow, **I-49: cero DROP INDEX**)
      + `migrate reset && deploy && seed` en test
- [ ] T002 [P] Repos `preferencia-alerta-colegio.ts` (upsert por tipo, tenant) y
      `registro-aviso-colegio.ts` (marcar con upsert/constraint, conteo diario,
      pendientes de digest) + tests A/B + idempotencia por constraint
- [ ] T003 `src/lib/colegio/avisos.ts` — pipeline: registrar evento → preferencia →
      idempotencia → tope → encolar `colegio-aviso`; evaluadores UMBRAL_CURSO (N en
      X días) y ESTUDIANTE_REPETIDO (M en Y días) + tests (cruza solo al llegar,
      ventana móvil)
- [ ] T004 `email.ts` extendido (4 funciones por tipo, copy ciego §3) + hook en
      `colegio/alertas.ts` (encola, supera el email inline viejo — tests
      actualizados a la nueva conducta encolada, nunca debilitados) + `queue.ts` +
      worker (handler + retry + schedule lunes 07:00 Bogotá) +
      `avisos-resumen.ts` (digest: KPIs semana, te espera, pendientes) + tests con
      Resend mockeado
- [ ] T005 `GET/PATCH /api/colegio/preferencias-avisos` (upsert, Zod, audit) +
      página `/dashboard/colegio/configuracion` + nav "Configuración" + tests A/B
- [ ] T006 Seeds `colegio.notificaciones.*` + `colegio.avisos.*` + regenerar
      `01-modelo-datos.md` (52→54) + oráculo páginas 55→56 + `arch:check` VERDE
- [ ] T007 Checks de día: tsc + lint + tokens:check (≤1122) + arch:check + tests
      del área (nuevos + alertas/email/cola/journeys verdes) + push

## Analyze (2026-08-08)

- Cobertura: US1→T002-T004 · US2→T003 · US3→T003,T004 · US4→T005 · FR-001→T001 ·
  FR-008→T006 · FR-009→T002-T005,T007. Toda FR tiene tarea; FR-010 invariante en
  T007.
- Consistencia: idempotencia por constraint (no por cooldown) coherente en repo,
  pipeline y schedule; email viejo superado sin modo dual (Assumption documentada);
  I-49 con inspección explícita del SQL.
