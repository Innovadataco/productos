# Feature Specification: Rotación de claves filtradas + regla no-secretos (I-22)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Status**: FINALIZADO (pendiente ACTA)

## Contexto (URGENTE)

En el cierre de la spec 097 (commit `b9295f29`, pusheado) quedaron dos claves de cifrado de
producción escritas en `specs/097-despliegue-hibrido-produccion/cierre.md` y en el chat:
`PARAM_ENCRYPTION_KEY` (vigente) y `ENCRYPTION_KEY`. En git = comprometidas. Como prod
arrancó con datos de prueba (sin datos reales), rotar es barato AHORA.

## Requisitos

- **FR-001**: ROTAR ambas claves: valores nuevos y fuertes que van SOLO al `.env.production`
  del VPS y al CEO por canal seguro (archivo local fuera de git, 600) para su gestor.
  NUNCA al chat, NUNCA a git, NUNCA a un cierre.md.
- **FR-002**: Re-sembrar la BD de prod LIMPIA (los datos de prueba cifrados con la clave
  vieja quedan ilegibles; no hay datos reales).
- **FR-003**: Scrub de `specs/097-despliegue-hibrido-produccion/cierre.md`: quitar los
  valores y dejar un puntero al INVENTARIO-DE-SECRETOS (repo de gestión).
- **FR-004**: Limpieza del historial de git solo si es simple y segura; si no, basta que
  las claves viejas estén muertas (rotadas). Reportar la decisión.
- **FR-005**: Regla dura permanente en `AGENTS.md`: NUNCA escribir valores de secretos en
  commits, cierre.md, specs ni chat; siempre un puntero al inventario; los valores solo en
  `.env` (fuera de git) + gestor del CEO.

## Verificación

- `git grep` no encuentra ningún valor de clave en el árbol de trabajo.
- La app cifra/descifra con las nuevas (reporte E2E clasificado en prod).
- Healthcheck OK (`/api/health/worker`) + gate normal (lint+test+tsc+build).

## Success Criteria

- **SC-001**: Claves viejas muertas (rotadas en el VPS) y ausentes del árbol de trabajo.
- **SC-002**: BD de prod limpia y operativa con las claves nuevas (E2E).
- **SC-003**: Regla permanente documentada en AGENTS.md.
