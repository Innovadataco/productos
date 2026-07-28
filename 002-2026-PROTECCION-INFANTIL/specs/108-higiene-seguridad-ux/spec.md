# Feature Specification: SPEC-108 — Higiene de seguridad y UX

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-28 (cola nocturna 002-PI-025, B4 — diagnósticos cerrados por ZEUS)

**Status**: FINALIZADO

**Input**: "I-33: /cambiar-password huérfana (ningún componente enlaza). I-29:
/api/estadisticas-publicas pública devuelve totales.scorePromedio pese a la SPEC-101. O-1:
rate-limit getScopeConfig() lee parámetros fuera del try — con Postgres caído responde 500
en vez del 429 + Retry-After de la SPEC-103."

## Requisitos (implementados tal cual)

- **FR-108a (I-33)**: enlace "Cambiar contraseña" visible para TODOS los roles: menú de
  usuario del `NavHeader`, `ColegioNav` (panel colegio) y `AdminNav` (panel
  admin/operador/comité).
- **FR-108b (I-29)**: `/api/estadisticas-publicas` (pública, sin auth) NO devuelve
  `totales.scorePromedio`: campo eliminado de la respuesta, el `aggregate` que lo calculaba
  y el assert del test (reemplazado por assert de AUSENCIA en todo el JSON).
- **FR-108c (O-1)**: `checkRateLimit` lee la config DENTRO del try y el catch usa defaults
  sincrónicos (`getScopeDefaults`): con Postgres caído, `seguimiento`/`login` responden
  429 + `Retry-After` (fail-closed), nunca 500. Test que falla la LECTURA de parámetros (no
  solo el upsert) y exige fail-closed sin lanzar.

## Success Criteria

- **SC-001**: cualquier rol llega a `/cambiar-password` desde su header/panel.
- **SC-002**: el JSON público no contiene `scorePromedio` en ningún nivel (test).
- **SC-003**: con la lectura de parámetros caída, `seguimiento` → `allowed:false` +
  `Retry-After` sin excepción (test).
