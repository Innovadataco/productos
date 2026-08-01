# Tasks: SPEC-133 — Journeys E2E por rol: gate de merge + cobertura completa

**Input**: plan.md + spec.md (compuerta §4 APROBADA por ZEUS 2026-08-01, condiciones O-1..O-4)
**Condiciones de la aprobación**: O-1 (negativo que destapa hueco real → PARAR y reportar;
el test queda `.todo`/skip enlazado al radicado, NO se debilita) · O-2 (aserciones §9 en BD)
· O-3 (negativos que pueden FALLAR) · O-4 (cero producto; branch protection = CEO).

## Fase 1 — Gate explícito (US1)

- [ ] T001 Script `test:journeys` en `package.json` (solo `src/lib/e2e/journeys/`)
- [ ] T002 Paso dedicado `Journeys por rol` en `.github/workflows/ci.yml` tras la suite
- [ ] T003 Branch protection documentada en el runbook de despliegue (acción del CEO)
- [ ] T004 Regenerar `docs/architecture/06-stack.md` (script nuevo) + `arch:check` verde

## Fase 2 — Journey padre (US2, FR-003)

- [ ] T005 Apelaciones: `POST /api/apelaciones` + `GET /api/apelaciones/mias` (§9 en BD)
- [ ] T006 Alertas: `POST /api/alertas/suscribir` + `GET /api/alertas` + `DELETE /api/alertas/[id]`
- [ ] T007 Recuperar contraseña: solicitar → validar → restablecer (§9: hash cambia)

## Fase 3 — Journey colegio (US2, FR-004)

- [ ] T008 Carga masiva: plantilla → validar → confirmar con import real (§9: alumnos en BD)
- [ ] T009 Alertas del colegio: `GET /api/colegio/alertas` + `PATCH .../estado`
- [ ] T010 Auditoría: `GET /api/colegio/auditoria` con eventos sembrados

## Fase 4 — Journey operador-comite (US2, FR-005)

- [ ] T011 Anonimización: reporte sembrado en `REQUIERE_ANONIMIZACION` → `anonimizar` →
      `validar-anonimizacion` (§9: estados y texto)
- [ ] T012 Apelaciones del comité: `GET /api/admin/comite/apelaciones` + `tomar` + `resolver`

## Fase 5 — Journey admin (US2, FR-006)

- [ ] T013 Parámetros: `GET/PATCH /api/config/parametros` (§9: `ParametroSistema` cambia)
- [ ] T014 Spam: `POST /api/admin/spam/[id]/resolver` (§9: estado final)
- [ ] T015 Correcciones RAG: `POST /api/admin/correcciones` (§9: corrección en BD)

## Fase 6 — Negativos handler-level + multi-tenant (US3, FR-007/FR-008)

- [ ] T016 `negativos-handler.test.ts`: OPERADOR/COMITE → APIs admin-only = 403 (O-3)
- [ ] T017 PARENT → `/api/colegio/**` = 403; cross-parent `mis-reportes/[id]` = 403/404
- [ ] T018 Asignación estricta: operador/comité no asignado sobre caso ajeno = 403
- [ ] T019 Multi-tenant A/B: colegio A no lee ni escribe cursos/alumnos/alertas/stats de B
- [ ] T020 Si T016-T019 destapan un hueco real (O-1): PARAR la fase y reportar a ZEUS;
      aserción correcta en `.todo` enlazada al radicado

## Fase 7 — Cierre

- [ ] T021 Gates: suite completa + `tsc --noEmit` + lint + build + `arch:check` verdes
- [ ] T022 Piso de cobertura Q-2 revisado (solo sube; si sube, actualizar umbral en el commit)
- [ ] T023 Cierre documental: spec.md (Status + §Implementación), checklist, `specs/README.md`
