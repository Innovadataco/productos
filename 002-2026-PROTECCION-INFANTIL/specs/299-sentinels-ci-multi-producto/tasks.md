---
description: "Tasks — SPEC-299 Sentinels CI multi-producto (002-PI-202)"
---

# Tasks: Sentinels CI multi-producto

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md)

**Prerequisites**: plan.md ✓ · spec.md ✓ · APROBADO §4 por Fábrica PI-1 (mensaje 2026-08-28 22:14 COT).

**Tests**: la feature es puramente infra CI — no aplican unit/integration tests nuevos. La verificación en vivo es `gh pr checks <PR>` sobre el propio PR (US-2 / SC-001). Cubre a la vez los tres criterios: sintaxis YAML, semántica del sentinel y comportamiento con paths ampliados.

**Organization**: por fases del plan (7 fases), no por user stories — porque las 4 user stories comparten los mismos 3 archivos y no admiten implementación independiente físicamente (editar ci.yml sirve simultáneamente a US1, US2, US3).

## Format: `[ID] [P?] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias).
- Rutas relativas a la raíz del monorepo `productos/`.

---

## Fase 1 · Editar `ci.yml` (PI)

- [x] **T001** Ampliar el filtro `paths` de `push` y de `pull_request` en `.github/workflows/ci.yml` para reemplazar `.github/workflows/ci.yml` por `.github/workflows/**` (conservar el path `002-2026-PROTECCION-INFANTIL/**`). Resultado: dos entradas `paths` en total (uno en push, uno en pull_request).
- [x] **T002** Añadir job `pi-gate` al FINAL de `.github/workflows/ci.yml` (después del job `gate` actual), con:
  - `runs-on: ubuntu-latest`
  - `needs: [should-skip, verificaciones, test-unit, test-integration, test-integration-coverage, journeys, build]`
  - `if: always()`
  - Un único step "Evaluar veredicto agregado" con el shell script canónico del plan.md (checks a `contains(needs.*.result, 'failure')` y `'cancelled'`, exit 1 si alguno; exit 0 si todos son success o skipped).
  - Comentario corto arriba del job: `# Sentinel multi-producto (SPEC-299 / BRIEF A-49). Ver .github/workflows/README.md.`

## Fase 2 · Editar `bi.yml` (BI)

- [x] **T003** [P] Ampliar el filtro `paths` de `push` y de `pull_request` en `.github/workflows/bi.yml` para AÑADIR `.github/workflows/**` (conservar `005-2026-BI-INTELIGENCIA-NEGOCIO/**`).
- [x] **T004** [P] Añadir job `bi-gate` al FINAL de `.github/workflows/bi.yml`, con:
  - `runs-on: ubuntu-latest`
  - `needs: [verify, typecheck, test-unit, build]`
  - `if: always()`
  - Mismo step "Evaluar veredicto agregado" que `pi-gate`.
  - Mismo comentario corto de trazabilidad.
  - **Nota estructural**: `bi.yml` usa `defaults.run.working-directory` a nivel de workflow. El sentinel NO necesita working-directory (es pura shell sin acceso a archivos). Como los defaults a nivel de workflow se heredan a menos que se sobreescriban, el step del sentinel funciona igual (no ejecuta nada relativo al cwd).

## Fase 3 · Documentar el patrón

- [x] **T005** [P] Crear `.github/workflows/README.md` (nuevo), < 150 líneas, con las 7 secciones definidas en el plan.md §"README.md — outline":
  1. Título + 3 líneas de contexto (problema del ruleset multi-producto).
  2. Regla dura: un sentinel por producto.
  3. Requisitos por workflow.
  4. Plantilla YAML lista para copiar-pegar.
  5. Cómo pedir el registro del check a Jelkin.
  6. Convención de nombres (`pi-gate`, `bi-gate`, `mod-gate`, `idc-gate`, `sicov-gate`, `sarlaft-gate`).
  7. Enlace al SPEC-299.

## Fase 4 · Commit + inspección local

- [x] **T006** `git status` para confirmar exactamente 3 archivos modificados/nuevos: `.github/workflows/ci.yml` (M), `.github/workflows/bi.yml` (M), `.github/workflows/README.md` (??), y ningún otro.
- [x] **T007** Commit único (o dos commits: uno para YAML, uno para README) con mensaje: `ci(SPEC-299): sentinels pi-gate/bi-gate + README patrón multi-producto (002-PI-202)`. Sin `git add -A` (candado AGENTS.md — solo `git add` de rutas específicas).
- [x] **T008** Inspección visual del diff con `git diff HEAD~1..HEAD -- .github/workflows/` para verificar SC-003: jobs preexistentes intactos, solo ampliación de `paths` + jobs sentinel nuevos al final.

## Fase 5 · Gate pre-push obligatorio (candado A-49)

- [x] **T009** `git fetch origin && git rebase origin/main && git diff --name-status origin/main..HEAD` — señal `diff pre-push · OK · <N> archivos SPEC-299` a Fábrica PI-1.
- [x] **T010** Verificar que la lista de archivos del diff pre-push incluye SOLO los 3 archivos del alcance + los 3 archivos del SPEC ya committed (spec.md, plan.md, tasks.md). Si aparece cualquier otro → PARA + HALLAZGO.

## Fase 6 · Push + PR

- [x] **T011** `git push -u origin work/pi-SPEC-299-sentinels-ci-multi-producto` (push único, D-54).
- [x] **T012** `gh pr create --base main --head work/pi-SPEC-299-sentinels-ci-multi-producto --title "SPEC-299: sentinels CI multi-producto (002-PI-202)" --body <resumen del spec>`.

## Fase 7 · Verificación en vivo (candado dura A-49 · US-2 · SC-001)

- [x] **T013** `gh pr checks <PR>` — esperar completed. Ambos `pi-gate` y `bi-gate` deben aparecer con conclusion=success. Verificar además que `verificar_base` está verde.
- [x] **T014** Si algún job real falla (no el sentinel): PARA, aplicar D-55 (máx 2 iteraciones por síntoma), reportar a Fábrica antes del intento 3.
- [x] **T015** Actualizar `tasks.md` marcando todas las casillas [x], actualizar Status en spec.md a "Implementado", commit "docs(SPEC-299): tasks marked complete", push, verificar CI verde de nuevo.
- [x] **T016** Señal REALIZADO a Fábrica PI-1: `desarrollo-2: 002-PI-202 · REALIZADO · <hash> · PR #<num> · gh pr checks: verde total · <fecha> COT`.

---

## Dependencias

- T001, T002 → T007 (mismo archivo ci.yml, mismo commit).
- T003, T004 → T007 (mismo archivo bi.yml, mismo commit).
- T005 → T007 (archivo distinto pero mismo commit lógico).
- T006, T007, T008 secuenciales dentro de Fase 4.
- Fase 5 después de Fase 4. Fase 6 después de Fase 5. Fase 7 después de Fase 6.
- Paralelos [P]: T001+T003+T005 pueden editarse en paralelo (archivos distintos); T002 y T004 idem. En la práctica lo hago secuencial por simplicidad — el paralelismo no ahorra tiempo aquí.

## Verificaciones intermedias (checklist rápido antes del push)

- [x] `grep -c "runs-on:" .github/workflows/ci.yml` = **10** (era 9 + 1 nuevo).
- [x] `grep -c "runs-on:" .github/workflows/bi.yml` = **5** (era 4 + 1 nuevo).
- [x] `grep -q "pi-gate:" .github/workflows/ci.yml` = éxito.
- [x] `grep -q "bi-gate:" .github/workflows/bi.yml` = éxito.
- [x] `grep -q "^\.github/workflows/\*\*$" .github/workflows/ci.yml` NO aplica (el path va indentado); en su lugar: `grep -q "\".github/workflows/\*\*\"" .github/workflows/ci.yml` = éxito, ídem bi.yml.
- [x] `test -f .github/workflows/README.md` = éxito.

Status: IMPLEMENTADO — verificación en vivo OK · PR #132 · `pi-gate` pass 4s · `bi-gate` pass 3s · resto de checks verde total · commit HEAD 3f54f09e5.
