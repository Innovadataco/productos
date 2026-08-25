# Tasks: SPEC-248 — Categorías Ley 2564 completas + Definiciones legales editables

**Branch**: `work/002-PI-151` · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Orden dependencia: schema/migración → semilla/constantes → seed → endpoints → UI → tests → docs → simulación → gate pre-push.

## Fase 0 — schema y migración (US1)

- [ ] **T001**: `prisma/schema.prisma` — agregar `CIBERACOSO`, `HAPPY_SLAPPING`, `STALKING` al enum `CategoriaConducta` y `RUBRICA_DEFINICION_UPDATE` al enum `AccionAudit` (aditivo).
- [ ] **T002**: `prisma/migrations/20260824170000_spec_248_categorias_ley_2564/migration.sql` — `ALTER TYPE ... ADD VALUE IF NOT EXISTS` × 4 (patrón SPEC-239, con `pg_enum` guard).

## Fase 1 — semilla y constantes de código (US1, US2)

- [ ] **T003 [P]**: `src/lib/ai/rubrica-semilla.ts` — agregar los 3 bloques del brief §5.2 (`CIBERACOSO`/`HAPPY_SLAPPING`/`STALKING`), 5 preguntas c/u con las 2 primeras `tipo: "decisiva"` (copiado literal, cero paráfrasis).
- [ ] **T004 [P]**: `src/lib/ai/rubrica-semilla.ts` — agregar `type DefinicionCategoria` + constante `DEFINICIONES_CATEGORIA` (14 entradas, brief §6, copiadas literal).
- [ ] **T005 [P]**: `src/lib/labels.ts` — agregar `CIBERACOSO`, `HAPPY_SLAPPING`, `STALKING` a `CATEGORIAS_LABELS`.

## Fase 2 — seed (US1, US2)

- [ ] **T006**: `prisma/seed.ts` — extender `rubricaParams` con `ia.rubrica.definiciones` (idempotente-respetuoso, `update: {}`) y mantener `ia.rubrica.preguntas` forzado (excepción SPEC-199).
- [ ] **T007**: `prisma/seed.ts` — extender `severidadesSeed` con `["CIBERACOSO", 60]`, `["HAPPY_SLAPPING", 75]`, `["STALKING", 70]`.

## Fase 3 — endpoints (US2)

- [ ] **T008**: `src/app/api/admin/ia/rubrica/route.ts` — extender `GET` con campo `definiciones` (lee `ia.rubrica.definiciones` con fallback a `DEFINICIONES_CATEGORIA`).
- [ ] **T009 [P]**: `src/app/api/admin/ia/rubrica/definiciones/route.ts` — `GET` (ADMIN y COMITE_VALIDACION, solo lectura).
- [ ] **T010 [P]**: `src/app/api/admin/ia/rubrica/definiciones/[categoria]/route.ts` — `PATCH` (ADMIN, actualiza 1 entrada, `AuditLog RUBRICA_DEFINICION_UPDATE`).

## Fase 4 — UI (US2)

- [ ] **T011**: `src/components/modules/ia/DefinicionLegalCard.tsx` — componente nuevo (card ámbar + modal 4 campos, botón "Editar" solo `ADMIN`).
- [ ] **T012**: `src/components/modules/ia/RubricaTab.tsx` — extender `ConfigRubricaResponse` con `definiciones`, renderizar `<DefinicionLegalCard/>` antes del listado de preguntas por categoría, pasar rol para gate de edición.

## Fase 5 — tests (todos los US)

- [ ] **T013 [P]**: `src/lib/ai/rubrica-semilla.test.ts` — 3 bloques nuevos (5 preguntas, 2 decisivas c/u); `DEFINICIONES_CATEGORIA` con 14 entradas.
- [ ] **T014 [P]**: `src/app/api/admin/ia/rubrica/route.test.ts` — `GET` incluye `definiciones` con 14 entradas; campos previos intactos.
- [ ] **T015 [P]**: `src/app/api/admin/ia/rubrica/definiciones/route.test.ts` — `GET` como `ADMIN` y `COMITE_VALIDACION`; `401`/`403` sin rol.
- [ ] **T016 [P]**: `src/app/api/admin/ia/rubrica/definiciones/[categoria]/route.test.ts` — `PATCH` 200 (`ADMIN`, `AuditLog` capturado), 403 (no `ADMIN`), 404 (categoría inexistente), 400 (body inválido).
- [ ] **T017**: idempotencia — `src/lib/ai/rubrica-config.test.ts` o test nuevo que verifique 2 corridas del bloque de seed sin regresión.

## Fase 6 — validación (US3)

- [ ] **T018**: correr `npx tsc --noEmit && npm run lint && npm run test && npm run build && ./scripts/dev-restart.sh` (gate estándar AGENTS.md).
- [ ] **T019**: correr `SimulacionRun` sobre dataset actual con las 14 categorías activas — documentar precision/recall/confusion matrix en `AuditLog` (brief §7, FR-016).

## Fase 7 — documentación (brief §9, dentro del SPEC)

- [ ] **T020 [P]**: `05-ENTREGABLES/MODELO-DE-CLASIFICACION.md` — §5 sección "Definiciones legales editables"; §8 tabla 14 categorías con las 3 nuevas.
- [ ] **T021 [P]**: `05-ENTREGABLES/NORMATIVIDAD-VIGENTE-PROTECCION-INFANTIL.md` — §1.3 confirmar cobertura completa 6/6 Ley 2564 art. 6.
- [ ] **T022 [P]**: `05-ENTREGABLES/ANALISIS-COMPARATIVO-PRODUCTO-VS-NORMATIVIDAD.md` — §2 matriz cobertura (2/6 fuerte → 6/6 fuerte).
- [ ] **T023 [P]**: `05-ENTREGABLES/ANALISIS-CUMPLIMIENTO-Y-ESTRATEGIA-COMERCIAL.md` — §3 matriz de cumplimiento.
- [ ] **T024**: `specs/248-categorias-ley-2564/cierre.md` — resumen final (deuda técnica, evidencia, hashes de commits).

## Fase 8 — gate pre-push y push (candado I-101/I-104)

- [ ] **T025**: `git fetch origin && git rebase origin/feature/001-scaffolding && git diff --name-status origin/feature/001-scaffolding..HEAD` — pegar salida en chat, señalar `diff pre-push · OK · N archivos SPEC-248`.
- [ ] **T026**: `git push -u origin work/002-PI-151` (único push, D-54) + abrir PR contra `feature/001-scaffolding`.

**Nota [P]**: tareas marcadas [P] son independientes entre sí y pueden delegarse a agentes paralelos (SWARM) si la implementación lo justifica. El resto son secuenciales por dependencia.
