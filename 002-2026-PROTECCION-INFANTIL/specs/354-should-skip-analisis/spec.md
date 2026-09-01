# SPEC-354 · Análisis del "verde falso" en PRs (should-skip / checks ausentes)

**Status**: CERRADA
**Fecha**: 2026-09-01 · **Dev**: PI-2 · **Origen**: orden del CEO tras la anomalía de checks en PR #223 (y #220)

## Contexto

El PR #223 apareció "verde" sin que corriera ningún check de código de PI
(tsc, tests, build). La orden inicial fue cambiar el job `should-skip` de
`.github/workflows/ci.yml` para diffear contra la base del PR en vez de
`HEAD^`. Esta spec se cierra **sin cambio de código**: la investigación
demostró que ese fix sería un placebo — el detalle está en `cierre.md`.

## Alcance

Solo análisis con evidencia dura (logs de runs reales + API de GitHub).
Ningún archivo de la app ni del CI se modifica.

## Requisito

- **FR-001**: Determinar con evidencia por qué el PR #223 mostró estado verde
  sin checks de PI, y si el cambio propuesto a `should-skip` lo corrige.

## Impacto en arquitectura:

Ninguno. No se toca código, CI ni esquema. El control operativo vigente es el
gate del CEO ("checks de PI presentes" antes de mergear).
