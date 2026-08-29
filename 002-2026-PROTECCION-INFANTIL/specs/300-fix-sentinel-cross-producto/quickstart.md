# Quickstart — SPEC-300 · Fix sentinel CI cross-producto

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

Guía práctica para validar el fix contra CI real. NO contiene código de implementación (eso vive en `tasks.md` + `/speckit-implement`).

## Prerrequisitos

- Rama `work/pi-SPEC-300-fix-sentinel-cross-producto` mergeada (o cualquier PR abierto con el fix vigente).
- Acceso a `gh` CLI autenticado contra `Innovadataco/productos`.
- Permiso para abrir PRs contra `main` desde ramas efímeras.
- Jelkin tiene `bi-gate` fuera de required durante la ventana de test (pre-CUMPLE); post-CUMPLE lo restaura.

## Test acid 1 — PR README-only (cubre US1 + US2 en un solo PR)

**Objetivo**: probar que ambos gates aparecen y quedan verde trivial cuando el PR no toca ningún producto.

```bash
git -C /Users/idc/Documents/GitHub/productos fetch origin main
git -C /Users/idc/Documents/GitHub/productos worktree add \
  .worktrees/test-acid-spec-300-readme \
  -b test/spec-300-readme-acid origin/main
cd /Users/idc/Documents/GitHub/productos/.worktrees/test-acid-spec-300-readme
# Cambio mínimo en README raíz — un espacio al final de una línea existente:
sed -i.bak -e '1s/$/ /' README.md && rm README.md.bak
git add README.md
git commit -m "test: acid SPEC-300 · README-only para validar sentinels"
git push -u origin test/spec-300-readme-acid
gh pr create --base main --head test/spec-300-readme-acid \
  --title "test: acid SPEC-300 · README-only" \
  --body "Test acid del fix sentinel cross-producto. NO mergear."
```

**Resultado esperado** (verificar en `gh pr checks <N>` o "Checks" tab):

- `pi-gate` aparece · conclusion `success` · duración < 90 s.
- `bi-gate` aparece · conclusion `success` · duración < 90 s.
- En el detalle del run de `ci.yml`: `should-skip` → `success` con `skip=true`; los jobs `verificaciones`/`test-unit`/`test-integration`/`test-integration-coverage`/`journeys`/`build` → `skipped`.
- En el detalle del run de `bi.yml`: `should-skip` → `success` con `skip=true`; los jobs `verify`/`typecheck`/`test-unit`/`build` → `skipped`.

Cerrar el PR sin mergear (`gh pr close <N> --delete-branch`).

## Test acid 2 — PR solo-PI (opcional · comportamiento heredado)

**Objetivo**: comprobar que un PR que toca solo PI sigue disparando `pi-gate` real y deja `bi-gate` trivial.

```bash
cd /Users/idc/Documents/GitHub/productos
git worktree add .worktrees/test-acid-spec-300-pi -b test/spec-300-pi-acid origin/main
cd .worktrees/test-acid-spec-300-pi
# Cambio mínimo no doc-only en PI (para forzar jobs pesados):
echo "// SPEC-300 test acid — revertir" >> 002-2026-PROTECCION-INFANTIL/src/lib/README.md.NOT_MD_FILE.ts
# (ajustar path a algo real que quede fuera de docs|specs y no sea .md)
git add 002-2026-PROTECCION-INFANTIL/
git commit -m "test: acid SPEC-300 · toque PI para forzar jobs pesados"
git push -u origin test/spec-300-pi-acid
gh pr create --base main --head test/spec-300-pi-acid --title "test: acid SPEC-300 · PI-only" --body "NO mergear"
```

**Resultado esperado**:

- `pi-gate` aparece · conclusion refleja el veredicto real de los jobs pesados (`success` si todo pasa, `failure` si algo se rompió).
- `bi-gate` aparece · conclusion `success` trivial en < 90 s.
- `should-skip` de BI reporta `skip=true` (no hay archivos `005-*` tocados).

## Test acid 3 — PR solo-BI (mismo comportamiento simétrico)

**Objetivo**: espejo del test 2 sobre el producto BI.

Análogo al Test acid 2 pero tocando `005-2026-BI-INTELIGENCIA-NEGOCIO/**`. Requiere colaboración con Dev BI-1/BI-2 si el desarrollador PI-1 no tiene contexto para hacer un cambio mínimo BI. Alternativa: tocar `005-*/README.md` con un espacio extra — cae bajo la regla `\.md$` de exclusión y `should-skip` reporta `skip=true`, dejando `bi-gate` trivial. Ambos gates verdes triviales. Cubre parcialmente US3 (verifica que el trigger arranca aunque el producto sea el "contrario" al que hace el PR).

## Test acid 4 — PR cross-producto (US3 completo)

**Objetivo**: probar que un PR que toca ambos productos ejerce ambos pipelines completos y ambos gates reportan según veredicto real.

```bash
cd /Users/idc/Documents/GitHub/productos
git worktree add .worktrees/test-acid-spec-300-cross -b test/spec-300-cross-acid origin/main
cd .worktrees/test-acid-spec-300-cross
# Cambio no-md-no-docs en AMBOS productos:
echo "// SPEC-300 cross" >> 002-2026-PROTECCION-INFANTIL/src/lib/README.md.NOT_MD_FILE.ts
echo "// SPEC-300 cross" >> 005-2026-BI-INTELIGENCIA-NEGOCIO/README.md.NOT_MD_FILE.ts
# (ajustar paths a archivos reales que existan)
git add 002-2026-PROTECCION-INFANTIL/ 005-2026-BI-INTELIGENCIA-NEGOCIO/
git commit -m "test: acid SPEC-300 · toque cross-producto"
git push -u origin test/spec-300-cross-acid
gh pr create --base main --head test/spec-300-cross-acid --title "test: acid SPEC-300 · cross" --body "NO mergear"
```

**Resultado esperado**:

- Ambos `should-skip` reportan `skip=false`.
- Los jobs pesados de ambos workflows corren.
- Ambos gates reportan según su veredicto real.

## Adjuntos requeridos en la señal REALIZADO

La señal `desarrollo-1: 002-PI-205 · REALIZADO · ...` DEBE incluir el link del PR del Test acid 1 (README-only) mostrando ambos gates verdes triviales. Los Tests 2, 3, 4 son deseables pero no bloqueantes si el 1 pasa y el análisis de research.md cubre los otros casos.

## Rollback (si el fix falla en producción tras merge)

1. `git revert <commit-del-fix>` en `main` (Jelkin ejecuta desde el clone principal).
2. Push del revert.
3. Notificar a Jelkin para que vuelva a sacar `bi-gate` de required (restaura el estado pre-SPEC-300).
4. Reabrir la spec con un plan de fix del edge case.

## Referencias

- [spec.md](./spec.md) — US1/US2/US3 y sus Acceptance Scenarios
- [research.md](./research.md) — decisión Opción A vs B y verificaciones en fuente
- [contracts/check-names.md](./contracts/check-names.md) — contrato con el ruleset
- Instructivo 002-PI-205 §Test acid obligatorio
