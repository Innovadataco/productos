# Tasks — SPEC-300 · Fix sentinel CI cross-producto (002-PI-205)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Quickstart**: [quickstart.md](./quickstart.md)

**Branch**: `work/pi-SPEC-300-fix-sentinel-cross-producto` · **Base**: `main` @ `53398327e`

## Overview

Fix Opción A del instructivo 002-PI-205: eliminar `paths:` de `on:` en `ci.yml` y `bi.yml`, y añadir un job `should-skip` a `bi.yml` gemelo del ya existente en `ci.yml`. Los jobs pesados de BI adoptan `if: needs.should-skip.outputs.skip != 'true'`; `bi-gate` incorpora `should-skip` a `needs:` conservando `if: always()`. Names literales `pi-gate` / `bi-gate` inmutables (contrato con el ruleset "Gate CI - main").

**Total de tareas**: 14 · **MVP**: US1 + US2 (Phase 3 + Phase 4 · fix simétrico) · **Polish**: Phase 6 incluye los 4 tests acid del quickstart.

---

## Phase 1 · Setup

- [X] T001 Verificar estado base del worktree: `pwd` == `.worktrees/pi-SPEC-300-fix-sentinel-cross-producto`, `git branch --show-current` == `work/pi-SPEC-300-fix-sentinel-cross-producto`, `git log -1 --format=%H` == `f9a37a7ac` (commit de spec+plan), y `git diff --name-status origin/main..HEAD` reporta solo los 9 archivos doc del spec-kit. Sin trabajo pendiente en `.github/workflows/`.

## Phase 2 · Foundational

*No aplica.* El fix no requiere infra base compartida entre user stories: US1 y US2 son simétricos y el fix consiste en un único diff coherente. US3 se cubre implícitamente por US1+US2 (una vez ambos gates aparecen siempre, un PR que toca ambos productos dispara ambos pipelines completos como comportamiento residual).

## Phase 3 · User Story 1 — PR solo-BI ya no bloquea el ruleset (P1)

**Story goal**: `pi-gate` aparece como check en TODO PR contra `main`, incluso si el PR solo toca `005-2026-BI-INTELIGENCIA-NEGOCIO/**`.

**Independent test**: PR contra `main` que solo modifica un archivo bajo `005-*` (o README raíz). `pi-gate` aparece en `gh pr checks` con conclusion `success` en < 90 s. Los jobs pesados de `ci.yml` reportan `skipped`.

- [X] T002 [US1] Eliminar el bloque `paths:` de `on.push` en `.github/workflows/ci.yml` (borrar líneas ~12-15, que hoy tienen `paths: ["002-2026-PROTECCION-INFANTIL/**", ".github/workflows/**"]`). Conservar `branches: [feature/001-scaffolding]`. Sin comentarios explicativos nuevos — el header del workflow ya explica.
- [X] T003 [US1] Eliminar el bloque `paths:` de `on.pull_request` en `.github/workflows/ci.yml` (borrar líneas ~17-19, que hoy tienen `paths: ["002-2026-PROTECCION-INFANTIL/**", ".github/workflows/**"]`). Sin sustitución.
- [X] T004 [US1] Verificar sintaxis YAML: `python3 -c 'import yaml, sys; yaml.safe_load(open(".github/workflows/ci.yml"))'` desde el worktree PI. Debe retornar sin error (exit 0).

## Phase 4 · User Story 2 — PR solo-PI ya no bloquea el ruleset (P1)

**Story goal**: `bi-gate` aparece como check en TODO PR contra `main`, incluso si el PR solo toca `002-2026-PROTECCION-INFANTIL/**`. Los jobs pesados de `bi.yml` corren solo cuando hay cambios reales en `005-*`.

**Independent test**: PR contra `main` que solo modifica un archivo bajo `002-*` (p.ej. AGENTS.md con un espacio). `bi-gate` aparece en `gh pr checks` con conclusion `success` en < 90 s. Los jobs `verify`/`typecheck`/`test-unit`/`build` de `bi.yml` reportan `skipped`.

- [X] T005 [US2] Eliminar el bloque `paths:` de `on.push` y `on.pull_request` en `.github/workflows/bi.yml` (borrar líneas 4-6 y 8-10, que hoy tienen `paths: ["005-2026-BI-INTELIGENCIA-NEGOCIO/**", ".github/workflows/**"]`). Conservar los eventos `push` y `pull_request` desnudos.
- [X] T006 [P] [US2] Añadir job nuevo `should-skip` en `.github/workflows/bi.yml` inmediatamente antes de `verify` (primer job pesado), con override `defaults.run.working-directory: .` (bi.yml declara working-directory `005-*` a nivel workflow). Estructura idéntica al `should-skip` de `ci.yml` pero con el regex de exclusión adaptado: `(^005-2026-BI-INTELIGENCIA-NEGOCIO/(docs|specs)/|^docs/|^specs/|\.md$)`. Emitir `output` `skip` (`echo "skip=true" >> "$GITHUB_OUTPUT"` cuando no hay archivos code fuera de la exclusión, `skip=false` en caso contrario). Cero comentarios nuevos fuera del breve link a la SPEC-300.
- [X] T007 [US2] Modificar el job `verify` en `.github/workflows/bi.yml`: añadir `needs: [should-skip]` y `if: needs.should-skip.outputs.skip != 'true'`. Conservar todo lo demás.
- [X] T008 [US2] Modificar el job `typecheck` en `.github/workflows/bi.yml`: cambiar `needs: verify` a `needs: [should-skip, verify]` y añadir `if: needs.should-skip.outputs.skip != 'true'`.
- [X] T009 [US2] Modificar el job `test-unit` en `.github/workflows/bi.yml`: cambiar `needs: verify` a `needs: [should-skip, verify]` y añadir `if: needs.should-skip.outputs.skip != 'true'`.
- [X] T010 [US2] Modificar el job `build` en `.github/workflows/bi.yml`: añadir `should-skip` a su `needs:` (respetando lo que ya declare — típicamente `needs: [verify, typecheck, test-unit]` → `needs: [should-skip, verify, typecheck, test-unit]`) y añadir `if: needs.should-skip.outputs.skip != 'true'`. Verificar el `needs:` real en fuente antes de editar.
- [X] T011 [US2] Modificar el job `bi-gate` en `.github/workflows/bi.yml`: añadir `should-skip` al arreglo `needs:` (queda `needs: [should-skip, verify, typecheck, test-unit, build]`). NO tocar `if: always()`, NO tocar el step "Evaluar veredicto agregado", NO tocar `defaults.run.working-directory: .`, NO renombrar el job (name literal `bi-gate` inmutable · contrato ruleset).
- [X] T012 [US2] Verificar sintaxis YAML: `python3 -c 'import yaml, sys; yaml.safe_load(open(".github/workflows/bi.yml"))'` desde el worktree PI. Debe retornar sin error (exit 0). Y correr `grep -c '^  bi-gate:' .github/workflows/bi.yml` → debe reportar `1` (contrato ratchet).

## Phase 5 · User Story 3 — PR cross-producto ejerce ambos pipelines (P2)

**Story goal**: comportamiento residual — con US1 + US2 cerrados, un PR que toca ambos productos dispara ambos workflows con `should-skip=false` en ambos, ejerciendo los jobs pesados de ambos.

**Independent test**: PR contra `main` que toca simultáneamente un archivo bajo `002-*` y otro bajo `005-*`. Ambos `should-skip` reportan `skip=false`; los jobs pesados de ambos workflows corren; ambos gates reportan según veredicto real.

- [X] T013 [US3] Verificar por inspección estática que ningún cambio de Phase 3+4 introduce dependencia entre workflows (no hay `workflow_run`, no hay `gh api` cross-workflow, no hay artefacto compartido). Confirmar que US3 se cierra por consecuencia natural del fix, sin código adicional. Documentar en la señal `spec+plan LISTO`/`REALIZADO` que Phase 5 no genera diff propio.

## Phase 6 · Polish & Verification

- [ ] T014 Ejecutar los 4 tests acid del quickstart contra el CI real:
    - Test acid 1 (README-only) — **crítico**, link del PR obligatorio en señal REALIZADO.
    - Test acid 2 (solo-PI) — deseable si hay tiempo.
    - Test acid 3 (solo-BI) — deseable.
    - Test acid 4 (cross) — deseable, cubre US3 completo.
    Adjuntar links de los PRs de test en el reporte pre-REALIZADO; cerrar cada uno con `gh pr close <N> --delete-branch` tras verificar. Gate pre-push del PR principal: `git fetch origin && git rebase origin/main && git diff --name-status origin/main..HEAD` — esperado 9 archivos doc + 2 archivos YAML (`M .github/workflows/ci.yml` y `M .github/workflows/bi.yml`). Cualquier archivo extra → HALLAZGO. Push del PR principal + `gh pr create --base main` + adjuntar link Test acid 1 en la señal REALIZADO a Fábrica PI-1 (`idc-d9`).

---

## Dependencies

- **T001** (Setup) precede a todo.
- **T002-T004** [US1] son secuenciales dentro del mismo archivo (`ci.yml`).
- **T005** [US2] independiente de US1 (archivo distinto).
- **T006** [P] [US2] paralelo con **T002-T004** (archivos distintos: `bi.yml` vs `ci.yml`).
- **T007-T011** [US2] son secuenciales dentro de `bi.yml`, dependientes de **T005** y **T006** (necesitan la estructura base actualizada).
- **T012** [US2] cierra Phase 4: valida `bi.yml`.
- **T013** [US3] verificación de escritorio, sin diff.
- **T014** Polish: bloqueado por T002-T012.

## Parallel opportunities

- **T002-T004** (US1 · `ci.yml`) y **T005-T006** (US2 base · `bi.yml`) pueden ejecutarse en paralelo por afectar archivos distintos. Ganancia menor: son cambios de 1-3 líneas cada uno y la implementación puede hacerse en una sola sesión de edición.
- **T014** Polish requiere serialización porque abre PRs contra CI compartido.

## Independent test criteria (resumen)

| Story | Criterio de test independiente |
|---|---|
| US1 | PR sobre `main` que solo toca `005-*` o README raíz → `pi-gate` aparece verde trivial < 90 s. |
| US2 | PR sobre `main` que solo toca `002-*` (fuera de docs/specs/.md) → `bi-gate` aparece verde trivial < 90 s. |
| US3 | PR sobre `main` que toca ambos productos → ambos `should-skip` = false; jobs pesados corren en ambos workflows. |

## MVP scope

**MVP = US1 + US2** (Phase 3 + Phase 4). US3 se cierra por consecuencia natural sin diff propio. Los 4 tests acid del quickstart pertenecen a Polish (Phase 6) y su ejecución cierra el ciclo antes del REALIZADO.

## Implementation strategy

1. **Empezar por US1 + US2 en paralelo** (T002-T012). El diff total es < 20 líneas repartidas en 2 archivos.
2. **Sanity YAML local** (T004 + T012): validar sintaxis antes del commit.
3. **Commit único** con todo el fix + push (parte de T014).
4. **Test acid 1** obligatorio (T014): abrir PR paralelo README-only, adjuntar link, cerrar.
5. **Tests acid 2/3/4** si el tiempo lo permite; caso contrario documentar en la señal REALIZADO qué se cubre por research.md y qué queda como riesgo residual (aceptable si Fábrica lo aprueba).
6. **REALIZADO** a `idc-d9` con hash + link PR principal + link Test acid 1.
