# SPEC-374 · CI de PI salta cuando el PR no lo toca

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-2 · **Origen**: radicado `003-PI-CI-SKIP-BI-ONLY.md` (pedido de Kimi vía Jelkin)

## El problema

Los PRs de otros productos del monorepo (BI, PIWEB, SICOV, …) esperan **25-30
minutos** por los 4 shards de `test-integration` de PI aunque no toquen una línea
nuestra. Reproducido en cada PR de BI-006 durante días.

## Requisitos

- **FR-001**: El job `should-skip` de `.github/workflows/ci.yml` reporta
  `skipped` cuando ningún archivo del PR obliga a correr la suite de PI. Un job
  `skipped` cuenta como éxito para required checks — el PR ajeno mergea sin
  esperar.
- **FR-002 (CANDADO DURO · anti-I-249)**: NO se usa `on: paths:`. Un
  `paths-ignore` que no dispara el workflow deja los checks REQUERIDOS de PI en
  estado *pendiente* y bloquea los merges para siempre.
- **FR-003**: La suite corre si algún archivo cambiado (a) vive bajo
  `002-2026-PROTECCION-INFANTIL/` y no es doc-only (docs/, specs/, `*.md`), o
  (b) es uno de los workflows compartidos del monorepo (`ci.yml`,
  `verificar-base-pr.yml`). Workflows específicos de otros productos
  (`bi.yml`, `bi-006.yml`) NO disparan.
- **FR-004**: La lógica vive en un módulo con tests unitarios
  (`should-skip-pi.mjs`), no como bash inline dentro del workflow — así los
  casos que hay que verificar quedan probados, no supuestos.

## Impacto en arquitectura:

Un módulo puro nuevo (`scripts/ci/should-skip-pi.mjs`) con su test hermano. El
workflow lo invoca con `node`. Ningún cambio de código de producto, ningún
`paths:` en `on:`, ninguna migración.
